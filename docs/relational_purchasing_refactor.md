# Relational Purchasing Refactor

## Scope
This rollout moves Materia from legacy `projects.cart` JSON usage to relational purchasing tables where the core unit is `project_items`.

## Phase 1: Schema
Apply:
- `db/migrations/20260309_relational_purchasing_model.sql`
- `db/migrations/20260309_add_material_supplier_and_lead_time.sql`

Created/extended:
- `projects` (extended metadata)
- `rooms`
- `suppliers`
- `catalog_items`
- `project_items`
- `room_templates` (seeded starter checklists)

Controls:
- Category validation (`sanitary`, `tiles`, `furniture`, `lighting`, `paint`, `kitchen`, `appliances`, `decor`, `outdoor`, `hardware`, `other`)
- Status validation (`draft`, `quoted`, `approved`, `ordered`, `delivered`, `paid`)
- `updated_at` triggers on mutable core tables

## Phase 2: Legacy Migration
Apply:
- `db/migrations/20260309_migrate_legacy_data_to_relational.sql`

Backfills:
- `rooms` from `project_rooms`
- `suppliers` from `materials`
- `catalog_items` from `materials`
- `project_items` from `room_objects` and from `projects.cart` JSON items

Logs:
- `legacy_migration_log` records skipped/unmapped cart rows

Optional script (safer staged run):
- `scripts/migrate_legacy_cart_to_project_items.py --dry-run`
- then `scripts/migrate_legacy_cart_to_project_items.py --write-log-table`

## Phase 3: Data Access Layer
New module: `project_items_manager.py`

Core functions:
- `create_project`, `list_projects`
- `create_room`, `list_rooms`
- `add_project_item`, `update_project_item`, `delete_project_item`
- `list_project_items`
- `list_project_items_grouped_by_room`
- `list_project_items_grouped_by_supplier`
- `list_project_items_grouped_by_category`
- `add_catalog_item_to_project` (snapshot copy)
- `generate_room_checklist`
- `build_project_items_excel_bytes`

## Phase 4: UI Wiring
`app.py` now prefers relational `project_items` for:
- grouped preview (room/supplier/category)
- Excel export sheets: Summary, By Room, By Supplier, By Category

Fallback:
- legacy room-object export remains available when relational rows are still empty during migration.
