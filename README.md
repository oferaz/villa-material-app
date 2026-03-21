# Materia

Materia is a repository in transition from a legacy Streamlit app to a newer Next.js workspace backed by Supabase.

The current product direction is centered on the workspace model:

```text
Project
  -> Houses
    -> Rooms
      -> RoomObjects
        -> selected_material_id -> Materials
```

## Start Here

Read these first before making non-trivial changes:

1. `docs/ARCHITECTURE.md`
2. `docs/DECISIONS.md`
3. `docs/CONTRIBUTING.md`
4. `docs/WORKFLOWS.md`
5. `docs/SCHEMA_STATUS.md`

## Repository Map

- `web/`
  The active Next.js workspace for the current product direction.
- `app.py` and Python modules in the repo root
  The legacy Streamlit surface and compatibility tooling.
- `pages/`, `assets/`, and root Python helpers
  Supporting files for the legacy Streamlit surface.
- `db/migrations/`
  Database schema, RLS policies, views, triggers, and RPC functions.
- `db/manual/`
  Manual SQL scripts for one-off or operational work.
- `scripts/` and `web/scripts/`
  Migration, import, and operational helper scripts.
- `docs/`
  Architecture, decisions, workflows, and contributor guidance.
- `tests/`
  Lightweight Python and migration contract tests.
- `tmp/`
  Local-only scratch space for generated import metadata, ad hoc exports, and operational working files.

## Which Surface To Use

- New workspace product work usually belongs in `web/` plus matching `db/migrations/`.
- Legacy-only support or compatibility fixes usually belong in the Python surface.
- Data integrity and permission-sensitive rules should usually live in the database.

## Quick Start

### Next.js workspace

See `web/README.md` for the web app details.

Typical flow:

1. `cd web`
2. `npm install`
3. `npm run dev`

### Python / Streamlit surface

The repo also contains a Python app with Supabase-backed managers and older workflows.

Typical setup depends on your local Python environment and project secrets.
Before changing that surface, read `docs/ARCHITECTURE.md` and `docs/CONTRIBUTING.md`.

## Current Backend Shape

The active workspace schema includes:

- projects and project membership
- houses, rooms, and room objects
- materials and material images
- project, category, house, room, and per-object budget planning
- snapshots and restore flows
- collaboration via RLS and RPC-backed workflows

## Notes

- This repo intentionally contains both old and new application surfaces.
- Not every pattern in the Python app should be copied into the Next.js workspace.
- Treat `db/migrations/` as the source of truth for schema behavior.
- Keep local environments, generated temp files, and machine-specific working data out of Git.
