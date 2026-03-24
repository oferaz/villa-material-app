alter table public.client_views
  add column if not exists show_project_overview boolean not null default false;

alter table public.client_views
  add column if not exists show_house_overviews boolean not null default false;

alter table public.client_views
  add column if not exists project_overview jsonb not null default '{}'::jsonb;

alter table public.client_views
  add column if not exists house_overviews jsonb not null default '[]'::jsonb;

alter table public.client_views
  drop constraint if exists chk_client_views_project_overview_is_object;

alter table public.client_views
  add constraint chk_client_views_project_overview_is_object
  check (jsonb_typeof(project_overview) = 'object');

alter table public.client_views
  drop constraint if exists chk_client_views_house_overviews_is_array;

alter table public.client_views
  add constraint chk_client_views_house_overviews_is_array
  check (jsonb_typeof(house_overviews) = 'array');

drop function if exists public.publish_client_view(uuid, text, timestamptz, jsonb, jsonb);
create or replace function public.publish_client_view(
  p_project_id uuid,
  p_title text default null,
  p_expires_at timestamptz default null,
  p_recipient_emails jsonb default '[]'::jsonb,
  p_items jsonb default '[]'::jsonb,
  p_show_project_overview boolean default false,
  p_show_house_overviews boolean default false
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
  v_project_currency text;
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
  v_project_budget_total numeric(12,2);
  v_project_allocated_amount numeric(12,2) := 0;
  v_project_remaining_amount numeric(12,2);
  v_project_houses_count integer := 0;
  v_project_rooms_count integer := 0;
  v_project_items_count integer := 0;
  v_project_material_missing integer := 0;
  v_project_material_assigned integer := 0;
  v_project_po_approved integer := 0;
  v_project_ordered integer := 0;
  v_project_installed integer := 0;
  v_project_actions_completed integer := 0;
  v_project_actions_total integer := 0;
  v_project_actions_remaining integer := 0;
  v_project_completion_percent integer := 0;
  v_project_overview jsonb := '{}'::jsonb;
  v_house_overviews jsonb := '[]'::jsonb;
  v_house_record record;
  v_house_actions_completed integer;
  v_house_actions_total integer;
  v_house_actions_remaining integer;
  v_house_completion_percent integer;
  v_house_remaining_amount numeric(12,2);
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

  select p.name, p.currency
  into v_project_name, v_project_currency
  from public.projects p
  where p.id = p_project_id;

  if v_project_name is null then
    raise exception 'Project not found.';
  end if;

  if v_title is null then
    v_title := v_project_name || ' Client Review';
  end if;

  if p_show_project_overview or p_show_house_overviews then
    select count(*)
    into v_project_houses_count
    from public.houses h
    where h.project_id = p_project_id;

    select count(*)
    into v_project_rooms_count
    from public.rooms r
    join public.houses h on h.id = r.house_id
    where h.project_id = p_project_id;

    select
      coalesce(sum(case when ro.id is null then 0 else greatest(1, coalesce(ro.quantity, 1)) end), 0)::integer,
      coalesce(sum(case when ro.id is not null and ro.selected_material_id is null then greatest(1, coalesce(ro.quantity, 1)) else 0 end), 0)::integer,
      coalesce(sum(case when ro.id is not null and ro.selected_material_id is not null and not coalesce(ro.po_approved, false) then greatest(1, coalesce(ro.quantity, 1)) else 0 end), 0)::integer,
      coalesce(sum(case when ro.id is not null and coalesce(ro.po_approved, false) and not coalesce(ro.is_ordered, false) then greatest(1, coalesce(ro.quantity, 1)) else 0 end), 0)::integer,
      coalesce(sum(case when ro.id is not null and coalesce(ro.is_ordered, false) and not coalesce(ro.is_installed, false) then greatest(1, coalesce(ro.quantity, 1)) else 0 end), 0)::integer,
      coalesce(sum(case when ro.id is not null and coalesce(ro.is_installed, false) then greatest(1, coalesce(ro.quantity, 1)) else 0 end), 0)::integer,
      round(coalesce(sum(case when ro.id is null then 0 else coalesce(m.price, 0) * greatest(1, coalesce(ro.quantity, 1)) end), 0), 2)
    into
      v_project_items_count,
      v_project_material_missing,
      v_project_material_assigned,
      v_project_po_approved,
      v_project_ordered,
      v_project_installed,
      v_project_allocated_amount
    from public.houses h
    left join public.rooms r on r.house_id = h.id
    left join public.room_objects ro on ro.room_id = r.id
    left join public.materials m on m.id = ro.selected_material_id
    where h.project_id = p_project_id;

    select pb.total_budget, coalesce(pb.currency, v_project_currency)
    into v_project_budget_total, v_project_currency
    from public.project_budgets pb
    where pb.project_id = p_project_id;

    v_project_actions_completed :=
      v_project_material_assigned +
      (v_project_po_approved * 2) +
      (v_project_ordered * 3) +
      (v_project_installed * 4);
    v_project_actions_total := v_project_items_count * 4;
    v_project_actions_remaining := greatest(0, v_project_actions_total - v_project_actions_completed);
    v_project_completion_percent := case
      when v_project_actions_total > 0 then round((v_project_actions_completed::numeric / v_project_actions_total::numeric) * 100)
      else 0
    end;
    v_project_remaining_amount := case
      when v_project_budget_total is null then null
      else round(v_project_budget_total - v_project_allocated_amount, 2)
    end;

    if p_show_project_overview then
      v_project_overview := jsonb_build_object(
        'projectName', v_project_name,
        'housesCount', v_project_houses_count,
        'roomsCount', v_project_rooms_count,
        'itemsCount', v_project_items_count,
        'budget', jsonb_build_object(
          'totalBudget', v_project_budget_total,
          'allocatedAmount', v_project_allocated_amount,
          'remainingAmount', v_project_remaining_amount,
          'currency', v_project_currency
        ),
        'progress', jsonb_build_object(
          'totalItems', v_project_items_count,
          'completionPercent', v_project_completion_percent,
          'actionsCompleted', v_project_actions_completed,
          'actionsTotal', v_project_actions_total,
          'actionsRemaining', v_project_actions_remaining,
          'stages', jsonb_build_object(
            'materialMissing', v_project_material_missing,
            'materialAssigned', v_project_material_assigned,
            'poApproved', v_project_po_approved,
            'ordered', v_project_ordered,
            'installed', v_project_installed
          )
        )
      );
    end if;

    if p_show_house_overviews then
      for v_house_record in
        select
          h.id as house_id,
          h.name as house_name,
          count(distinct r.id)::integer as rooms_count,
          coalesce(sum(case when ro.id is null then 0 else greatest(1, coalesce(ro.quantity, 1)) end), 0)::integer as items_count,
          phb.total_budget as total_budget,
          round(coalesce(sum(case when ro.id is null then 0 else coalesce(m.price, 0) * greatest(1, coalesce(ro.quantity, 1)) end), 0), 2) as allocated_amount,
          coalesce(sum(case when ro.id is not null and ro.selected_material_id is null then greatest(1, coalesce(ro.quantity, 1)) else 0 end), 0)::integer as material_missing,
          coalesce(sum(case when ro.id is not null and ro.selected_material_id is not null and not coalesce(ro.po_approved, false) then greatest(1, coalesce(ro.quantity, 1)) else 0 end), 0)::integer as material_assigned,
          coalesce(sum(case when ro.id is not null and coalesce(ro.po_approved, false) and not coalesce(ro.is_ordered, false) then greatest(1, coalesce(ro.quantity, 1)) else 0 end), 0)::integer as po_approved,
          coalesce(sum(case when ro.id is not null and coalesce(ro.is_ordered, false) and not coalesce(ro.is_installed, false) then greatest(1, coalesce(ro.quantity, 1)) else 0 end), 0)::integer as ordered,
          coalesce(sum(case when ro.id is not null and coalesce(ro.is_installed, false) then greatest(1, coalesce(ro.quantity, 1)) else 0 end), 0)::integer as installed
        from public.houses h
        left join public.rooms r on r.house_id = h.id
        left join public.room_objects ro on ro.room_id = r.id
        left join public.materials m on m.id = ro.selected_material_id
        left join public.project_house_budgets phb on phb.project_id = p_project_id and phb.house_id = h.id
        where h.project_id = p_project_id
        group by h.id, h.name, phb.total_budget
        order by h.name asc
      loop
        v_house_actions_completed :=
          v_house_record.material_assigned +
          (v_house_record.po_approved * 2) +
          (v_house_record.ordered * 3) +
          (v_house_record.installed * 4);
        v_house_actions_total := v_house_record.items_count * 4;
        v_house_actions_remaining := greatest(0, v_house_actions_total - v_house_actions_completed);
        v_house_completion_percent := case
          when v_house_actions_total > 0 then round((v_house_actions_completed::numeric / v_house_actions_total::numeric) * 100)
          else 0
        end;
        v_house_remaining_amount := case
          when v_house_record.total_budget is null then null
          else round(v_house_record.total_budget - v_house_record.allocated_amount, 2)
        end;

        v_house_overviews := v_house_overviews || jsonb_build_array(
          jsonb_build_object(
            'houseId', v_house_record.house_id,
            'houseName', v_house_record.house_name,
            'roomsCount', v_house_record.rooms_count,
            'itemsCount', v_house_record.items_count,
            'budget', jsonb_build_object(
              'totalBudget', v_house_record.total_budget,
              'allocatedAmount', v_house_record.allocated_amount,
              'remainingAmount', v_house_remaining_amount,
              'currency', v_project_currency
            ),
            'progress', jsonb_build_object(
              'totalItems', v_house_record.items_count,
              'completionPercent', v_house_completion_percent,
              'actionsCompleted', v_house_actions_completed,
              'actionsTotal', v_house_actions_total,
              'actionsRemaining', v_house_actions_remaining,
              'stages', jsonb_build_object(
                'materialMissing', v_house_record.material_missing,
                'materialAssigned', v_house_record.material_assigned,
                'poApproved', v_house_record.po_approved,
                'ordered', v_house_record.ordered,
                'installed', v_house_record.installed
              )
            )
          )
        );
      end loop;
    end if;
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
      created_by,
      show_project_overview,
      show_house_overviews,
      project_overview,
      house_overviews
    )
    values (
      p_project_id,
      v_title,
      'published',
      v_token_hash,
      1,
      now(),
      p_expires_at,
      v_actor_user_id,
      p_show_project_overview,
      p_show_house_overviews,
      case when p_show_project_overview then v_project_overview else '{}'::jsonb end,
      case when p_show_house_overviews then v_house_overviews else '[]'::jsonb end
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
        show_project_overview = p_show_project_overview,
        show_house_overviews = p_show_house_overviews,
        project_overview = case when p_show_project_overview then v_project_overview else '{}'::jsonb end,
        house_overviews = case when p_show_house_overviews then v_house_overviews else '[]'::jsonb end,
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
    'expiresAt', v_client_view.expires_at,
    'showProjectOverview', v_client_view.show_project_overview,
    'showHouseOverviews', v_client_view.show_house_overviews
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
    'showProjectOverview', v_client_view.show_project_overview,
    'showHouseOverviews', v_client_view.show_house_overviews,
    'projectOverview', case when v_client_view.show_project_overview then v_client_view.project_overview else null end,
    'houseOverviews', case when v_client_view.show_house_overviews then v_client_view.house_overviews else '[]'::jsonb end,
    'items', coalesce(v_items, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.publish_client_view(uuid, text, timestamptz, jsonb, jsonb, boolean, boolean) from public;
grant execute on function public.publish_client_view(uuid, text, timestamptz, jsonb, jsonb, boolean, boolean) to authenticated;
grant execute on function public.publish_client_view(uuid, text, timestamptz, jsonb, jsonb, boolean, boolean) to service_role;

revoke all on function public.get_published_client_view(text) from public;
grant execute on function public.get_published_client_view(text) to anon;
grant execute on function public.get_published_client_view(text) to authenticated;
grant execute on function public.get_published_client_view(text) to service_role;
