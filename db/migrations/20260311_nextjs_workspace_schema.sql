-- Fresh Supabase schema for the Next.js Materia workspace.
-- This is intended for a new Supabase project, not as an in-place migration
-- on top of the legacy Streamlit database.

create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_touch_updated_at on public.profiles;
create trigger trg_profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_name text,
  location text,
  currency text not null default 'USD',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_projects_touch_updated_at on public.projects;
create trigger trg_projects_touch_updated_at
before update on public.projects
for each row execute function public.touch_updated_at();

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists idx_project_members_user_id
  on public.project_members (user_id);

create table if not exists public.houses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  size_sq_m numeric(10,2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_houses_touch_updated_at on public.houses;
create trigger trg_houses_touch_updated_at
before update on public.houses
for each row execute function public.touch_updated_at();

create index if not exists idx_houses_project_sort
  on public.houses (project_id, sort_order, name);

create unique index if not exists idx_houses_project_name_ci
  on public.houses (project_id, lower(name));

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  name text not null,
  size_sq_m numeric(10,2),
  room_type text not null check (
    room_type in ('living_room', 'kitchen', 'bathroom', 'bedroom', 'dining_room', 'entry', 'office', 'laundry', 'outdoor')
  ),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_rooms_touch_updated_at on public.rooms;
create trigger trg_rooms_touch_updated_at
before update on public.rooms
for each row execute function public.touch_updated_at();

create index if not exists idx_rooms_house_sort
  on public.rooms (house_id, sort_order, name);

create unique index if not exists idx_rooms_house_name_ci
  on public.rooms (house_id, lower(name));

create table if not exists public.room_objects (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  category text not null,
  material_search_query text,
  selected_material_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_room_objects_touch_updated_at on public.room_objects;
create trigger trg_room_objects_touch_updated_at
before update on public.room_objects
for each row execute function public.touch_updated_at();

create index if not exists idx_room_objects_room_sort
  on public.room_objects (room_id, sort_order, name);

create unique index if not exists idx_room_objects_room_name_ci
  on public.room_objects (room_id, lower(name));

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  supplier_name text,
  name text not null,
  description text,
  budget_category text not null check (
    budget_category in ('Furniture', 'Lighting', 'Tiles', 'Bathroom', 'Kitchen', 'Decor')
  ),
  price numeric(12,2),
  currency text not null default 'USD',
  lead_time_days integer,
  sku text,
  source_type text not null default 'catalog' check (source_type in ('catalog', 'link', 'manual')),
  source_url text,
  is_private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_materials_touch_updated_at on public.materials;
create trigger trg_materials_touch_updated_at
before update on public.materials
for each row execute function public.touch_updated_at();

create index if not exists idx_materials_owner_budget_category
  on public.materials (owner_user_id, budget_category);

create index if not exists idx_materials_owner_name
  on public.materials (owner_user_id, lower(name));

create index if not exists idx_materials_owner_search
  on public.materials
  using gin (
    to_tsvector(
      'simple',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(supplier_name, '') || ' ' ||
      coalesce(sku, '')
    )
  );

create table if not exists public.material_images (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_material_images_material_sort
  on public.material_images (material_id, sort_order);

alter table public.room_objects
  drop constraint if exists room_objects_selected_material_id_fkey;

alter table public.room_objects
  add constraint room_objects_selected_material_id_fkey
  foreign key (selected_material_id)
  references public.materials(id)
  on delete set null;

create table if not exists public.project_budgets (
  project_id uuid primary key references public.projects(id) on delete cascade,
  total_budget numeric(12,2) not null default 0,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_project_budgets_touch_updated_at on public.project_budgets;
create trigger trg_project_budgets_touch_updated_at
before update on public.project_budgets
for each row execute function public.touch_updated_at();

create table if not exists public.project_budget_categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category_name text not null check (
    category_name in ('Furniture', 'Lighting', 'Tiles', 'Bathroom', 'Kitchen', 'Decor')
  ),
  total_budget numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_project_budget_categories_project_category unique (project_id, category_name)
);

drop trigger if exists trg_project_budget_categories_touch_updated_at on public.project_budget_categories;
create trigger trg_project_budget_categories_touch_updated_at
before update on public.project_budget_categories
for each row execute function public.touch_updated_at();

create view public.project_budget_allocations as
select
  pbc.project_id,
  pbc.category_name,
  pbc.total_budget,
  coalesce(sum(m.price), 0)::numeric(12,2) as allocated_amount,
  (pbc.total_budget - coalesce(sum(m.price), 0))::numeric(12,2) as remaining_amount
from public.project_budget_categories pbc
left join public.houses h on h.project_id = pbc.project_id
left join public.rooms r on r.house_id = h.id
left join public.room_objects ro on ro.room_id = r.id
left join public.materials m
  on m.id = ro.selected_material_id
 and m.budget_category = pbc.category_name
group by pbc.project_id, pbc.category_name, pbc.total_budget;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.houses enable row level security;
alter table public.rooms enable row level security;
alter table public.room_objects enable row level security;
alter table public.materials enable row level security;
alter table public.material_images enable row level security;
alter table public.project_budgets enable row level security;
alter table public.project_budget_categories enable row level security;

create policy "profiles_self_select"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_self_update"
on public.profiles
for update
using (auth.uid() = id);

create policy "projects_select_member_access"
on public.projects
for select
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = projects.id
      and pm.user_id = auth.uid()
  )
);

create policy "projects_insert_owner"
on public.projects
for insert
with check (created_by = auth.uid());

create policy "projects_update_editor_access"
on public.projects
for update
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = projects.id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
);

create policy "projects_delete_owner_access"
on public.projects
for delete
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = projects.id
      and pm.user_id = auth.uid()
      and pm.role = 'owner'
  )
);

create policy "project_members_member_access"
on public.project_members
for select
using (project_members.user_id = auth.uid());

create policy "houses_member_access"
on public.houses
for all
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = houses.project_id
      and pm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = houses.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
);

create policy "rooms_member_access"
on public.rooms
for all
using (
  exists (
    select 1
    from public.houses h
    join public.project_members pm on pm.project_id = h.project_id
    where h.id = rooms.house_id
      and pm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.houses h
    join public.project_members pm on pm.project_id = h.project_id
    where h.id = rooms.house_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
);

create policy "room_objects_member_access"
on public.room_objects
for all
using (
  exists (
    select 1
    from public.rooms r
    join public.houses h on h.id = r.house_id
    join public.project_members pm on pm.project_id = h.project_id
    where r.id = room_objects.room_id
      and pm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.rooms r
    join public.houses h on h.id = r.house_id
    join public.project_members pm on pm.project_id = h.project_id
    where r.id = room_objects.room_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
);

create policy "materials_owner_access"
on public.materials
for all
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy "material_images_owner_access"
on public.material_images
for all
using (
  exists (
    select 1
    from public.materials m
    where m.id = material_images.material_id
      and m.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.materials m
    where m.id = material_images.material_id
      and m.owner_user_id = auth.uid()
  )
);

create policy "project_budgets_member_access"
on public.project_budgets
for all
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_budgets.project_id
      and pm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_budgets.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
);

create policy "project_budget_categories_member_access"
on public.project_budget_categories
for all
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_budget_categories.project_id
      and pm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_budget_categories.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor')
  )
);
