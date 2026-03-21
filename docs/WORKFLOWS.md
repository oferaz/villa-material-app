# Workflows

## Purpose

This document maps the main development workflows in the repository so contributors can find the right entry points quickly.

## 1. Add A New Workspace Feature

Use this path for new product work in the current editor experience.

1. Read `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and `docs/SCHEMA_STATUS.md`.
2. Confirm the feature belongs to the workspace model:
   `Project -> House -> Room -> RoomObject`.
3. Update or add database support in `db/migrations/` if the feature changes persisted state.
4. Update repository code in `web/src/lib/supabase/`.
5. Update shared types in `web/src/types/`.
6. Update UI components in `web/src/components/` and route entrypoints in `web/src/app/` as needed.
7. Update docs if the workflow or architectural boundary changed.

## 2. Add Or Change Database Schema

Use this when the shape of stored data changes.

1. Add a new migration under `db/migrations/`.
2. Make the migration safe for partially updated environments where practical.
3. Update any RPC functions, views, and RLS policies affected by the change.
4. Update repository mappings and types that read or write the changed fields.
5. Update snapshot create/restore functions if the field should survive snapshots.
6. Update `docs/SCHEMA_STATUS.md` if the change affects the active workspace schema baseline.

## 3. Add A New Budget Field Or Budget Rule

Budget work often crosses multiple layers.

Check all of these:

- migrations in `db/migrations/`
- budget repository logic in `web/src/lib/supabase/projects-repository.ts`
- budget domain types in `web/src/types/budget.ts` and related project types
- UI in `web/src/components/budget/`
- snapshot create/restore functions if the data must persist across restores

## 4. Add A New Room Object Field

This is a common workflow for the current workspace.

Check all of these:

- `public.room_objects` in migrations
- snapshot create/restore functions
- repository mapping in `web/src/lib/supabase/projects-repository.ts`
- shared types in `web/src/types/project.ts`
- related UI components under `web/src/components/rooms/` and `web/src/components/products/`

Recent example:

- `budget_allowance` added on `room_objects` and then restored through snapshot SQL

## 5. Change Project Creation Behavior

Project creation for the workspace is RPC-first.

Primary path:

- database function `create_project_with_owner_membership`
- client wrapper in `web/src/lib/supabase/projects-wizard.ts`

When changing defaults such as houses, room templates, or sizes:

- update the migration-backed function
- check compatibility fallbacks in the repository code
- update docs if the default project shape changed

## 6. Change Collaboration Or Permissions

Start in the database.

Primary places:

- `project_members`
- RLS policies in the workspace schema migrations
- RPC functions that require owner/editor checks
- repository calls in `web/src/lib/supabase/projects-repository.ts`

Also review:

- invite flow behavior
- snapshot permissions
- delete permissions

## 7. Change Snapshot Behavior

Snapshots are database-native.

Primary places:

- `create_project_snapshot`
- `restore_project_snapshot`
- snapshot-related migrations in `db/migrations/`
- client calls in `web/src/lib/supabase/projects-repository.ts`

Rule:

- if a field should survive snapshot and restore, both snapshot creation and restore must understand it

## 8. Work On Legacy Streamlit Functionality

Use this workflow when the task is explicitly about the legacy surface.

Primary places:

- `app.py`
- `project_manager.py`
- `project_items_manager.py`
- `materials_manager.py`

Guardrail:

- do not move new workspace product logic into the Python surface unless the feature is intentionally shared or legacy-only

## 9. Record A Lasting Design Choice

When a change alters system shape or direction:

1. Implement the code and schema changes.
2. Add or update an entry in `docs/DECISIONS.md`.
3. If the decision pattern will repeat, consider creating a new ADR from `docs/adr_template.md`.
