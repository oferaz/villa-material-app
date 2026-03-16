create table if not exists public.project_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  snapshot_name text not null,
  snapshot_data jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_snapshots_project_created
  on public.project_snapshots (project_id, created_at desc);

alter table public.project_snapshots enable row level security;

drop policy if exists "project_snapshots_member_select" on public.project_snapshots;
create policy "project_snapshots_member_select"
on public.project_snapshots
for select
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_snapshots.project_id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists "project_snapshots_editor_insert" on public.project_snapshots;
create policy "project_snapshots_editor_insert"
on public.project_snapshots
for insert
with check (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_snapshots.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
);

drop policy if exists "project_snapshots_editor_delete" on public.project_snapshots;
create policy "project_snapshots_editor_delete"
on public.project_snapshots
for delete
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_snapshots.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
);

drop function if exists public.create_project_snapshot(uuid, text);
create or replace function public.create_project_snapshot(
  p_project_id uuid,
  p_snapshot_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_snapshot_id uuid;
  v_snapshot_name text := nullif(trim(coalesce(p_snapshot_name, '')), '');
  v_project_data jsonb;
  v_houses_data jsonb;
  v_rooms_data jsonb;
  v_room_objects_data jsonb;
  v_project_budget_data jsonb;
  v_project_budget_categories_data jsonb;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_project_id is null then
    raise exception 'Project id is required.';
  end if;

  if not exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = v_actor_user_id
      and pm.role in ('owner', 'editor')
  ) then
    raise exception 'You do not have permission to snapshot this project.';
  end if;

  if v_snapshot_name is null then
    v_snapshot_name := 'Snapshot ' || to_char(now(), 'YYYY-MM-DD HH24:MI');
  end if;

  select to_jsonb(p)
  into v_project_data
  from public.projects p
  where p.id = p_project_id
  limit 1;

  if v_project_data is null then
    raise exception 'Project not found.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(h) order by h.sort_order, h.created_at), '[]'::jsonb)
  into v_houses_data
  from public.houses h
  where h.project_id = p_project_id;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order, r.created_at), '[]'::jsonb)
  into v_rooms_data
  from public.rooms r
  join public.houses h on h.id = r.house_id
  where h.project_id = p_project_id;

  select coalesce(jsonb_agg(to_jsonb(ro) order by ro.sort_order, ro.created_at), '[]'::jsonb)
  into v_room_objects_data
  from public.room_objects ro
  join public.rooms r on r.id = ro.room_id
  join public.houses h on h.id = r.house_id
  where h.project_id = p_project_id;

  select to_jsonb(pb)
  into v_project_budget_data
  from public.project_budgets pb
  where pb.project_id = p_project_id
  limit 1;

  select coalesce(jsonb_agg(to_jsonb(pbc) order by pbc.category_name), '[]'::jsonb)
  into v_project_budget_categories_data
  from public.project_budget_categories pbc
  where pbc.project_id = p_project_id;

  insert into public.project_snapshots (
    project_id,
    snapshot_name,
    snapshot_data,
    created_by
  )
  values (
    p_project_id,
    v_snapshot_name,
    jsonb_build_object(
      'project', v_project_data,
      'houses', v_houses_data,
      'rooms', v_rooms_data,
      'room_objects', v_room_objects_data,
      'project_budget', v_project_budget_data,
      'project_budget_categories', v_project_budget_categories_data
    ),
    v_actor_user_id
  )
  returning id into v_snapshot_id;

  return v_snapshot_id;
end;
$$;

drop function if exists public.restore_project_snapshot(uuid, uuid);
create or replace function public.restore_project_snapshot(
  p_project_id uuid,
  p_snapshot_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_snapshot_data jsonb;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_project_id is null or p_snapshot_id is null then
    raise exception 'Project id and snapshot id are required.';
  end if;

  if not exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = v_actor_user_id
      and pm.role in ('owner', 'editor')
  ) then
    raise exception 'You do not have permission to restore this project.';
  end if;

  select ps.snapshot_data
  into v_snapshot_data
  from public.project_snapshots ps
  where ps.id = p_snapshot_id
    and ps.project_id = p_project_id
  limit 1;

  if v_snapshot_data is null then
    raise exception 'Snapshot not found for this project.';
  end if;

  perform 1
  from public.projects p
  where p.id = p_project_id
  for update;

  update public.projects p
  set
    name = coalesce(v_snapshot_data -> 'project' ->> 'name', p.name),
    client_name = v_snapshot_data -> 'project' ->> 'client_name',
    location = v_snapshot_data -> 'project' ->> 'location',
    currency = coalesce(v_snapshot_data -> 'project' ->> 'currency', p.currency),
    updated_at = now()
  where p.id = p_project_id;

  delete from public.houses h
  where h.project_id = p_project_id;

  insert into public.houses (
    id,
    project_id,
    name,
    size_sq_m,
    sort_order,
    created_at,
    updated_at
  )
  select
    (h ->> 'id')::uuid,
    p_project_id,
    coalesce(h ->> 'name', 'House'),
    nullif(h ->> 'size_sq_m', '')::numeric,
    coalesce((h ->> 'sort_order')::integer, 0),
    coalesce((h ->> 'created_at')::timestamptz, now()),
    now()
  from jsonb_array_elements(coalesce(v_snapshot_data -> 'houses', '[]'::jsonb)) h;

  insert into public.rooms (
    id,
    house_id,
    name,
    size_sq_m,
    room_type,
    sort_order,
    created_at,
    updated_at
  )
  select
    (r ->> 'id')::uuid,
    (r ->> 'house_id')::uuid,
    coalesce(r ->> 'name', 'Room'),
    nullif(r ->> 'size_sq_m', '')::numeric,
    coalesce(r ->> 'room_type', 'living_room'),
    coalesce((r ->> 'sort_order')::integer, 0),
    coalesce((r ->> 'created_at')::timestamptz, now()),
    now()
  from jsonb_array_elements(coalesce(v_snapshot_data -> 'rooms', '[]'::jsonb)) r;

  insert into public.room_objects (
    id,
    room_id,
    name,
    category,
    quantity,
    material_search_query,
    selected_material_id,
    po_approved,
    is_ordered,
    is_installed,
    sort_order,
    created_at,
    updated_at
  )
  select
    (ro ->> 'id')::uuid,
    (ro ->> 'room_id')::uuid,
    coalesce(ro ->> 'name', 'Object'),
    coalesce(ro ->> 'category', 'Custom'),
    greatest(1, coalesce((ro ->> 'quantity')::integer, 1)),
    nullif(ro ->> 'material_search_query', ''),
    nullif(ro ->> 'selected_material_id', '')::uuid,
    coalesce((ro ->> 'po_approved')::boolean, false),
    coalesce((ro ->> 'is_ordered')::boolean, false),
    coalesce((ro ->> 'is_installed')::boolean, false),
    coalesce((ro ->> 'sort_order')::integer, 0),
    coalesce((ro ->> 'created_at')::timestamptz, now()),
    now()
  from jsonb_array_elements(coalesce(v_snapshot_data -> 'room_objects', '[]'::jsonb)) ro;

  delete from public.project_budget_categories pbc
  where pbc.project_id = p_project_id;

  insert into public.project_budget_categories (
    id,
    project_id,
    category_name,
    total_budget,
    created_at,
    updated_at
  )
  select
    coalesce(nullif(pbc ->> 'id', '')::uuid, gen_random_uuid()),
    p_project_id,
    pbc ->> 'category_name',
    coalesce(nullif(pbc ->> 'total_budget', '')::numeric, 0),
    coalesce((pbc ->> 'created_at')::timestamptz, now()),
    now()
  from jsonb_array_elements(coalesce(v_snapshot_data -> 'project_budget_categories', '[]'::jsonb)) pbc
  where (pbc ->> 'category_name') in ('Furniture', 'Lighting', 'Tiles', 'Bathroom', 'Kitchen', 'Decor');

  if jsonb_typeof(v_snapshot_data -> 'project_budget') = 'object' then
    insert into public.project_budgets (
      project_id,
      total_budget,
      currency,
      created_at,
      updated_at
    )
    values (
      p_project_id,
      coalesce(nullif(v_snapshot_data -> 'project_budget' ->> 'total_budget', '')::numeric, 0),
      coalesce(v_snapshot_data -> 'project_budget' ->> 'currency', 'USD'),
      coalesce((v_snapshot_data -> 'project_budget' ->> 'created_at')::timestamptz, now()),
      now()
    )
    on conflict (project_id) do update
      set total_budget = excluded.total_budget,
          currency = excluded.currency,
          updated_at = now();
  end if;
end;
$$;

revoke all on function public.create_project_snapshot(uuid, text) from public;
grant execute on function public.create_project_snapshot(uuid, text) to authenticated;
grant execute on function public.create_project_snapshot(uuid, text) to service_role;

revoke all on function public.restore_project_snapshot(uuid, uuid) from public;
grant execute on function public.restore_project_snapshot(uuid, uuid) to authenticated;
grant execute on function public.restore_project_snapshot(uuid, uuid) to service_role;

