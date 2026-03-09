-- Best-effort legacy migration from:
--   project_rooms / room_objects / materials / projects.cart JSON
-- into:
--   rooms / suppliers / catalog_items / project_items

create table if not exists public.legacy_migration_log (
  id bigserial primary key,
  project_id uuid,
  source text not null,
  message text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- 1) Backfill rooms from legacy project_rooms.
do $$
begin
  if to_regclass('public.project_rooms') is not null then
    insert into public.rooms (project_id, name, type, sort_order)
    select
      pr.project_id,
      pr.name,
      public.normalize_room_type(pr.name),
      row_number() over (partition by pr.project_id order by pr.name) - 1
    from public.project_rooms pr
    left join public.rooms r
      on r.project_id = pr.project_id
     and lower(r.name) = lower(pr.name)
    where r.id is null;
  end if;
end $$;

-- 2) Backfill suppliers from legacy materials.
do $$
begin
  if to_regclass('public.materials') is not null then
    insert into public.suppliers (name)
    select distinct supplier_name
    from (
      select nullif(
        btrim(
          coalesce(
            to_jsonb(m) ->> 'supplier',
            to_jsonb(m) ->> 'supplier_name'
          )
        ),
        ''
      ) as supplier_name
      from public.materials m
    ) src
    where supplier_name is not null
    on conflict do nothing;
  end if;
end $$;

-- 3) Backfill catalog items from legacy materials.
do $$
begin
  if to_regclass('public.materials') is not null then
    insert into public.catalog_items (
      name,
      description,
      category,
      default_price,
      currency,
      supplier_id,
      url,
      image_url,
      active
    )
    select
      coalesce(nullif(btrim(to_jsonb(m) ->> 'name'), ''), 'Unnamed Catalog Item'),
      nullif(btrim(to_jsonb(m) ->> 'description'), ''),
      public.normalize_project_item_category(to_jsonb(m) ->> 'category'),
      case
        when coalesce(to_jsonb(m) ->> 'price', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
          then (to_jsonb(m) ->> 'price')::numeric
        else null
      end,
      coalesce(nullif(btrim(to_jsonb(m) ->> 'currency'), ''), 'THB'),
      s.id,
      nullif(btrim(to_jsonb(m) ->> 'link'), ''),
      nullif(btrim(to_jsonb(m) ->> 'image_url'), ''),
      true
    from public.materials m
    left join public.suppliers s
      on lower(s.name) = lower(
        coalesce(
          nullif(btrim(to_jsonb(m) ->> 'supplier'), ''),
          nullif(btrim(to_jsonb(m) ->> 'supplier_name'), '')
        )
      )
    where not exists (
      select 1
      from public.catalog_items ci
      where lower(ci.name) = lower(coalesce(nullif(btrim(to_jsonb(m) ->> 'name'), ''), 'Unnamed Catalog Item'))
        and coalesce(ci.url, '') = coalesce(nullif(btrim(to_jsonb(m) ->> 'link'), ''), '')
    );
  end if;
end $$;

-- 4) Backfill project_items from room_objects snapshots.
do $$
begin
  if to_regclass('public.room_objects') is not null and to_regclass('public.project_rooms') is not null then
    insert into public.project_items (
      project_id,
      room_id,
      name,
      category,
      supplier_id,
      spec,
      quantity,
      unit,
      unit_price,
      currency,
      status,
      priority,
      notes
    )
    select
      pr.project_id,
      r.id,
      coalesce(nullif(btrim(ro.object_name), ''), coalesce(nullif(btrim(to_jsonb(m) ->> 'name'), ''), 'Unnamed Project Item')),
      public.normalize_project_item_category(coalesce(nullif(btrim(to_jsonb(m) ->> 'category'), ''), ro.category)),
      s.id,
      nullif(btrim(coalesce(to_jsonb(m) ->> 'description', ro.object_key)), ''),
      greatest(coalesce(ro.qty, 1), 1),
      nullif(btrim(to_jsonb(m) ->> 'unit'), ''),
      case
        when coalesce(to_jsonb(m) ->> 'price', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
          then (to_jsonb(m) ->> 'price')::numeric
        else null
      end,
      coalesce(nullif(btrim(to_jsonb(m) ->> 'currency'), ''), coalesce(nullif(btrim(p.currency), ''), 'THB')),
      case lower(coalesce(ro.status, 'draft'))
        when 'client_approved' then 'approved'
        when 'designer_approved' then 'approved'
        when 'selected' then 'quoted'
        when 'ordered' then 'ordered'
        when 'delivered' then 'delivered'
        when 'paid' then 'paid'
        else 'draft'
      end,
      nullif(lower(p.cart -> 'procurement' -> 'priority' ->> (ro.id::text)), ''),
      nullif(
        btrim(
          concat_ws(
            E'\n',
            p.cart -> 'assignment_notes' ->> (ro.id::text),
            p.cart -> 'procurement' -> 'notes' ->> (ro.id::text)
          )
        ),
        ''
      )
    from public.room_objects ro
    join public.project_rooms pr on pr.id = ro.room_id
    join public.projects p on p.id = pr.project_id
    left join public.rooms r
      on r.project_id = pr.project_id
     and lower(r.name) = lower(pr.name)
    left join public.materials m on m.id = ro.material_id
    left join public.suppliers s
      on lower(s.name) = lower(
        coalesce(
          nullif(btrim(to_jsonb(m) ->> 'supplier'), ''),
          nullif(btrim(to_jsonb(m) ->> 'supplier_name'), '')
        )
      )
    where not exists (
      select 1
      from public.project_items pi
      where pi.project_id = pr.project_id
        and coalesce(pi.room_id::text, '') = coalesce(r.id::text, '')
        and lower(pi.name) = lower(
          coalesce(nullif(btrim(ro.object_name), ''), coalesce(nullif(btrim(to_jsonb(m) ->> 'name'), ''), 'Unnamed Project Item'))
        )
        and abs(coalesce(pi.quantity, 1) - greatest(coalesce(ro.qty, 1), 1)) < 0.0001
    );
  end if;
end $$;

-- 5) Backfill project_items from legacy projects.cart JSON items.
with project_cart_items as (
  select
    p.id as project_id,
    coalesce(nullif(btrim(p.currency), ''), 'THB') as project_currency,
    elem as item_payload
  from public.projects p
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(p.cart) = 'array' then p.cart
      when jsonb_typeof(p.cart -> 'items') = 'array' then p.cart -> 'items'
      else '[]'::jsonb
    end
  ) elem
),
normalized_items as (
  select
    pci.project_id,
    pci.project_currency,
    pci.item_payload,
    nullif(btrim(coalesce(
      pci.item_payload ->> 'name',
      pci.item_payload ->> 'product_name',
      pci.item_payload ->> 'title'
    )), '') as item_name,
    public.normalize_project_item_category(
      coalesce(
        nullif(btrim(pci.item_payload ->> 'category'), ''),
        nullif(btrim(pci.item_payload ->> 'type'), ''),
        'other'
      )
    ) as item_category,
    nullif(btrim(coalesce(
      pci.item_payload ->> 'supplier',
      pci.item_payload ->> 'supplier_name'
    )), '') as supplier_name,
    nullif(btrim(pci.item_payload ->> 'room'), '') as room_name,
    case
      when coalesce(pci.item_payload ->> 'quantity', pci.item_payload ->> 'qty', '') ~ '^[0-9]+(\.[0-9]+)?$'
        then greatest((coalesce(pci.item_payload ->> 'quantity', pci.item_payload ->> 'qty'))::numeric, 1)
      else 1
    end as quantity_value,
    case
      when coalesce(pci.item_payload ->> 'price', pci.item_payload ->> 'unit_price', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
        then (coalesce(pci.item_payload ->> 'price', pci.item_payload ->> 'unit_price'))::numeric
      else null
    end as unit_price_value
  from project_cart_items pci
)
insert into public.project_items (
  project_id,
  room_id,
  name,
  category,
  supplier_id,
  spec,
  quantity,
  unit,
  unit_price,
  currency,
  status,
  notes
)
select
  ni.project_id,
  r.id,
  coalesce(ni.item_name, 'Unnamed Project Item'),
  ni.item_category,
  s.id,
  nullif(btrim(ni.item_payload ->> 'spec'), ''),
  ni.quantity_value,
  nullif(btrim(ni.item_payload ->> 'unit'), ''),
  ni.unit_price_value,
  coalesce(nullif(btrim(ni.item_payload ->> 'currency'), ''), ni.project_currency, 'THB'),
  case lower(coalesce(ni.item_payload ->> 'status', 'draft'))
    when 'quoted' then 'quoted'
    when 'approved' then 'approved'
    when 'ordered' then 'ordered'
    when 'delivered' then 'delivered'
    when 'paid' then 'paid'
    else 'draft'
  end,
  nullif(
    btrim(
      concat_ws(
        E'\n',
        ni.item_payload ->> 'notes',
        ni.item_payload ->> 'note',
        ni.item_payload ->> 'description'
      )
    ),
    ''
  )
from normalized_items ni
left join public.suppliers s on lower(s.name) = lower(ni.supplier_name)
left join public.rooms r
  on r.project_id = ni.project_id
 and lower(r.name) = lower(coalesce(ni.room_name, ''))
where ni.item_name is not null
  and not exists (
    select 1
    from public.project_items pi
    where pi.project_id = ni.project_id
      and lower(pi.name) = lower(ni.item_name)
      and coalesce(pi.room_id::text, '') = coalesce(r.id::text, '')
  );

-- 6) Log unmatched cart rows.
insert into public.legacy_migration_log (project_id, source, message, payload)
select
  ni.project_id,
  'projects.cart',
  'Skipped cart item because name/title was missing',
  ni.item_payload
from (
  select
    p.id as project_id,
    elem as item_payload
  from public.projects p
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(p.cart) = 'array' then p.cart
      when jsonb_typeof(p.cart -> 'items') = 'array' then p.cart -> 'items'
      else '[]'::jsonb
    end
  ) elem
) ni
where nullif(btrim(coalesce(
  ni.item_payload ->> 'name',
  ni.item_payload ->> 'product_name',
  ni.item_payload ->> 'title'
)), '') is null;
