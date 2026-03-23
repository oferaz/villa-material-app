# Materia Architecture

## Purpose

This document is the working map of the repository.
It describes what exists today, how the main parts fit together, and where new work should usually land.

## Repository Shape

The repo currently contains two application surfaces that share a broad product domain but represent different stages of the product:

- `app.py` and the Python modules around it are the legacy Streamlit application.
- `web/` is the newer Next.js workspace built around a fresh Supabase-backed editing model.
- `db/migrations/` contains the database contract for the current workspace and some legacy relational work.
- `tests/` contains lightweight unit tests for Python data-access logic and migration-level assertions.

This is intentionally a transitional repository, not a clean-slate monolith.

## High-Level System View

```text
Users
  |
  +--> Streamlit app (`app.py`)
  |      |
  |      +--> Python managers / helpers
  |      +--> Supabase client with per-session access token
  |
  +--> Next.js app (`web/`)
         |
         +--> React UI + repository modules
         +--> Browser Supabase client
         +--> Small server routes for web-only helpers
         +--> Public client-review page backed by server-side RPC access

Shared backend
  |
  +--> Supabase Postgres
         |
         +--> RLS policies
         +--> RPC functions for multi-row workflows
         +--> Views for derived read models
         +--> Frozen client-view share payloads for external review
```

## Main Bounded Areas

### 1. Legacy Streamlit Surface

Primary entrypoint:

- `app.py`

Supporting modules:

- `auth_ui.py`
- `project_manager.py`
- `project_items_manager.py`
- `materials_manager.py`
- `user_template_manager.py`
- `ui_utils.py`
- `supabase_client.py`

Responsibilities:

- Login flow and Streamlit session state management.
- Legacy project CRUD and room/object flows.
- Relational purchasing flows around `project_items`.
- Excel export and utility workflows used by the Streamlit UI.
- Backward-compatible behavior while the web workspace is being built out.

Important characteristic:

- The Streamlit app is not just a thin client. It contains meaningful orchestration and compatibility logic, especially around older project structures.

### 2. Next.js Workspace

Primary entrypoints:

- `web/src/app/page.tsx`
- `web/src/app/dashboard/page.tsx`
- `web/src/app/projects/[projectId]/page.tsx`
- `web/src/app/client/[token]/page.tsx`

Key UI modules:

- `web/src/components/projects/project-workspace.tsx`
- `web/src/components/rooms/*`
- `web/src/components/materials/*`
- `web/src/components/budget/*`
- `web/src/components/workflow/*`
- `web/src/components/client-view/*`

Key data-access modules:

- `web/src/lib/supabase/client.ts`
- `web/src/lib/supabase/projects-repository.ts`
- `web/src/lib/supabase/projects-wizard.ts`
- `web/src/lib/supabase/materials-repository.ts`
- `web/src/lib/export/project-excel.ts`

Responsibilities:

- Project workspace editing around houses, rooms, and room objects.
- Material search and assignment from the user's private materials library.
- Budget planning at project, category, house, room, and per-object target levels.
- Workflow tracking for assignment, PO approval, ordering, and installation.
- Snapshot creation and restore.
- Collaboration features such as project membership and invite flows.
- Client-view publishing, public review links, invited approvals, and owner-side apply-back of accepted client responses.

Important characteristic:

- The web app is built around the current product editing model, not the legacy procurement-first model.
- External client review is intentionally separate from internal project membership.

### 3. Database Contract

Primary location:

- `db/migrations/`

Notable migrations:

- `db/migrations/20260311_nextjs_workspace_schema.sql`
- `db/migrations/20260315_add_create_project_wizard_function.sql`
- `db/migrations/20260315_add_house_room_sizes_and_size_aware_wizard.sql`
- `db/migrations/20260316_add_project_snapshots.sql`
- `db/migrations/20260316_add_invite_project_collaborator_function.sql`
- `db/migrations/20260321_add_house_and_room_project_budgets.sql`
- `db/migrations/20260321_add_room_object_budget_allowance.sql`
- `db/migrations/20260323_add_client_views.sql`
- `db/migrations/20260309_relational_purchasing_model.sql`

The database layer carries a large part of the product contract:

- core tables
- foreign keys
- constraints
- `updated_at` triggers
- row-level security
- RPC functions for multi-step writes
- read-model views such as `project_budget_allocations`
- frozen client-view payloads and approval submissions

## Canonical Domain Model Today

For the current workspace, the main editing hierarchy is:

```text
Project
  -> Houses
    -> Rooms
      -> RoomObjects
        -> selected_material_id -> Materials
```

Budget data is split into:

- `project_budgets`: project-wide total
- `project_budget_categories`: editable planned category totals
- `project_house_budgets`: editable per-house planned totals
- `project_room_budgets`: editable per-room planned totals
- `room_objects.budget_allowance`: optional per-object target used for option comparison and budget guidance
- `project_budget_allocations`: derived allocation view from selected materials

Collaboration data is handled through:

- `profiles`
- `project_members`

External client review data is handled separately through:

- `client_views`
- `client_view_recipients`
- `client_view_items`
- `client_view_item_options`
- `client_view_responses`

Snapshot support is handled through:

- `project_snapshots`
- RPC functions `create_project_snapshot` and `restore_project_snapshot`

## Legacy Model Still Present

The older procurement-oriented model still exists in the codebase and matters for compatibility:

- `project_items`
- `catalog_items`
- `suppliers`
- migration helpers for legacy `projects.cart` JSON

This model is still relevant for:

- Streamlit purchasing/export flows
- historical data migration
- some tests and operational scripts

It should not be treated as the primary editing model for new workspace features unless there is a clear cross-surface requirement.

## Data Flow Patterns

### Auth

- Streamlit uses `auth_ui.py` and stores auth state in `st.session_state`.
- The Python Supabase client is created per use and can attach the current access token so RLS works correctly.
- The Next.js workspace uses `@supabase/supabase-js` in `web/src/lib/supabase/client.ts`.
- Public client-view pages use server-side route handlers that call database functions with token-based lookup, rather than reading private tables directly in the browser.

### Project Creation

- Streamlit historically creates projects with application-side orchestration in `project_manager.py`.
- The web workspace prefers RPC-based creation through `create_project_with_owner_membership`, called from `projects-wizard.ts`.
- The RPC path exists to create the project and owner membership atomically and keep RLS simple.

### Material Search and Selection

- Search results are derived from `materials` and `material_images`.
- The selected material is persisted on `room_objects.selected_material_id`.
- Search results themselves are not persisted as first-class records.
- Client review publishes a curated snapshot of 1 to 3 explicit material options per object when external comparison is needed.

### Budgeting

- Planned budget values are editable and stored in dedicated tables.
- Optional per-object target allowances are stored directly on `room_objects.budget_allowance`.
- Allocated values are derived from currently selected materials.
- The workspace computes option-level impact and marks the specific object rows that push a room past its planned budget.
- The UI therefore mixes stored planning data with computed read models.
- Client review can request a client-preferred budget per object, but that response remains separate until an owner or editor applies it back into the workspace.

### Snapshot / Restore

- The current workspace snapshots are created inside the database as JSON payloads.
- Restore is also database-native and rewrites the project structure in a controlled order.
- This keeps large multi-table restore logic close to the data and inside RLS-aware database functions.
- Client-view publishing does not reuse snapshots because snapshots are too broad and include internal workspace data that should not be exposed externally.

### Client View Publish / Review

- Designers curate a subset of room objects from the workspace.
- Publishing writes a frozen, minimal payload through `publish_client_view`.
- Public pages load only the latest published version through `get_published_client_view`.
- Viewing is token-based and guest-capable.
- Approval submission is authenticated and limited to invited recipient emails through `get_client_view_submission_context` and `submit_client_view_response`.
- Owner-side apply-back uses `apply_client_view_response` so client responses do not mutate project data automatically.

## Security Model

The workspace security model is centered on Supabase RLS:

- membership controls access to projects and nested entities
- owners/editors can mutate project-scoped data
- viewers can read but not write
- materials are private to their owner
- RPC functions are used when a workflow needs more than a simple row insert/update

Client views add a second collaboration boundary:

- external clients do not become `project_members`
- public share links resolve through hashed tokens
- published client-view tables store only the approved display subset
- public pages must not query `projects`, `room_objects`, or `materials` directly for client content
- invited, signed-in recipients can submit responses, but owner/editor apply-back remains explicit

When building new features, start by asking whether the operation belongs in:

- plain table access under existing RLS, or
- an RPC function guarded by membership checks

## Testing Strategy

Current tests are intentionally lightweight:

- Python manager unit tests with fake Supabase clients
- migration assertion tests that verify required SQL structures exist

Primary test files:

- `tests/test_project_manager.py`
- `tests/test_project_items_manager.py`
- `tests/test_relational_migrations.py`
- `tests/test_user_template_manager.py`

This means:

- repository and migration contracts are reasonably protected
- end-to-end integration coverage is still limited

## Operational Notes

- Treat `db/migrations/` as the source of truth for schema behavior.
- Expect environments to lag behind the latest migration; some repository code includes compatibility fallbacks for missing columns or RPC functions.
- Do not assume the Streamlit and Next.js surfaces use the same schema conventions everywhere.
- Avoid global auth-bearing clients; per-request or per-session client construction is intentional.
- Because client share tokens are stored hashed, the app can show a fresh link at publish time but cannot reconstruct an old token later from the database alone.

## Where New Work Should Usually Go

- New workspace UX, collaboration, budgeting, room/object flows, and client-review publishing should usually go in `web/` plus matching Supabase migrations.
- Legacy-only support or compatibility fixes should stay in the Python surface.
- Cross-cutting product rules should be expressed in the database when they are data-integrity or permission-sensitive.

## Related Documents

- `docs/nextjs_supabase_workspace_plan.md`
- `docs/relational_purchasing_refactor.md`
- `docs/DECISIONS.md`
