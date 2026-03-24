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
      raise exception 'Please choose one of the material options shown before saving your response.';
    end if;

    if not exists (
      select 1
      from public.client_view_item_options cvio
      where cvio.id = p_selected_option_id
        and cvio.item_id = v_item.id
    ) then
      raise exception 'Please choose one of the material options shown for this item.';
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

revoke all on function public.submit_client_view_response(text, uuid, uuid, numeric, text, text) from public;
grant execute on function public.submit_client_view_response(text, uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.submit_client_view_response(text, uuid, uuid, numeric, text, text) to service_role;
