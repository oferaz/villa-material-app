# Materia Architectural Decisions

## Purpose

This is a lightweight architecture decision log.
It records the decisions that currently shape the codebase so future changes can build on them intentionally instead of rediscovering them from migrations and repository code.

## How To Use This File

- Add a new entry when a decision changes system shape, ownership boundaries, data contracts, or deployment assumptions.
- Prefer recording the decision when code lands, not weeks later.
- If a decision is superseded, keep the old entry and mark the newer one as the active direction.

## Status Legend

- `Accepted`: active decision
- `Superseded`: kept for history but no longer the preferred path
- `Proposed`: not fully committed yet

## Decision Log

### ADR-001: Keep Streamlit and Next.js in the same repository during migration

- Status: `Accepted`
- Context:
  The product is moving from a Streamlit surface to a Next.js workspace, but the older Python application still contains working flows, migration helpers, and operational knowledge.
- Decision:
  Keep both application surfaces in one repository for now.
- Consequences:
  We accept some duplication and architectural unevenness in exchange for faster migration, shared domain context, and simpler handoff of utilities, migrations, and tests.
- Evidence:
  `app.py`, Python manager modules, and the full `web/` app coexist and are both active.

### ADR-002: Use a fresh workspace data model centered on houses, rooms, and room objects

- Status: `Accepted`
- Context:
  The legacy relational purchasing model is useful for procurement, but it does not match the editing experience of the current workspace.
- Decision:
  Make `Project -> House -> Room -> RoomObject` the primary editing hierarchy for the new workspace.
- Consequences:
  New workspace features should attach to this hierarchy first.
  The older `project_items` model remains for legacy and procurement-oriented workflows, not as the default modeling choice.
- Evidence:
  `db/migrations/20260311_nextjs_workspace_schema.sql`
  `docs/nextjs_supabase_workspace_plan.md`
  `web/src/types/project.ts`

### ADR-003: Do not persist transient search result sets for room objects

- Status: `Accepted`
- Context:
  Material suggestions are derived from search and user refinement. Persisting every shown option would make the database noisy and unstable.
- Decision:
  Persist only the room object, its search context, and the selected material. Derive the current option list from the materials library.
- Consequences:
  The database stays smaller and more stable.
  Search quality can evolve without data migrations for historical suggestion sets.
- Evidence:
  `docs/nextjs_supabase_workspace_plan.md`
  `web/src/lib/supabase/materials-repository.ts`
  `web/src/lib/supabase/projects-repository.ts`

### ADR-004: Put access control in Supabase RLS and use RPC for multi-row workflows

- Status: `Accepted`
- Context:
  The workspace has nested project entities, collaboration roles, and multi-step writes such as project creation, invitations, and snapshot restore.
- Decision:
  Enforce core access rules in Postgres through RLS and use RPC functions for workflows that need controlled multi-table writes.
- Consequences:
  Authorization lives close to the data.
  Application code can stay thinner for sensitive workflows, but schema work becomes more important and must be reviewed carefully.
- Evidence:
  `db/migrations/20260311_nextjs_workspace_schema.sql`
  `db/migrations/20260315_add_create_project_wizard_function.sql`
  `db/migrations/20260316_add_invite_project_collaborator_function.sql`
  `db/migrations/20260316_add_project_snapshots.sql`

### ADR-005: Avoid shared global Supabase clients that carry user auth state

- Status: `Accepted`
- Context:
  Shared client instances can leak auth state across users, especially in the Python surface.
- Decision:
  Build Supabase clients per use or per session context, and attach access tokens explicitly when needed.
- Consequences:
  Client construction is slightly more repetitive, but auth isolation is safer.
- Evidence:
  `supabase_client.py`

### ADR-006: Keep planned budget data editable, but derive allocated amounts from selected materials

- Status: `Accepted`
- Context:
  Users need to plan budgets explicitly while also seeing actual allocation based on chosen materials.
- Decision:
  Store editable budget targets in budget tables and compute allocation through a read model.
- Consequences:
  The UI must combine persisted planning values with derived allocation values.
  Budget calculations remain explainable and rebuildable from selected materials.
- Evidence:
  `db/migrations/20260311_nextjs_workspace_schema.sql`
  `db/migrations/20260321_add_house_and_room_project_budgets.sql`
  `web/src/lib/mock/budget.ts`
  `web/src/lib/supabase/projects-repository.ts`

### ADR-007: Keep snapshot creation and restore in the database

- Status: `Accepted`
- Context:
  Snapshotting and restore touch many related tables and must preserve a consistent project structure.
- Decision:
  Implement snapshot and restore as database functions instead of orchestrating the full workflow in the client.
- Consequences:
  Complex restore ordering stays close to the schema.
  Application code remains simpler, but debugging requires comfort with SQL and migration history.
- Evidence:
  `db/migrations/20260316_add_project_snapshots.sql`
  `db/migrations/20260321_add_house_and_room_project_budgets.sql`
  `db/migrations/20260321_add_room_object_budget_allowance.sql`
  `web/src/lib/supabase/projects-repository.ts`

### ADR-008: Store per-object allowance targets on room objects as planning guidance, not as hard constraints

- Status: `Accepted`
- Context:
  Project-, house-, and room-level budgets explain total planning, but designers also need a quick target for a single object when comparing material options.
- Decision:
  Persist the optional per-object target on `room_objects.budget_allowance` and use it as a soft planning signal in the workspace.
- Consequences:
  Option cards can show under/on/over target without introducing a separate allowance table.
  Snapshot restore must preserve the allowance field.
  Room-level warnings remain driven by planned room budgets, while object allowances stay advisory rather than blocking.
- Evidence:
  `db/migrations/20260321_add_room_object_budget_allowance.sql`
  `web/src/components/products/product-option-card.tsx`
  `web/src/components/products/product-options-panel.tsx`
  `web/src/lib/mock/budget.ts`
  `web/src/lib/supabase/projects-repository.ts`

### ADR-009: Keep compatibility fallbacks in application code while environments catch up on migrations

- Status: `Accepted`
- Context:
  Different environments may not always have the latest migration set applied.
- Decision:
  Handle certain missing-column and missing-RPC cases gracefully in repository code when the fallback is safe.
- Consequences:
  The app is more resilient during rollout.
  We also accept some temporary branching and extra maintenance in repositories until migration coverage stabilizes.
- Evidence:
  `web/src/lib/supabase/projects-repository.ts`
  `web/src/lib/supabase/projects-wizard.ts`

### ADR-010: Use lightweight contract-focused tests instead of heavy end-to-end coverage for now

- Status: `Accepted`
- Context:
  The codebase is still moving quickly across schema and UI boundaries.
- Decision:
  Keep tests focused on manager logic and SQL contract assertions first.
- Consequences:
  Core invariants are checked cheaply, but end-to-end regressions can still slip through.
  As the workspace stabilizes, broader integration coverage should be added.
- Evidence:
  `tests/test_project_manager.py`
  `tests/test_project_items_manager.py`
  `tests/test_relational_migrations.py`
  `tests/test_user_template_manager.py`

## Open Questions To Capture Next

- When the Streamlit surface becomes read-only or can be removed.
- Whether procurement flows should eventually be re-modeled on top of the workspace hierarchy.
- How much server-side Next.js logic should replace browser-direct Supabase access over time.

