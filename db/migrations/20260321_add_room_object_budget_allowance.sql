alter table public.room_objects
  add column if not exists budget_allowance numeric(12,2);

alter table public.room_objects
  drop constraint if exists chk_room_objects_budget_allowance_non_negative;

alter table public.room_objects
  add constraint chk_room_objects_budget_allowance_non_negative
  check (budget_allowance is null or budget_allowance >= 0);

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
    budget_allowance,
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
    nullif(ro ->> 'budget_allowance', '')::numeric,
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

  insert into public.project_house_budgets (
    id,
    project_id,
    house_id,
    total_budget,
    created_at,
    updated_at
  )
  select
    coalesce(nullif(phb ->> 'id', '')::uuid, gen_random_uuid()),
    p_project_id,
    (phb ->> 'house_id')::uuid,
    coalesce(nullif(phb ->> 'total_budget', '')::numeric, 0),
    coalesce((phb ->> 'created_at')::timestamptz, now()),
    now()
  from jsonb_array_elements(coalesce(v_snapshot_data -> 'project_house_budgets', '[]'::jsonb)) phb
  where exists (
    select 1
    from public.houses h
    where h.id = (phb ->> 'house_id')::uuid
      and h.project_id = p_project_id
  )
  on conflict (project_id, house_id) do update
    set total_budget = excluded.total_budget,
        updated_at = now();

  insert into public.project_room_budgets (
    id,
    project_id,
    room_id,
    total_budget,
    created_at,
    updated_at
  )
  select
    coalesce(nullif(prb ->> 'id', '')::uuid, gen_random_uuid()),
    p_project_id,
    (prb ->> 'room_id')::uuid,
    coalesce(nullif(prb ->> 'total_budget', '')::numeric, 0),
    coalesce((prb ->> 'created_at')::timestamptz, now()),
    now()
  from jsonb_array_elements(coalesce(v_snapshot_data -> 'project_room_budgets', '[]'::jsonb)) prb
  where exists (
    select 1
    from public.rooms r
    join public.houses h on h.id = r.house_id
    where r.id = (prb ->> 'room_id')::uuid
      and h.project_id = p_project_id
  )
  on conflict (project_id, room_id) do update
    set total_budget = excluded.total_budget,
        updated_at = now();
end;
$$;

revoke all on function public.restore_project_snapshot(uuid, uuid) from public;
grant execute on function public.restore_project_snapshot(uuid, uuid) to authenticated;
grant execute on function public.restore_project_snapshot(uuid, uuid) to service_role;

