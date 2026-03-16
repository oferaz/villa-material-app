alter table public.room_objects
  add column if not exists quantity integer not null default 1;

update public.room_objects
set quantity = 1
where quantity is null or quantity <= 0;

alter table public.room_objects
  drop constraint if exists chk_room_objects_quantity_positive;

alter table public.room_objects
  add constraint chk_room_objects_quantity_positive
  check (quantity > 0);

