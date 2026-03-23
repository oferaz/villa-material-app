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
12. `db/migrations/20260322_add_material_tags.sql`
13. `db/migrations/20260323_add_client_views.sql`
14. `db/migrations/20260323_fix_client_view_token_hash_extension_schema.sql`

As of `2026-03-23`, this is the latest workspace-oriented migration chain present in the repo.

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
- `client_views`
- `client_view_recipients`
- `client_view_items`
- `client_view_item_options`
- `client_view_responses`

## Core Workspace Views And Functions

Important view:

- `project_budget_allocations`

Important RPC / SQL functions:

- `create_project_with_owner_membership`
- `invite_project_collaborator`
- `create_project_snapshot`
- `restore_project_snapshot`
- `publish_client_view`
- `get_published_client_view`
- `get_client_view_submission_context`
- `submit_client_view_response`
- `apply_client_view_response`
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

## Current Client View Shape

The external client review model includes:

- `client_views` for share lifecycle, publish version, token hash, and expiry
- `client_view_recipients` for invited approval emails
- `client_view_items` for frozen object-level review cards
- `client_view_item_options` for published material-choice option snapshots
- `client_view_responses` for invited-recipient submissions and owner apply tracking

Important behavioral rules:

- public pages load through `get_published_client_view`, not direct reads from private project tables
- published items are versioned and frozen so later workspace edits do not alter the client payload retroactively
- approvals require authentication plus invited email membership
- response apply-back is explicit and updates workspace state only when an owner or editor chooses to apply it

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
Client-view data is intentionally not part of snapshot restore today.

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
