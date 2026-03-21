# Contributing

## Purpose

This repo is in an active transition phase.
Please use this guide to keep changes aligned with the current architecture instead of reinforcing older patterns by accident.

## Read This First

Before making non-trivial changes, read:

1. `docs/ARCHITECTURE.md`
2. `docs/DECISIONS.md`
3. The task-specific doc in `docs/` if one exists
4. `docs/SCHEMA_STATUS.md` for database-backed work

## Repository Rules Of Thumb

- New workspace product work usually goes in `web/` plus matching `db/migrations/`.
- Legacy-only maintenance and compatibility fixes usually stay in the Python surface.
- Data integrity and permission-sensitive rules belong in the database whenever practical.
- Prefer improving the current workspace model over extending legacy JSON or procurement-first patterns unless the task is explicitly legacy support.

## Where Changes Usually Go

### Next.js workspace

Use `web/` for:

- workspace UI and interactions
- repository/data-access code for the current editing model
- browser-side exports and small web-only helper routes

Common locations:

- `web/src/app/`
- `web/src/components/`
- `web/src/lib/supabase/`
- `web/src/lib/export/`
- `web/src/types/`

### Python / Streamlit surface

Use the Python app for:

- existing Streamlit flows
- legacy compatibility work
- older procurement-oriented features
- migration helpers and operational scripts that already live in Python

Common locations:

- `app.py`
- `project_manager.py`
- `project_items_manager.py`
- `materials_manager.py`

### Database contract

Use `db/migrations/` for:

- schema changes
- RLS changes
- views
- RPC functions
- constraints and triggers

Treat migrations as the source of truth for backend behavior.

## Migration Guidelines

- Add a new migration instead of editing an old applied migration, unless the migration is brand new and not yet shared.
- Keep migrations idempotent where possible with `if exists` / `if not exists`.
- If you change a snapshot-related schema field, update snapshot create/restore functions in the same change.
- If you add a new workspace field, check whether these also need updates:
  - repository mapping in `web/src/lib/supabase/`
  - UI types in `web/src/types/`
  - mock helpers if the UI still relies on them in fallback paths
  - tests that assert migration structure

## RLS And RPC Guidelines

- Prefer plain table access when existing RLS already models the permission correctly.
- Prefer RPC when a workflow spans multiple tables or must be atomic.
- Keep membership checks close to the write path.
- Be careful with `security definer` functions; validate actor permissions explicitly.

## Documentation Expectations

Update docs when you change:

- the main architecture shape
- where new code should land
- the active schema baseline
- key workflows such as project creation, budgets, collaboration, or snapshots
- a durable architectural decision

When making a structural decision, add or update an entry in `docs/DECISIONS.md`.

## Testing Expectations

For most changes, run the smallest relevant verification you can:

- Python manager logic: targeted `pytest` tests
- migration changes: migration contract tests and any directly affected tests
- web changes: at least type-aware or build/lint checks when practical

Current coverage is lightweight, so use judgment and call out untested risk in handoff notes.

## Safe Delivery Checklist

- Read the architecture and decision docs first.
- Keep new code in the correct surface.
- Update migrations instead of silently shifting assumptions in app code.
- Update docs when the system contract changes.
- Verify only the files intended for the task changed.
