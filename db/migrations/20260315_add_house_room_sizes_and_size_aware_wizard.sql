alter table public.houses
  add column if not exists size_sq_m numeric(10,2);

alter table public.rooms
  add column if not exists size_sq_m numeric(10,2);

drop function if exists public.create_project_with_owner_membership(text, text, text, text, text[], numeric[]);

create or replace function public.create_project_with_owner_membership(
  p_name text,
  p_client_name text default null,
  p_location text default null,
  p_currency text default 'USD',
  p_house_names text[] default '{}'::text[],
  p_house_sizes numeric[] default '{}'::numeric[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_project_id uuid;
  v_house_id uuid;
  v_currency text;
  v_house_name text;
  v_house_sort integer := 0;
  v_house_index integer;
  v_house_size numeric;
  v_default_room_names text[] := array['Entry', 'Living Room', 'Kitchen', 'Dining Room', 'Bedroom', 'Bathroom'];
  v_default_room_types text[] := array['entry', 'living_room', 'kitchen', 'dining_room', 'bedroom', 'bathroom'];
  v_room_index integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Project name is required';
  end if;

  v_currency := coalesce(nullif(btrim(coalesce(p_currency, '')), ''), 'USD');

  insert into public.profiles (id)
  values (v_user_id)
  on conflict (id) do nothing;

  insert into public.projects (name, client_name, location, currency, created_by)
  values (
    btrim(p_name),
    nullif(btrim(coalesce(p_client_name, '')), ''),
    nullif(btrim(coalesce(p_location, '')), ''),
    v_currency,
    v_user_id
  )
  returning id into v_project_id;

  insert into public.project_members (project_id, user_id, role)
  values (v_project_id, v_user_id, 'owner')
  on conflict (project_id, user_id) do nothing;

  insert into public.project_budgets (project_id, total_budget, currency)
  values (v_project_id, 0, v_currency)
  on conflict (project_id) do nothing;

  if p_house_names is not null then
    for v_house_index in 1 .. coalesce(array_length(p_house_names, 1), 0) loop
      v_house_name := btrim(coalesce(p_house_names[v_house_index], ''));
      v_house_size := null;

      if p_house_sizes is not null and coalesce(array_length(p_house_sizes, 1), 0) >= v_house_index then
        v_house_size := p_house_sizes[v_house_index];
      end if;

      if v_house_size is not null and v_house_size <= 0 then
        v_house_size := null;
      end if;

      if v_house_name <> '' then
        insert into public.houses (project_id, name, size_sq_m, sort_order)
        values (v_project_id, v_house_name, v_house_size, v_house_sort)
        returning id into v_house_id;

        for v_room_index in 1 .. array_length(v_default_room_names, 1) loop
          insert into public.rooms (house_id, name, room_type, sort_order)
          values (
            v_house_id,
            v_default_room_names[v_room_index],
            v_default_room_types[v_room_index],
            v_room_index - 1
          );
        end loop;

        v_house_sort := v_house_sort + 1;
      end if;
    end loop;
  end if;

  if v_house_sort = 0 then
    insert into public.houses (project_id, name, sort_order)
    values (v_project_id, 'Main House', 0)
    returning id into v_house_id;

    for v_room_index in 1 .. array_length(v_default_room_names, 1) loop
      insert into public.rooms (house_id, name, room_type, sort_order)
      values (
        v_house_id,
        v_default_room_names[v_room_index],
        v_default_room_types[v_room_index],
        v_room_index - 1
      );
    end loop;
  end if;

  return v_project_id;
end;
$$;

revoke all on function public.create_project_with_owner_membership(text, text, text, text, text[], numeric[]) from public;
grant execute on function public.create_project_with_owner_membership(text, text, text, text, text[], numeric[]) to authenticated;
grant execute on function public.create_project_with_owner_membership(text, text, text, text, text[], numeric[]) to service_role;
