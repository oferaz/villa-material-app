create table if not exists public.client_views (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed', 'revoked', 'expired')),
  token_hash text,
  published_version integer not null default 0 check (published_version >= 0),
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_client_views_token_hash
  on public.client_views (token_hash)
  where token_hash is not null;

create index if not exists idx_client_views_project_updated
  on public.client_views (project_id, updated_at desc);

drop trigger if exists trg_client_views_touch_updated_at on public.client_views;
create trigger trg_client_views_touch_updated_at
before update on public.client_views
for each row execute function public.touch_updated_at();

create table if not exists public.client_view_recipients (
  id uuid primary key default gen_random_uuid(),
  client_view_id uuid not null references public.client_views(id) on delete cascade,
  email text not null check (email = lower(email)),
  created_at timestamptz not null default now(),
  constraint uq_client_view_recipients_client_view_email unique (client_view_id, email)
);

create index if not exists idx_client_view_recipients_email
  on public.client_view_recipients (email);

create table if not exists public.client_view_items (
  id uuid primary key default gen_random_uuid(),
  client_view_id uuid not null references public.client_views(id) on delete cascade,
  published_version integer not null check (published_version > 0),
  house_id uuid references public.houses(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  room_object_id uuid references public.room_objects(id) on delete set null,
  house_name text not null,
  room_name text not null,
  object_name text not null,
  object_category text not null,
  quantity integer not null default 1 check (quantity > 0),
  card_mode text not null check (card_mode in ('material_choice', 'budget_input', 'scope_confirmation')),
  prompt_text text,
  show_source_link boolean not null default false,
  budget_allowance numeric(12,2),
  current_selected_material_name text,
  current_selected_price numeric(12,2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_view_items_client_view_version
  on public.client_view_items (client_view_id, published_version, sort_order);

create index if not exists idx_client_view_items_room_object
  on public.client_view_items (room_object_id);

create table if not exists public.client_view_item_options (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.client_view_items(id) on delete cascade,
  source_material_id uuid references public.materials(id) on delete set null,
  name text not null,
  supplier_name text,
  image_url text,
  price numeric(12,2),
  description text,
  source_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_view_item_options_item_sort
  on public.client_view_item_options (item_id, sort_order);

create table if not exists public.client_view_responses (
  id uuid primary key default gen_random_uuid(),
  client_view_id uuid not null references public.client_views(id) on delete cascade,
  item_id uuid not null references public.client_view_items(id) on delete cascade,
  published_version integer not null check (published_version > 0),
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_email text not null check (recipient_email = lower(recipient_email)),
  selected_option_id uuid references public.client_view_item_options(id) on delete set null,
  preferred_budget numeric(12,2),
  scope_decision text check (scope_decision in ('approved', 'not_needed', 'needs_revision')),
  comment text,
  applied_at timestamptz,
  applied_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_client_view_responses_item_actor_version unique (item_id, actor_user_id, published_version)
);

create index if not exists idx_client_view_responses_client_view_version
  on public.client_view_responses (client_view_id, published_version, updated_at desc);

drop trigger if exists trg_client_view_responses_touch_updated_at on public.client_view_responses;
create trigger trg_client_view_responses_touch_updated_at
before update on public.client_view_responses
for each row execute function public.touch_updated_at();

alter table public.client_views enable row level security;
alter table public.client_view_recipients enable row level security;
alter table public.client_view_items enable row level security;
alter table public.client_view_item_options enable row level security;
alter table public.client_view_responses enable row level security;

drop policy if exists "client_views_member_select" on public.client_views;
create policy "client_views_member_select"
on public.client_views
for select
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = client_views.project_id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists "client_views_editor_insert" on public.client_views;
create policy "client_views_editor_insert"
on public.client_views
for insert
with check (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = client_views.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
  and created_by = auth.uid()
);

drop policy if exists "client_views_editor_update" on public.client_views;
create policy "client_views_editor_update"
on public.client_views
for update
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = client_views.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = client_views.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
);

drop policy if exists "client_view_recipients_member_select" on public.client_view_recipients;
create policy "client_view_recipients_member_select"
on public.client_view_recipients
for select
using (
  exists (
    select 1
    from public.client_views cv
    join public.project_members pm on pm.project_id = cv.project_id
    where cv.id = client_view_recipients.client_view_id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists "client_view_recipients_editor_all" on public.client_view_recipients;
create policy "client_view_recipients_editor_all"
on public.client_view_recipients
for all
using (
  exists (
    select 1
    from public.client_views cv
    join public.project_members pm on pm.project_id = cv.project_id
    where cv.id = client_view_recipients.client_view_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.client_views cv
    join public.project_members pm on pm.project_id = cv.project_id
    where cv.id = client_view_recipients.client_view_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
);

drop policy if exists "client_view_items_member_select" on public.client_view_items;
create policy "client_view_items_member_select"
on public.client_view_items
for select
using (
  exists (
    select 1
    from public.client_views cv
    join public.project_members pm on pm.project_id = cv.project_id
    where cv.id = client_view_items.client_view_id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists "client_view_items_editor_all" on public.client_view_items;
create policy "client_view_items_editor_all"
on public.client_view_items
for all
using (
  exists (
    select 1
    from public.client_views cv
    join public.project_members pm on pm.project_id = cv.project_id
    where cv.id = client_view_items.client_view_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.client_views cv
    join public.project_members pm on pm.project_id = cv.project_id
    where cv.id = client_view_items.client_view_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
);

drop policy if exists "client_view_item_options_member_select" on public.client_view_item_options;
create policy "client_view_item_options_member_select"
on public.client_view_item_options
for select
using (
  exists (
    select 1
    from public.client_view_items cvi
    join public.client_views cv on cv.id = cvi.client_view_id
    join public.project_members pm on pm.project_id = cv.project_id
    where cvi.id = client_view_item_options.item_id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists "client_view_item_options_editor_all" on public.client_view_item_options;
create policy "client_view_item_options_editor_all"
on public.client_view_item_options
for all
using (
  exists (
    select 1
    from public.client_view_items cvi
    join public.client_views cv on cv.id = cvi.client_view_id
    join public.project_members pm on pm.project_id = cv.project_id
    where cvi.id = client_view_item_options.item_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.client_view_items cvi
    join public.client_views cv on cv.id = cvi.client_view_id
    join public.project_members pm on pm.project_id = cv.project_id
    where cvi.id = client_view_item_options.item_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
);

drop policy if exists "client_view_responses_member_select" on public.client_view_responses;
create policy "client_view_responses_member_select"
on public.client_view_responses
for select
using (
  exists (
    select 1
    from public.client_views cv
    join public.project_members pm on pm.project_id = cv.project_id
    where cv.id = client_view_responses.client_view_id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists "client_view_responses_editor_update" on public.client_view_responses;
create policy "client_view_responses_editor_update"
on public.client_view_responses
for update
using (
  exists (
    select 1
    from public.client_views cv
    join public.project_members pm on pm.project_id = cv.project_id
    where cv.id = client_view_responses.client_view_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.client_views cv
    join public.project_members pm on pm.project_id = cv.project_id
    where cv.id = client_view_responses.client_view_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
);

drop function if exists public.client_view_token_hash(text);
create or replace function public.client_view_token_hash(p_token text)
returns text
language sql
immutable
as $$
  select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

drop function if exists public.publish_client_view(uuid, text, timestamptz, jsonb, jsonb);
create or replace function public.publish_client_view(
  p_project_id uuid,
  p_title text default null,
  p_expires_at timestamptz default null,
  p_recipient_emails jsonb default '[]'::jsonb,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_client_view public.client_views%rowtype;
  v_project_name text;
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_token text;
  v_token_hash text;
  v_email text;
  v_item jsonb;
  v_option jsonb;
  v_item_id uuid;
  v_sort_order integer := 0;
  v_option_sort integer;
  v_option_count integer;
  v_object_record record;
  v_selected_material record;
  v_material_record record;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_project_id is null then
    raise exception 'Project id is required.';
  end if;

  if jsonb_typeof(coalesce(p_recipient_emails, '[]'::jsonb)) <> 'array' then
    raise exception 'Recipient emails must be a JSON array.';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Items must be a JSON array.';
  end if;

  if not exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = v_actor_user_id
      and pm.role in ('owner', 'editor')
  ) then
    raise exception 'You do not have permission to publish a client view for this project.';
  end if;

  select p.name
  into v_project_name
  from public.projects p
  where p.id = p_project_id;

  if v_project_name is null then
    raise exception 'Project not found.';
  end if;

  if v_title is null then
    v_title := v_project_name || ' Client Review';
  end if;

  select *
  into v_client_view
  from public.client_views cv
  where cv.project_id = p_project_id
  order by cv.updated_at desc, cv.created_at desc
  limit 1
  for update;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_token_hash := public.client_view_token_hash(v_token);

  if v_client_view.id is null then
    insert into public.client_views (
      project_id,
      title,
      status,
      token_hash,
      published_version,
      published_at,
      expires_at,
      created_by
    )
    values (
      p_project_id,
      v_title,
      'published',
      v_token_hash,
      1,
      now(),
      p_expires_at,
      v_actor_user_id
    )
    returning *
    into v_client_view;
  else
    update public.client_views
    set title = v_title,
        status = 'published',
        token_hash = v_token_hash,
        published_version = v_client_view.published_version + 1,
        published_at = now(),
        expires_at = p_expires_at,
        updated_at = now()
    where id = v_client_view.id
    returning *
    into v_client_view;
  end if;

  delete from public.client_view_recipients cvr
  where cvr.client_view_id = v_client_view.id;

  for v_email in
    select lower(trim(value))
    from jsonb_array_elements_text(coalesce(p_recipient_emails, '[]'::jsonb))
  loop
    if v_email = '' then
      continue;
    end if;

    insert into public.client_view_recipients (client_view_id, email)
    values (v_client_view.id, v_email)
    on conflict (client_view_id, email) do nothing;
  end loop;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    if coalesce(v_item ->> 'cardMode', '') not in ('material_choice', 'budget_input', 'scope_confirmation') then
      raise exception 'Unsupported card mode.';
    end if;

    select
      h.id as house_id,
      h.name as house_name,
      r.id as room_id,
      r.name as room_name,
      ro.id as room_object_id,
      ro.name as object_name,
      ro.category as object_category,
      ro.quantity as quantity,
      ro.budget_allowance as budget_allowance
    into v_object_record
    from public.room_objects ro
    join public.rooms r on r.id = ro.room_id
    join public.houses h on h.id = r.house_id
    where ro.id = nullif(v_item ->> 'roomObjectId', '')::uuid
      and h.project_id = p_project_id;

    if v_object_record.room_object_id is null then
      raise exception 'Selected room object does not belong to this project.';
    end if;

    select
      m.name,
      m.price
    into v_selected_material
    from public.room_objects ro
    join public.materials m on m.id = ro.selected_material_id
    where ro.id = v_object_record.room_object_id;

    insert into public.client_view_items (
      client_view_id,
      published_version,
      house_id,
      room_id,
      room_object_id,
      house_name,
      room_name,
      object_name,
      object_category,
      quantity,
      card_mode,
      prompt_text,
      show_source_link,
      budget_allowance,
      current_selected_material_name,
      current_selected_price,
      sort_order
    )
    values (
      v_client_view.id,
      v_client_view.published_version,
      v_object_record.house_id,
      v_object_record.room_id,
      v_object_record.room_object_id,
      v_object_record.house_name,
      v_object_record.room_name,
      v_object_record.object_name,
      v_object_record.object_category,
      greatest(1, coalesce(v_object_record.quantity, 1)),
      v_item ->> 'cardMode',
      nullif(trim(coalesce(v_item ->> 'promptText', '')), ''),
      coalesce((v_item ->> 'showSourceLink')::boolean, false),
      v_object_record.budget_allowance,
      v_selected_material.name,
      v_selected_material.price,
      v_sort_order
    )
    returning id
    into v_item_id;

    if (v_item ->> 'cardMode') = 'material_choice' then
      if jsonb_typeof(coalesce(v_item -> 'options', '[]'::jsonb)) <> 'array' then
        raise exception 'Material choice options must be a JSON array.';
      end if;

      v_option_sort := 0;
      v_option_count := 0;

      for v_option in
        select value
        from jsonb_array_elements(coalesce(v_item -> 'options', '[]'::jsonb))
      loop
        select
          m.id,
          m.name,
          m.supplier_name,
          m.price,
          m.description,
          m.source_url,
          (
            select mi.image_url
            from public.material_images mi
            where mi.material_id = m.id
            order by mi.sort_order asc, mi.created_at asc
            limit 1
          ) as image_url
        into v_material_record
        from public.materials m
        where m.id = nullif(v_option ->> 'materialId', '')::uuid
          and m.owner_user_id = v_actor_user_id;

        if v_material_record.id is null then
          raise exception 'Published option must belong to the current user.';
        end if;

        insert into public.client_view_item_options (
          item_id,
          source_material_id,
          name,
          supplier_name,
          image_url,
          price,
          description,
          source_url,
          sort_order
        )
        values (
          v_item_id,
          v_material_record.id,
          v_material_record.name,
          v_material_record.supplier_name,
          v_material_record.image_url,
          v_material_record.price,
          v_material_record.description,
          v_material_record.source_url,
          v_option_sort
        );

        v_option_sort := v_option_sort + 1;
        v_option_count := v_option_count + 1;
      end loop;

      if v_option_count = 0 or v_option_count > 3 then
        raise exception 'Material choice items must publish between 1 and 3 options.';
      end if;
    end if;

    v_sort_order := v_sort_order + 1;
  end loop;

  return jsonb_build_object(
    'clientViewId', v_client_view.id,
    'token', v_token,
    'publishedVersion', v_client_view.published_version,
    'title', v_client_view.title,
    'status', v_client_view.status,
    'publishedAt', v_client_view.published_at,
    'expiresAt', v_client_view.expires_at
  );
end;
$$;

drop function if exists public.get_published_client_view(text);
create or replace function public.get_published_client_view(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_client_view public.client_views%rowtype;
  v_items jsonb;
begin
  if nullif(trim(coalesce(p_token, '')), '') is null then
    return null;
  end if;

  select *
  into v_client_view
  from public.client_views cv
  where cv.token_hash = public.client_view_token_hash(trim(p_token))
    and cv.status = 'published'
  limit 1;

  if v_client_view.id is null then
    return null;
  end if;

  if v_client_view.expires_at is not null and v_client_view.expires_at <= now() then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cvi.id,
        'roomObjectId', cvi.room_object_id,
        'houseName', cvi.house_name,
        'roomName', cvi.room_name,
        'objectName', cvi.object_name,
        'objectCategory', cvi.object_category,
        'quantity', cvi.quantity,
        'cardMode', cvi.card_mode,
        'promptText', cvi.prompt_text,
        'showSourceLink', cvi.show_source_link,
        'budgetAllowance', cvi.budget_allowance,
        'currentSelectedMaterialName', cvi.current_selected_material_name,
        'currentSelectedPrice', cvi.current_selected_price,
        'options',
          coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id', cvio.id,
                  'sourceMaterialId', cvio.source_material_id,
                  'name', cvio.name,
                  'supplierName', cvio.supplier_name,
                  'imageUrl', cvio.image_url,
                  'price', cvio.price,
                  'description', cvio.description,
                  'sourceUrl', case when cvi.show_source_link then cvio.source_url else null end,
                  'sortOrder', cvio.sort_order
                )
                order by cvio.sort_order asc, cvio.created_at asc
              )
              from public.client_view_item_options cvio
              where cvio.item_id = cvi.id
            ),
            '[]'::jsonb
          )
      )
      order by cvi.sort_order asc, cvi.created_at asc
    ),
    '[]'::jsonb
  )
  into v_items
  from public.client_view_items cvi
  where cvi.client_view_id = v_client_view.id
    and cvi.published_version = v_client_view.published_version;

  return jsonb_build_object(
    'id', v_client_view.id,
    'title', v_client_view.title,
    'status', v_client_view.status,
    'publishedVersion', v_client_view.published_version,
    'publishedAt', v_client_view.published_at,
    'expiresAt', v_client_view.expires_at,
    'items', coalesce(v_items, '[]'::jsonb)
  );
end;
$$;

drop function if exists public.get_client_view_submission_context(text);
create or replace function public.get_client_view_submission_context(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_client_view public.client_views%rowtype;
  v_can_submit boolean := false;
  v_responses jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select lower(trim(coalesce(u.email, '')))
  into v_email
  from auth.users u
  where u.id = v_user_id
  limit 1;

  select *
  into v_client_view
  from public.client_views cv
  where cv.token_hash = public.client_view_token_hash(trim(coalesce(p_token, '')))
    and cv.status = 'published'
  limit 1;

  if v_client_view.id is null then
    raise exception 'Client view not found.';
  end if;

  if v_client_view.expires_at is not null and v_client_view.expires_at <= now() then
    raise exception 'Client view has expired.';
  end if;

  v_can_submit := exists (
    select 1
    from public.client_view_recipients cvr
    where cvr.client_view_id = v_client_view.id
      and cvr.email = v_email
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cvr.id,
        'itemId', cvr.item_id,
        'publishedVersion', cvr.published_version,
        'selectedOptionId', cvr.selected_option_id,
        'preferredBudget', cvr.preferred_budget,
        'scopeDecision', cvr.scope_decision,
        'comment', cvr.comment,
        'appliedAt', cvr.applied_at,
        'updatedAt', cvr.updated_at
      )
      order by cvr.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_responses
  from public.client_view_responses cvr
  where cvr.client_view_id = v_client_view.id
    and cvr.actor_user_id = v_user_id
    and cvr.published_version = v_client_view.published_version;

  return jsonb_build_object(
    'clientViewId', v_client_view.id,
    'publishedVersion', v_client_view.published_version,
    'userEmail', v_email,
    'canSubmit', v_can_submit,
    'responses', coalesce(v_responses, '[]'::jsonb)
  );
end;
$$;

drop function if exists public.submit_client_view_response(text, uuid, uuid, numeric, text, text);
create or replace function public.submit_client_view_response(
  p_token text,
  p_item_id uuid,
  p_selected_option_id uuid default null,
  p_preferred_budget numeric default null,
  p_scope_decision text default null,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_client_view public.client_views%rowtype;
  v_item public.client_view_items%rowtype;
  v_response_id uuid;
  v_scope_decision text := nullif(trim(coalesce(p_scope_decision, '')), '');
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_item_id is null then
    raise exception 'Item id is required.';
  end if;

  select lower(trim(coalesce(u.email, '')))
  into v_email
  from auth.users u
  where u.id = v_user_id
  limit 1;

  if v_email is null or v_email = '' then
    raise exception 'Signed-in user must have an email address.';
  end if;

  select *
  into v_client_view
  from public.client_views cv
  where cv.token_hash = public.client_view_token_hash(trim(coalesce(p_token, '')))
    and cv.status = 'published'
  limit 1;

  if v_client_view.id is null then
    raise exception 'Client view not found.';
  end if;

  if v_client_view.expires_at is not null and v_client_view.expires_at <= now() then
    raise exception 'Client view has expired.';
  end if;

  if not exists (
    select 1
    from public.client_view_recipients cvr
    where cvr.client_view_id = v_client_view.id
      and cvr.email = v_email
  ) then
    raise exception 'Your account is not allowed to submit approvals for this client view.';
  end if;

  select *
  into v_item
  from public.client_view_items cvi
  where cvi.id = p_item_id
    and cvi.client_view_id = v_client_view.id
    and cvi.published_version = v_client_view.published_version
  limit 1;

  if v_item.id is null then
    raise exception 'Client view item not found.';
  end if;

  if v_item.card_mode = 'material_choice' then
    if p_selected_option_id is null then
      raise exception 'A material option is required.';
    end if;

    if not exists (
      select 1
      from public.client_view_item_options cvio
      where cvio.id = p_selected_option_id
        and cvio.item_id = v_item.id
    ) then
      raise exception 'Selected option does not belong to this client view item.';
    end if;
  elsif v_item.card_mode = 'budget_input' then
    if p_preferred_budget is null or p_preferred_budget < 0 then
      raise exception 'Preferred budget must be zero or greater.';
    end if;
    p_selected_option_id := null;
    v_scope_decision := null;
  elsif v_item.card_mode = 'scope_confirmation' then
    if v_scope_decision not in ('approved', 'not_needed', 'needs_revision') then
      raise exception 'Scope decision must be approved, not_needed, or needs_revision.';
    end if;
    p_selected_option_id := null;
    p_preferred_budget := null;
  end if;

  insert into public.profiles (id)
  values (v_user_id)
  on conflict (id) do nothing;

  insert into public.client_view_responses (
    client_view_id,
    item_id,
    published_version,
    actor_user_id,
    recipient_email,
    selected_option_id,
    preferred_budget,
    scope_decision,
    comment
  )
  values (
    v_client_view.id,
    v_item.id,
    v_client_view.published_version,
    v_user_id,
    v_email,
    p_selected_option_id,
    case when v_item.card_mode = 'budget_input' then round(p_preferred_budget, 2) else null end,
    case when v_item.card_mode = 'scope_confirmation' then v_scope_decision else null end,
    nullif(trim(coalesce(p_comment, '')), '')
  )
  on conflict (item_id, actor_user_id, published_version) do update
    set selected_option_id = excluded.selected_option_id,
        preferred_budget = excluded.preferred_budget,
        scope_decision = excluded.scope_decision,
        comment = excluded.comment,
        updated_at = now()
  returning id
  into v_response_id;

  return jsonb_build_object(
    'responseId', v_response_id,
    'clientViewId', v_client_view.id,
    'itemId', v_item.id,
    'publishedVersion', v_client_view.published_version
  );
end;
$$;

drop function if exists public.apply_client_view_response(uuid, uuid);
create or replace function public.apply_client_view_response(
  p_project_id uuid,
  p_response_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_response public.client_view_responses%rowtype;
  v_item public.client_view_items%rowtype;
  v_option public.client_view_item_options%rowtype;
  v_action text := 'none';
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_project_id is null or p_response_id is null then
    raise exception 'Project id and response id are required.';
  end if;

  if not exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = v_actor_user_id
      and pm.role in ('owner', 'editor')
  ) then
    raise exception 'You do not have permission to apply this client response.';
  end if;

  select *
  into v_response
  from public.client_view_responses cvr
  where cvr.id = p_response_id
  limit 1;

  if v_response.id is null then
    raise exception 'Client response not found.';
  end if;

  select *
  into v_item
  from public.client_view_items cvi
  where cvi.id = v_response.item_id
  limit 1;

  if v_item.id is null then
    raise exception 'Client view item not found.';
  end if;

  if not exists (
    select 1
    from public.client_views cv
    where cv.id = v_item.client_view_id
      and cv.project_id = p_project_id
  ) then
    raise exception 'Client response does not belong to this project.';
  end if;

  if v_item.card_mode = 'material_choice' and v_response.selected_option_id is not null then
    select *
    into v_option
    from public.client_view_item_options cvio
    where cvio.id = v_response.selected_option_id
      and cvio.item_id = v_item.id
    limit 1;

    if v_option.source_material_id is not null and v_item.room_object_id is not null then
      update public.room_objects
      set selected_material_id = v_option.source_material_id
      where id = v_item.room_object_id;
      v_action := 'selected_material_updated';
    end if;
  elsif v_item.card_mode = 'budget_input' and v_item.room_object_id is not null then
    update public.room_objects
    set budget_allowance = round(coalesce(v_response.preferred_budget, 0), 2)
    where id = v_item.room_object_id;
    v_action := 'budget_allowance_updated';
  elsif v_item.card_mode = 'scope_confirmation' then
    v_action := 'scope_response_recorded';
  end if;

  update public.client_view_responses
  set applied_at = now(),
      applied_by = v_actor_user_id,
      updated_at = now()
  where id = v_response.id;

  return jsonb_build_object(
    'responseId', v_response.id,
    'itemId', v_item.id,
    'action', v_action,
    'appliedAt', now()
  );
end;
$$;

revoke all on function public.publish_client_view(uuid, text, timestamptz, jsonb, jsonb) from public;
grant execute on function public.publish_client_view(uuid, text, timestamptz, jsonb, jsonb) to authenticated;
grant execute on function public.publish_client_view(uuid, text, timestamptz, jsonb, jsonb) to service_role;

revoke all on function public.get_published_client_view(text) from public;
grant execute on function public.get_published_client_view(text) to anon;
grant execute on function public.get_published_client_view(text) to authenticated;
grant execute on function public.get_published_client_view(text) to service_role;

revoke all on function public.get_client_view_submission_context(text) from public;
grant execute on function public.get_client_view_submission_context(text) to authenticated;
grant execute on function public.get_client_view_submission_context(text) to service_role;

revoke all on function public.submit_client_view_response(text, uuid, uuid, numeric, text, text) from public;
grant execute on function public.submit_client_view_response(text, uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.submit_client_view_response(text, uuid, uuid, numeric, text, text) to service_role;

revoke all on function public.apply_client_view_response(uuid, uuid) from public;
grant execute on function public.apply_client_view_response(uuid, uuid) to authenticated;
grant execute on function public.apply_client_view_response(uuid, uuid) to service_role;

