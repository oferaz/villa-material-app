alter table public.materials
  add column if not exists tags jsonb not null default '[]'::jsonb;

update public.materials
set tags = '[]'::jsonb
where tags is null;

alter table public.materials
  alter column tags set default '[]'::jsonb;

alter table public.materials
  alter column tags set not null;

alter table public.materials
  drop constraint if exists chk_materials_tags_is_array;

alter table public.materials
  add constraint chk_materials_tags_is_array
  check (jsonb_typeof(tags) = 'array');
