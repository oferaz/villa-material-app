create or replace function public.create_project_with_owner_membership(
  p_name text,
  p_client_name text default null,
  p_location text default null,
  p_currency text default 'USD',
  p_house_names text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_project_id uuid;
  v_currency text;
  v_house_name text;
  v_house_sort integer := 0;
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
    foreach v_house_name in array p_house_names loop
      v_house_name := btrim(coalesce(v_house_name, ''));
      if v_house_name <> '' then
        insert into public.houses (project_id, name, sort_order)
        values (v_project_id, v_house_name, v_house_sort);
        v_house_sort := v_house_sort + 1;
      end if;
    end loop;
  end if;

  return v_project_id;
end;
$$;

revoke all on function public.create_project_with_owner_membership(text, text, text, text, text[]) from public;
grant execute on function public.create_project_with_owner_membership(text, text, text, text, text[]) to authenticated;
grant execute on function public.create_project_with_owner_membership(text, text, text, text, text[]) to service_role;
