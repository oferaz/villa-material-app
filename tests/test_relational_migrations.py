from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def _read(path: str) -> str:
    return (PROJECT_ROOT / path).read_text(encoding="utf-8").lower()


def test_relational_schema_has_required_core_tables():
    sql = _read("db/migrations/20260309_relational_purchasing_model.sql")

    assert "create table if not exists public.rooms" in sql
    assert "create table if not exists public.suppliers" in sql
    assert "create table if not exists public.catalog_items" in sql
    assert "create table if not exists public.project_items" in sql
    assert "create table if not exists public.room_templates" in sql


def test_relational_schema_has_controlled_category_and_status():
    sql = _read("db/migrations/20260309_relational_purchasing_model.sql")

    assert "category in ('sanitary', 'tiles', 'furniture', 'lighting', 'paint', 'kitchen', 'appliances', 'decor', 'outdoor', 'hardware', 'other')" in sql
    assert "status in ('draft', 'quoted', 'approved', 'ordered', 'delivered', 'paid')" in sql


def test_relational_schema_has_required_indexes_and_fks():
    sql = _read("db/migrations/20260309_relational_purchasing_model.sql")

    assert "create index if not exists idx_rooms_project_id" in sql
    assert "create index if not exists idx_project_items_project_id" in sql
    assert "create index if not exists idx_project_items_room_id" in sql
    assert "create index if not exists idx_project_items_supplier_id" in sql
    assert "create index if not exists idx_project_items_category" in sql
    assert "create index if not exists idx_catalog_items_supplier_id" in sql
    assert "project_id uuid not null references public.projects(id) on delete cascade" in sql
    assert "room_id uuid references public.rooms(id) on delete set null" in sql


def test_legacy_migration_covers_room_objects_and_cart_json():
    sql = _read("db/migrations/20260309_migrate_legacy_data_to_relational.sql")

    assert "backfill project_items from room_objects snapshots" in sql
    assert "backfill project_items from legacy projects.cart json items" in sql
    assert "create table if not exists public.legacy_migration_log" in sql
    assert "insert into public.project_items" in sql
    assert "insert into public.legacy_migration_log" in sql


def test_material_tags_migration_adds_jsonb_array_column():
    sql = _read("db/migrations/20260322_add_material_tags.sql")

    assert "alter table public.materials" in sql
    assert "add column if not exists tags jsonb not null default '[]'::jsonb" in sql
    assert "check (jsonb_typeof(tags) = 'array')" in sql

def test_client_view_migration_adds_share_tables_and_rpc_functions():
    sql = _read("db/migrations/20260323_add_client_views.sql")

    assert "create table if not exists public.client_views" in sql
    assert "create table if not exists public.client_view_items" in sql
    assert "create table if not exists public.client_view_item_options" in sql
    assert "create table if not exists public.client_view_responses" in sql
    assert "create or replace function public.publish_client_view" in sql
    assert "create or replace function public.get_published_client_view" in sql
    assert "create or replace function public.submit_client_view_response" in sql
    assert "create or replace function public.apply_client_view_response" in sql

