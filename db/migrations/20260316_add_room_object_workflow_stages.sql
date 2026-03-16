alter table public.room_objects
  add column if not exists po_approved boolean not null default false;

alter table public.room_objects
  add column if not exists is_ordered boolean not null default false;

alter table public.room_objects
  add column if not exists is_installed boolean not null default false;

alter table public.room_objects
  drop constraint if exists chk_room_objects_order_requires_po_approved;

alter table public.room_objects
  add constraint chk_room_objects_order_requires_po_approved
  check (not is_ordered or po_approved);

alter table public.room_objects
  drop constraint if exists chk_room_objects_install_requires_ordered;

alter table public.room_objects
  add constraint chk_room_objects_install_requires_ordered
  check (not is_installed or is_ordered);

