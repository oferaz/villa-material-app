-- Adds optional procurement fields used by the Excel export workflow.
-- Safe to run multiple times.

alter table if exists public.materials
    add column if not exists supplier text;

alter table if exists public.materials
    add column if not exists supplier_name text;

alter table if exists public.materials
    add column if not exists lead_time_days integer;

comment on column public.materials.supplier is
'Preferred supplier or store name for purchasing.';

comment on column public.materials.supplier_name is
'Backward-compatible supplier alias used by older code paths.';

comment on column public.materials.lead_time_days is
'Estimated lead time in days for procurement planning.';
