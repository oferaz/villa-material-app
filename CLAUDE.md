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
