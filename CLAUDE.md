# Materia — Agent Instructions

## Repository Layout

```
web/        Active Next.js workspace (current product direction)
db/         Database schema, RLS policies, views, RPC functions (migrations/), manual SQL (manual/)
docs/       Architecture, decisions, workflows, contributor guide
legacy/     Streamlit Python app and compatibility tooling (not the active surface)
tmp/        Local scratch only — not committed, not backed up
```

## Quick-Start Commands

### Next.js workspace
```bash
cd web
npm install
npm run dev        # dev server
npm run build      # production build
npm run lint       # lint
npm test           # vitest unit tests
```

### Python / Streamlit (legacy)
```bash
cd legacy
pip install -r requirements.txt
streamlit run app.py
pytest             # Python unit tests
```

## Where New Work Goes

| Work type | Location |
|---|---|
| Workspace UI, rooms, budgets, collaboration, client-view | `web/src/` + `db/migrations/` |
| Schema changes, RLS, views, RPC functions | `db/migrations/` (new file, never edit applied migrations) |
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
- **Client views are isolated.** Public client pages must read from `client_view_*` tables only — never from `projects`, `room_objects`, or `materials` directly.
- **`db/migrations/` is the source of truth** for schema and database behavior.

## Domain Model

```
Project → Houses → Rooms → RoomObjects → selected_material_id → Materials
```

Budget layers: `project_budgets`, `project_budget_categories`, `project_house_budgets`, `project_room_budgets`, `room_objects.budget_allowance`

## Read Before Non-Trivial Changes

1. `docs/ARCHITECTURE.md`
2. `docs/DECISIONS.md`
3. `docs/CONTRIBUTING.md`
4. `docs/SCHEMA_STATUS.md` (for DB work)
