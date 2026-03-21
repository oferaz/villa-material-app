# Schema Status

## Purpose

This document describes the current database baseline for the active Next.js workspace and distinguishes it from older legacy relational work that still exists in the repository.

## Current Workspace Baseline

The active workspace schema is built incrementally on top of these migrations:

1. `db/migrations/20260311_nextjs_workspace_schema.sql`
2. `db/migrations/20260315_add_create_project_wizard_function.sql`
3. `db/migrations/20260315_update_project_wizard_default_rooms.sql`
4. `db/migrations/20260315_add_house_room_sizes_and_size_aware_wizard.sql`
5. `db/migrations/20260316_add_profiles_self_insert_policy.sql`
6. `db/migrations/20260316_add_invite_project_collaborator_function.sql`
7. `db/migrations/20260316_add_project_snapshots.sql`
8. `db/migrations/20260316_add_room_object_quantity.sql`
9. `db/migrations/20260316_add_room_object_workflow_stages.sql`
10. `db/migrations/20260321_add_house_and_room_project_budgets.sql`
11. `db/migrations/20260321_add_room_object_budget_allowance.sql`

As of `2026-03-21`, this is the latest workspace-oriented migration chain present in the repo.

## Core Workspace Tables

These are the main tables that power the current editor:

- `profiles`
- `projects`
- `project_members`
- `houses`
- `rooms`
- `room_objects`
- `materials`
- `material_images`
- `project_budgets`
- `project_budget_categories`
- `project_house_budgets`
- `project_room_budgets`
- `project_snapshots`

## Core Workspace Views And Functions

Important view:

- `project_budget_allocations`

Important RPC / SQL functions:

- `create_project_with_owner_membership`
- `invite_project_collaborator`
- `create_project_snapshot`
- `restore_project_snapshot`
- `touch_updated_at`

## Current Room Object Fields That Matter To The Workspace

The workspace currently relies on these notable `room_objects` capabilities:

- hierarchy under `rooms`
- `quantity`
- `budget_allowance`
- `material_search_query`
- `selected_material_id`
- workflow state fields:
  - `po_approved`
  - `is_ordered`
  - `is_installed`

If a new field is added here, review:

- repository mapping
- UI types
- snapshot create/restore logic

## Current Budgeting Shape

The current budget model includes:

- project-level total budget
- category planning totals
- house-level planning totals
- room-level planning totals
- derived allocation amounts from selected materials
- optional per-object `budget_allowance`

This means budget behavior is now spread across both:

- dedicated budget tables
- `room_objects`

## Snapshot Coverage Status

Snapshot support currently includes:

- project metadata
- houses
- rooms
- room objects
- project budget row
- project budget categories
- project house budgets
- project room budgets

The latest snapshot restore function also restores `room_objects.budget_allowance`.

## Legacy Relational Chain Still Present

These older migrations are still important, but they are not the primary baseline for the current workspace editor:

- `db/migrations/20260309_relational_purchasing_model.sql`
- `db/migrations/20260309_add_material_supplier_and_lead_time.sql`
- `db/migrations/20260309_migrate_legacy_data_to_relational.sql`

They primarily support:

- the older procurement-oriented relational model
- Streamlit compatibility
- historical migration and export flows

## Practical Rule

If you are adding a feature for the current editor experience, assume the workspace baseline above is the one you must preserve.

If you are changing schema behavior and are unsure whether it belongs to the workspace model or the legacy model, read:

1. `docs/ARCHITECTURE.md`
2. `docs/DECISIONS.md`
3. `docs/nextjs_supabase_workspace_plan.md`
