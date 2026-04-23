# Materia — Agent Instructions

## Multi-Agent System

This project uses a 4-agent development system. For any non-trivial task, use the Orchestrator.

### How to start

Write your task in plain English. The Orchestrator will classify it, plan it, and dispatch to specialists.

### Agent files

| Agent | File | Role |
|---|---|---|
| **Orchestrator** | `.claude/agents/orchestrator.md` | Entry point — reads task, builds plan, dispatches |
| **Frontend** | `.claude/agents/frontend.md` | `web/src/` — Next.js, React, Tailwind, Radix UI |
| **Database** | `.claude/agents/database.md` | `db/migrations/` — schema, RLS, RPC, views |
| **QA** | `.claude/agents/qa.md` | Tests, type-check, RLS audit, isolation checks |

### Coordination flow

```
Your task (plain English)
  → Orchestrator: classify + plan → user approves
  → [FRONTEND] agent  ┐  (run in parallel when both needed)
  → [DATABASE] agent  ┘
  → QA gate (always last)
  → Diffs shown for user review — no auto-commit
```

### Hard rules (apply to all agents)

- Agents present diffs — no git commits, no pushes without user approval
- Applied DB migrations are immutable — new file always
- Client-view pages never query `projects`, `room_objects`, or `materials` directly
- No global auth-bearing Supabase clients

---

## Repository Layout

```
web/        Active Next.js workspace (current product direction)
db/         Database schema, RLS policies, views, RPC functions (migrations/), manual SQL (manual/)
docs/       Architecture, decisions, workflows, contributor guide
legacy/     Streamlit Python app and compatibility tooling (not the active surface)
tmp/        Local scratch only — not committed, not backed up
```

## Quick-Start Commands

```bash
# Next.js workspace
cd web && npm install
npm run dev        # dev server
npm run build      # production build
npm run lint       # lint
npm test           # vitest unit tests

# Python / Streamlit (legacy)
cd legacy && pip install -r requirements.txt
streamlit run app.py
pytest
```

## Where New Work Goes

| Work type | Location |
|---|---|
| Workspace UI, rooms, budgets, collaboration, client-view | `web/src/` + `db/migrations/` |
| Schema changes, RLS, views, RPC functions | `db/migrations/` (new file, never edit applied) |
| Legacy Streamlit fixes, procurement flows | `legacy/` |
| Operational / one-off SQL | `db/manual/` |

## Migration Naming

```
db/migrations/YYYYMMDD_short_description.sql
```

Always add a new file. Never edit an already-applied migration.

## Key Rules

- **RLS owns permissions.** Do not replicate access control in app code.
- **Prefer RPC for multi-table writes.** Use `security definer` only with explicit membership checks.
- **No global auth clients.** Construct per-request or per-session Supabase clients.
- **Client views are isolated.** Public client pages must read from `client_view_*` tables only — never `projects`, `room_objects`, or `materials` directly.
- **`db/migrations/` is source of truth** for schema and database behavior.
- **Keep migrations idempotent** using `IF EXISTS` / `IF NOT EXISTS`.
- **Snapshot awareness.** Changing a snapshot-related schema field → update snapshot create/restore functions in the same migration.

## New Workspace Field Checklist

When adding a field to `room_objects` or other workspace tables, also update:
1. Repository mapping in `web/src/lib/supabase/`
2. UI types in `web/src/types/`
3. Mock helpers if used as fallbacks
4. Migration contract tests

## Domain Model

```
Project → Houses → Rooms → RoomObjects → selected_material_id → Materials
```

Budget layers: `project_budgets`, `project_budget_categories`, `project_house_budgets`, `project_room_budgets`, `room_objects.budget_allowance`

Collaboration: `profiles`, `project_members`

Client review (separate boundary — never joins project tables): `client_views`, `client_view_recipients`, `client_view_items`, `client_view_item_options`, `client_view_responses`

## Key Next.js Files

```
web/src/app/projects/[projectId]/page.tsx
web/src/app/client/[token]/page.tsx        ← client-view isolation applies
web/src/components/projects/
web/src/components/rooms/
web/src/components/materials/
web/src/components/budget/
web/src/components/client-view/            ← client-view isolation applies
web/src/lib/supabase/client.ts
web/src/lib/supabase/projects-repository.ts
web/src/lib/supabase/materials-repository.ts
```

## Key Database Tables

Core: `projects`, `project_members`, `houses`, `rooms`, `room_objects`, `materials`, `material_images`

Budget: `project_budgets`, `project_budget_categories`, `project_house_budgets`, `project_room_budgets`

View: `project_budget_allocations`

Client review: `client_views`, `client_view_recipients`, `client_view_items`, `client_view_item_options`, `client_view_responses`

Snapshots: `project_snapshots`

Legacy (lower priority): `project_items`, `catalog_items`, `suppliers`

## Key RPC Functions

| Function | Purpose |
|---|---|
| `create_project_with_owner_membership` | Atomic project + owner creation |
| `invite_project_collaborator` | Invite flow |
| `create_project_snapshot` / `restore_project_snapshot` | Snapshot / restore |
| `publish_client_view` | Freeze client-view payload |
| `get_published_client_view` | Token-based public read |
| `get_client_view_submission_context` | Authenticated submission context |
| `submit_client_view_response` | Invited recipient response |
| `apply_client_view_response` | Owner/editor apply-back |

## Applied Migration Baseline (as of 2026-03-23)

`20260311_nextjs_workspace_schema` → `20260315_add_create_project_wizard_function` → `20260315_update_project_wizard_default_rooms` → `20260315_add_house_room_sizes_and_size_aware_wizard` → `20260316_add_profiles_self_insert_policy` → `20260316_add_invite_project_collaborator_function` → `20260316_add_project_snapshots` → `20260316_add_room_object_quantity` → `20260316_add_room_object_workflow_stages` → `20260321_add_house_and_room_project_budgets` → `20260321_add_room_object_budget_allowance` → `20260322_add_material_tags` → `20260323_add_client_views` → `20260323_fix_client_view_token_hash_extension_schema`
