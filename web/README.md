# Materia Web (Next.js)

This folder contains the React/Next.js migration shell for Materia.

## Read First

For repository context before making changes, start with:

- `../docs/ARCHITECTURE.md`
- `../docs/DECISIONS.md`
- `../docs/CONTRIBUTING.md`
- `../docs/WORKFLOWS.md`
- `../docs/SCHEMA_STATUS.md`

## Stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase client

## Run
1. Install Node.js 20+
2. `npm install`
3. `npm run dev`

## Workspace Scope

The active web app owns the current project workspace experience, including:

- project editing across houses, rooms, and room objects
- private materials search and assignment
- budget planning and allocation views
- snapshots and collaboration
- client-view publishing for external review links and invited approvals

## Notes

- New workspace product work usually belongs in `web/` plus matching `db/migrations/`.
- The repository still contains a legacy Streamlit surface, so check the docs before assuming a pattern is current.
- Public client links must read from published client-view payloads, not directly from private project or materials tables.
