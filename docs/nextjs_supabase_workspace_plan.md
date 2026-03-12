# Next.js Workspace Supabase Plan

This schema is for a fresh Supabase project dedicated to the Next.js app.
It is intentionally not a continuation of the Streamlit-era relational model.

## Why a New Model

The current Next.js workspace is built around:

- `Project -> Houses -> Rooms -> RoomObjects`
- one selected material per room object
- material search driven by object name plus user-refined query text
- a private user-owned materials library
- budgets derived from currently selected materials

The legacy Streamlit schema centered on `project_items` as procurement snapshots.
That is useful for downstream purchasing, but it is not the right core editing model
for the current workspace.

## Table Roles

- `profiles`
  - user profile rows tied to `auth.users`

- `projects`
  - top-level project metadata

- `project_members`
  - access control for owners, editors, viewers

- `houses`
  - house hierarchy under a project

- `rooms`
  - room hierarchy under a house

- `room_objects`
  - editable object rows per room
  - stores `material_search_query`
  - stores `selected_material_id`

- `materials`
  - user private materials library
  - each row can come from catalog, manual entry, or link import

- `material_images`
  - ordered images for materials

- `project_budgets`
  - project total budget

- `project_budget_categories`
  - planned category budgets

- `project_budget_allocations` view
  - derived totals from selected materials

## Mapping from Current Next.js Types

- `Project`
  - maps to `projects`

- `House`
  - maps to `houses`

- `Room`
  - maps to `rooms`

- `RoomObject`
  - maps to `room_objects`

- `ProductOption`
  - should not be a core persisted table in the first backend version
  - it should be a read model composed from `materials`
  - the UI can still receive `ProductOption[]`, but the backend should derive that from search results

- `ProjectBudget`
  - maps to `project_budgets` plus `project_budget_categories`
  - allocated values come from `project_budget_allocations`

## Important Design Decision

Do not persist "all options ever shown to the user" for each room object.

Persist:

- the current object
- the current search query
- the selected material

Derive:

- current search results
- option cards shown in the UI

This keeps the database stable and avoids turning transient search results into permanent data.

## First Integration Slice

Implement backend integration in this order:

1. Auth + profile bootstrap
2. Load projects, houses, rooms, room objects
3. Save room rename and add room
4. Save room object add/delete
5. Search `materials` by `room_objects.material_search_query`
6. Save `selected_material_id`
7. Read budget totals from `project_budget_allocations`
8. Save editable totals to `project_budgets` and `project_budget_categories`

## Membership Bootstrapping

For the first implementation, create `projects` and the initial `project_members` owner row
from a trusted server action or backend endpoint.

That avoids fragile client-side sequencing during project creation and keeps RLS simple.

## Keep / Extend / Replace

Keep from old world:

- supplier-like concepts
- some project metadata
- reusable material data if it is worth migrating

Extend in new system:

- auth/profile model
- budgets
- material images

Replace:

- `project_items` as the primary editing model
- project-level rooms without houses
- legacy JSON cart assumptions

## Migration Strategy Later

If you decide to bring legacy data into the new project:

1. migrate projects
2. create one default house for old projects that had only project-level rooms
3. migrate rooms
4. migrate reusable materials into `materials`
5. map old selected items into `room_objects.selected_material_id`
6. rebuild budgets from selected materials instead of copying legacy computed totals
