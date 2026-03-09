-- Relational purchasing/project management model for Materia.
-- This migration is additive and keeps legacy tables for phased rollout.

create extension if not exists pgcrypto;

-- Shared helper to keep updated_at current.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Controlled category mapping helper for migration and validation.
create or replace function public.normalize_project_item_category(raw_value text)
returns text
language sql
immutable
as $$
  select case
    when raw_value is null or btrim(raw_value) = '' then 'other'
    when lower(raw_value) in ('sanitary', 'bathroom', 'plumbing') then 'sanitary'
    when lower(raw_value) in ('tile', 'tiles') then 'tiles'
    when lower(raw_value) in ('furniture', 'furnishing') then 'furniture'
    when lower(raw_value) in ('lighting', 'light') then 'lighting'
    when lower(raw_value) in ('paint', 'coating') then 'paint'
    when lower(raw_value) in ('kitchen', 'cabinetry') then 'kitchen'
    when lower(raw_value) in ('appliance', 'appliances') then 'appliances'
    when lower(raw_value) in ('decor', 'decoration', 'accessories') then 'decor'
    when lower(raw_value) in ('outdoor', 'exterior', 'garden') then 'outdoor'
    when lower(raw_value) in ('hardware', 'fixture') then 'hardware'
    else 'other'
  end;
$$;

create or replace function public.normalize_room_type(raw_value text)
returns text
language sql
immutable
as $$
  select case
    when raw_value is null or btrim(raw_value) = '' then 'custom'
    when lower(raw_value) like '%bath%' then 'bathroom'
    when lower(raw_value) like '%kitchen%' then 'kitchen'
    when lower(raw_value) like '%bed%' then 'bedroom'
    when lower(raw_value) like '%living%' then 'living_room'
    when lower(raw_value) like '%outdoor%' or lower(raw_value) like '%terrace%' or lower(raw_value) like '%garden%' then 'outdoor'
    else 'custom'
  end;
$$;

-- Projects extensions (existing table retained).
alter table if exists public.projects
  add column if not exists client_name text;

alter table if exists public.projects
  add column if not exists currency text not null default 'THB';

alter table if exists public.projects
  add column if not exists created_by uuid;

alter table if exists public.projects
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.projects
  add column if not exists updated_at timestamptz not null default now();

-- Ensure projects.id is referenceable by foreign keys (must be UNIQUE/PRIMARY KEY).
do $$
declare
  has_id_column boolean;
  has_id_key boolean;
  has_null_id boolean;
  has_duplicate_id boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'id'
  ) into has_id_column;

  if not has_id_column then
    raise exception 'public.projects.id is missing. Cannot create foreign keys to projects.';
  end if;

  select exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'projects'
      and c.contype in ('p', 'u')
      and array_length(c.conkey, 1) = 1
      and c.conkey[1] = (
        select attnum::smallint
        from pg_attribute
        where attrelid = t.oid
          and attname = 'id'
      )
  ) into has_id_key;

  if not has_id_key then
    execute 'select exists (select 1 from public.projects where id is null)' into has_null_id;
    execute 'select exists (select 1 from public.projects group by id having count(*) > 1)' into has_duplicate_id;

    if has_null_id then
      raise exception 'public.projects.id contains NULL values. Clean data before applying relational migration.';
    end if;
    if has_duplicate_id then
      raise exception 'public.projects.id contains duplicates. Clean data before applying relational migration.';
    end if;

    alter table public.projects
      add constraint projects_id_unique unique (id);
  end if;
end $$;

drop trigger if exists trg_projects_touch_updated_at on public.projects;
create trigger trg_projects_touch_updated_at
before update on public.projects
for each row execute function public.touch_updated_at();

-- Suppliers master.
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  line text,
  whatsapp text,
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_suppliers_name_ci
  on public.suppliers (lower(name));

-- Source catalog (global reusable references).
create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null check (
    category in ('sanitary', 'tiles', 'furniture', 'lighting', 'paint', 'kitchen', 'appliances', 'decor', 'outdoor', 'hardware', 'other')
  ),
  default_price numeric,
  currency text not null default 'THB',
  supplier_id uuid references public.suppliers(id) on delete set null,
  url text,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_catalog_items_touch_updated_at on public.catalog_items;
create trigger trg_catalog_items_touch_updated_at
before update on public.catalog_items
for each row execute function public.touch_updated_at();

create index if not exists idx_catalog_items_supplier_id
  on public.catalog_items (supplier_id);

create index if not exists idx_catalog_items_category
  on public.catalog_items (category);

-- Rooms per project.
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  type text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint uq_rooms_project_name unique (project_id, name)
);

create index if not exists idx_rooms_project_id
  on public.rooms (project_id);

create index if not exists idx_rooms_project_sort
  on public.rooms (project_id, sort_order, name);

-- Core purchasing line-item table.
create table if not exists public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  catalog_item_id uuid references public.catalog_items(id) on delete set null,
  name text not null,
  category text not null check (
    category in ('sanitary', 'tiles', 'furniture', 'lighting', 'paint', 'kitchen', 'appliances', 'decor', 'outdoor', 'hardware', 'other')
  ),
  supplier_id uuid references public.suppliers(id) on delete set null,
  spec text,
  quantity numeric not null default 1 check (quantity > 0),
  unit text,
  unit_price numeric,
  currency text not null default 'THB',
  discount_pct numeric not null default 0,
  tax_pct numeric not null default 0,
  status text not null default 'draft' check (status in ('draft', 'quoted', 'approved', 'ordered', 'delivered', 'paid')),
  priority text,
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_project_items_touch_updated_at on public.project_items;
create trigger trg_project_items_touch_updated_at
before update on public.project_items
for each row execute function public.touch_updated_at();

create index if not exists idx_project_items_project_id
  on public.project_items (project_id);

create index if not exists idx_project_items_room_id
  on public.project_items (room_id);

create index if not exists idx_project_items_supplier_id
  on public.project_items (supplier_id);

create index if not exists idx_project_items_category
  on public.project_items (category);

create index if not exists idx_project_items_project_status
  on public.project_items (project_id, status);

-- Optional templates for automatic room checklists.
create table if not exists public.room_templates (
  id uuid primary key default gen_random_uuid(),
  room_type text not null,
  category text not null check (
    category in ('sanitary', 'tiles', 'furniture', 'lighting', 'paint', 'kitchen', 'appliances', 'decor', 'outdoor', 'hardware', 'other')
  ),
  name text not null,
  default_unit text,
  default_qty numeric,
  required boolean not null default true,
  sort_order integer not null default 0
);

create index if not exists idx_room_templates_room_type
  on public.room_templates (room_type, sort_order);

-- Minimal seed template rows (idempotent via unique predicate on logical key).
create unique index if not exists idx_room_templates_unique_logical
  on public.room_templates (room_type, lower(name), category);

insert into public.room_templates (room_type, category, name, default_unit, default_qty, required, sort_order)
values
  ('bathroom', 'sanitary', 'Toilet', 'pcs', 1, true, 10),
  ('bathroom', 'sanitary', 'Sink', 'pcs', 1, true, 20),
  ('bathroom', 'sanitary', 'Faucet', 'pcs', 1, true, 30),
  ('bathroom', 'sanitary', 'Shower Mixer', 'pcs', 1, true, 40),
  ('bathroom', 'tiles', 'Wall Tiles', 'sqm', null, true, 50),
  ('bathroom', 'tiles', 'Floor Tiles', 'sqm', null, true, 60),
  ('bathroom', 'decor', 'Mirror', 'pcs', 1, true, 70),
  ('kitchen', 'sanitary', 'Sink', 'pcs', 1, true, 10),
  ('kitchen', 'sanitary', 'Faucet', 'pcs', 1, true, 20),
  ('kitchen', 'kitchen', 'Countertop', 'set', 1, true, 30),
  ('kitchen', 'tiles', 'Backsplash', 'sqm', null, false, 40),
  ('kitchen', 'appliances', 'Oven', 'pcs', 1, false, 50),
  ('kitchen', 'appliances', 'Cooktop', 'pcs', 1, false, 60),
  ('kitchen', 'appliances', 'Fridge', 'pcs', 1, false, 70)
on conflict do nothing;
