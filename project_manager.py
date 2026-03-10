# project_manager.py — Supabase projects (safe, no global client)

import copy
import streamlit as st
from supabase_client import get_supabase
from assets.villa_template import SMALL_VILLA_TEMPLATE
import re
import secrets
from datetime import datetime, timezone

def _token() -> str | None:
    # In AUTH_BYPASS debug mode there may be no user token.
    return st.session_state.get("sb_access_token")

def _template_room_key(room_name: str) -> str:
    """
    Maps 'Living Room 1' -> 'Living Room', 'Bathroom 2' -> 'Bathroom'
    Also trims extra spaces.
    """
    if not room_name:
        return ""
    # remove trailing " 1", " 2", etc.
    base = re.sub(r"\s+\d+$", "", room_name.strip())
    return base


def _safe_qty(value) -> int:
    try:
        return max(1, int(float(value)))
    except Exception:
        return 1


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", str(text or "").strip().lower()).strip("_")
    return slug or "item"


def _normalize_template_map(template_map):
    clean = {}
    if not isinstance(template_map, dict):
        return clean

    for room_name, objects in template_map.items():
        room_clean = str(room_name or "").strip()
        if not room_clean:
            continue

        object_rows = []
        if not isinstance(objects, list):
            objects = []

        for idx, obj in enumerate(objects):
            if isinstance(obj, str):
                obj = {"name": obj}
            if not isinstance(obj, dict):
                continue

            name = str(obj.get("name") or "").strip()
            key = str(obj.get("key") or "").strip()
            category = str(obj.get("category") or "").strip() or "General"
            qty = _safe_qty(obj.get("qty", 1))

            if not name:
                name = key.replace("_", " ").title() if key else f"Item {idx + 1}"
            if not key:
                key = _slugify(name)

            object_rows.append(
                {
                    "key": key,
                    "name": name,
                    "category": category,
                    "qty": qty,
                }
            )

        clean[room_clean] = object_rows

    return clean


def _normalize_room_names(room_names) -> list[str]:
    clean = []
    seen = set()

    for room_name in room_names or []:
        room_clean = str(room_name or "").strip()
        if not room_clean:
            continue
        room_key = room_clean.casefold()
        if room_key in seen:
            continue
        seen.add(room_key)
        clean.append(room_clean)

    return clean


def _template_objects_for_room_name(template_map: dict, room_name: str):
    if not isinstance(template_map, dict):
        return []
    direct = template_map.get(str(room_name or "").strip())
    if isinstance(direct, list):
        return direct
    fallback_key = _template_room_key(room_name)
    fallback = template_map.get(fallback_key)
    if isinstance(fallback, list):
        return fallback
    return []

def load_projects():
    """Fetch projects for the logged-in user only (defense in depth)."""
    try:
        access_token = _token()
        user_id = str(st.session_state.get("user_id") or "").strip()
        if not access_token or not user_id:
            return []

        sb = get_supabase(access_token)
        res = (
            sb.table("projects")
            .select("*")
            .eq("owner_id", user_id)
            .order("updated_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:
        st.error(f"Failed to load projects from Supabase: {e}")
        return []


def create_project(name: str, rooms=None, template: str = "small_villa", template_map: dict | None = None):
    """
    Create a project + rooms + default room_objects.
    rooms:
      - if provided: creates these room names (template objects only for matching names)
      - if None/empty: creates rooms from SMALL_VILLA_TEMPLATE keys
    template_map:
      - if provided: this template overrides SMALL_VILLA_TEMPLATE
    """
    name_clean = (name or "").strip()
    project_id = None

    if not name_clean:
        st.warning("⚠️ Project name cannot be empty.")
        return load_projects()

    try:
        sb = get_supabase(_token())

        # Prevent duplicates (best effort; RLS will scope to user)
        existing = sb.table("projects").select("id,name").eq("name", name_clean).execute().data or []
        if existing:
            st.warning(f"⚠️ Project '{name_clean}' already exists.")
            return load_projects()

        # 1) Create project
        project_payload = {
            "name": name_clean,
            "cart": [],
        }

        # If you already added owner_id to projects, set it here
        if st.session_state.get("user_id"):
            project_payload["owner_id"] = st.session_state.user_id

        proj_res = sb.table("projects").insert(project_payload).execute()
        if not proj_res.data:
            raise RuntimeError("Failed to create project (insert returned no data).")

        project_id = proj_res.data[0]["id"]

        template_source = _normalize_template_map(template_map) or _normalize_template_map(SMALL_VILLA_TEMPLATE)

        # 2) Decide room names
        rooms = rooms or []
        if rooms:
            room_names = _normalize_room_names(rooms)
        else:
            room_names = _normalize_room_names(list(template_source.keys()))

        if not room_names:
            sb.table("projects").delete().eq("id", project_id).execute()
            raise RuntimeError("Failed to create project rooms.")

        # 3) Insert rooms (bulk)
        rooms_payload = [{"project_id": project_id, "name": rname} for rname in room_names]
        room_res = sb.table("project_rooms").insert(rooms_payload).execute()
        created_rooms = room_res.data or []
        if not created_rooms:
            sb.table("projects").delete().eq("id", project_id).execute()
            raise RuntimeError("Failed to create project rooms.")

        # 4) Insert room objects (bulk)
        objects_payload = []
        for room_row in created_rooms:
            rid = room_row["id"]
            rname = room_row["name"]

            for obj in _template_objects_for_room_name(template_source, rname):
                objects_payload.append({
                    "room_id": rid,
                    "object_key": str(obj.get("key") or "").strip() or _slugify(obj.get("name") or "item"),
                    "object_name": str(obj.get("name") or "").strip() or "Item",
                    "category": obj.get("category"),
                    "qty": _safe_qty(obj.get("qty", 1)),
                    "status": "unassigned",
                    "material_id": None,
                })

        if objects_payload:
            sb.table("room_objects").insert(objects_payload).execute()

        # 5) Set current project id for UI jump
        st.session_state.current_project_id = project_id

        st.success(f"✅ Created new project: {name_clean}")
        return load_projects()

    except Exception as e:
        if project_id:
            try:
                sb.table("projects").delete().eq("id", project_id).execute()
            except Exception:
                pass
            st.session_state.pop("current_project_id", None)
        st.error(f"❌ Failed to create project: {e}")
        return load_projects()


def _project_name_exists(sb, project_name: str, user_id: str | None = None):
    query = sb.table("projects").select("id").eq("name", project_name)
    if user_id:
        query = query.eq("owner_id", user_id)
    rows = query.execute().data or []
    return bool(rows)


def _next_duplicate_project_name(sb, source_name: str, user_id: str | None = None):
    query = sb.table("projects").select("name")
    if user_id:
        query = query.eq("owner_id", user_id)
    rows = query.execute().data or []
    existing_names = {str(row.get("name") or "").strip().casefold() for row in rows if row.get("name")}

    base = f"{source_name} (Copy)"
    if base.casefold() not in existing_names:
        return base

    index = 2
    while True:
        candidate = f"{source_name} (Copy {index})"
        if candidate.casefold() not in existing_names:
            return candidate
        index += 1


def _portable_duplicate_cart_payload(source_cart):
    if not isinstance(source_cart, dict):
        return []

    payload = {}
    design_brief = source_cart.get("design_brief")
    if isinstance(design_brief, dict):
        payload["design_brief"] = copy.deepcopy(design_brief)
    return payload or []


def _delete_project_tree(sb, project_id: str):
    """
    Best-effort cleanup for project + rooms + room_objects.
    """
    project_key = str(project_id or "").strip()
    if not project_key:
        return

    room_rows = (
        sb.table("project_rooms")
        .select("id")
        .eq("project_id", project_key)
        .execute()
        .data
        or []
    )
    for room_row in room_rows:
        room_id = str(room_row.get("id") or "").strip()
        if room_id:
            sb.table("room_objects").delete().eq("room_id", room_id).execute()
    sb.table("project_rooms").delete().eq("project_id", project_key).execute()
    sb.table("projects").delete().eq("id", project_key).execute()


def duplicate_project(
    project_id: str,
    new_name: str | None = None,
    include_materials: bool = False,
    show_feedback: bool = True,
):
    """
    Duplicate a project for the current user.
    - include_materials=False: copy room/object structure only.
    - include_materials=True: copy assigned material_id to each object and reset status to "selected".
    Object-level comments/share metadata are intentionally not copied.
    Returns new project id (str) on success, otherwise None.
    """
    source_project_id = str(project_id or "").strip()
    if not source_project_id:
        if show_feedback:
            st.warning("Project id is required.")
        return None

    sb = None
    created_project_id = None
    created_room_ids = []

    try:
        sb = get_supabase(_token())
        user_id = str(st.session_state.get("user_id") or "").strip()

        source_query = (
            sb.table("projects")
            .select("id, name, cart, owner_id")
            .eq("id", source_project_id)
            .limit(1)
        )
        if user_id:
            source_query = source_query.eq("owner_id", user_id)
        source_rows = source_query.execute().data or []
        if not source_rows:
            if show_feedback:
                st.error("Project not found.")
            return None
        source_project = source_rows[0]

        source_name = str(source_project.get("name") or "Project").strip() or "Project"
        target_name = str(new_name or "").strip()
        if not target_name:
            target_name = _next_duplicate_project_name(sb, source_name, user_id=user_id or None)

        if _project_name_exists(sb, target_name, user_id=user_id or None):
            if show_feedback:
                st.warning(f"⚠️ Project '{target_name}' already exists.")
            return None

        project_payload = {
            "name": target_name,
            "cart": _portable_duplicate_cart_payload(source_project.get("cart")),
        }
        owner_id = str(source_project.get("owner_id") or user_id or "").strip()
        if owner_id:
            project_payload["owner_id"] = owner_id

        inserted_project = sb.table("projects").insert(project_payload).execute().data or []
        if not inserted_project:
            raise RuntimeError("Failed to create duplicated project.")
        created_project_id = str(inserted_project[0].get("id"))
        if not created_project_id:
            raise RuntimeError("Duplicated project id is missing.")

        source_rooms = (
            sb.table("project_rooms")
            .select("id, name")
            .eq("project_id", source_project_id)
            .order("name")
            .execute()
            .data
            or []
        )
        expected_rooms_count = len(source_rooms)

        room_id_map = {}
        for source_room in source_rooms:
            source_room_id = str(source_room.get("id") or "").strip()
            if not source_room_id:
                continue
            room_name = str(source_room.get("name") or "").strip() or "Room"
            room_rows = (
                sb.table("project_rooms")
                .insert({"project_id": created_project_id, "name": room_name})
                .execute()
                .data
                or []
            )
            if not room_rows:
                raise RuntimeError("Failed to duplicate project rooms.")

            created_room = room_rows[0]
            created_room_id = str(created_room.get("id") or "").strip()
            if not created_room_id:
                raise RuntimeError("Duplicated room id is missing.")

            created_room_ids.append(created_room_id)
            room_id_map[source_room_id] = created_room_id

        objects_payload = []
        for source_room_id, target_room_id in room_id_map.items():
            source_objects = (
                sb.table("room_objects")
                .select("object_key, object_name, category, qty, status, material_id")
                .eq("room_id", source_room_id)
                .execute()
                .data
                or []
            )
            for source_obj in source_objects:
                source_material_id = source_obj.get("material_id")
                material_id = source_material_id if (include_materials and source_material_id) else None
                status = "selected" if material_id else "unassigned"

                objects_payload.append(
                    {
                        "room_id": target_room_id,
                        "object_key": str(source_obj.get("object_key") or "").strip()
                        or _slugify(source_obj.get("object_name") or "item"),
                        "object_name": str(source_obj.get("object_name") or "").strip() or "Item",
                        "category": source_obj.get("category"),
                        "qty": _safe_qty(source_obj.get("qty", 1)),
                        "status": status,
                        "material_id": material_id,
                    }
                )
        expected_objects_count = len(objects_payload)

        if objects_payload:
            sb.table("room_objects").insert(objects_payload).execute()

        # Validate clone completeness. If counts mismatch, force rollback.
        cloned_rooms = (
            sb.table("project_rooms")
            .select("id")
            .eq("project_id", created_project_id)
            .execute()
            .data
            or []
        )
        actual_rooms_count = len(cloned_rooms)
        if actual_rooms_count != expected_rooms_count:
            raise RuntimeError(
                f"Incomplete duplicate: expected {expected_rooms_count} rooms, got {actual_rooms_count}."
            )

        actual_objects_count = 0
        for cloned_room in cloned_rooms:
            cloned_room_id = str(cloned_room.get("id") or "").strip()
            if not cloned_room_id:
                continue
            room_objects = (
                sb.table("room_objects")
                .select("id")
                .eq("room_id", cloned_room_id)
                .execute()
                .data
                or []
            )
            actual_objects_count += len(room_objects)

        if actual_objects_count != expected_objects_count:
            raise RuntimeError(
                f"Incomplete duplicate: expected {expected_objects_count} objects, got {actual_objects_count}."
            )

        if show_feedback:
            st.success(f"✅ Created duplicate project: {target_name}")
        return created_project_id
    except Exception as e:
        if sb is not None and created_project_id:
            try:
                # Query by project id instead of only tracked room ids, so partial inserts also get removed.
                _delete_project_tree(sb, created_project_id)
            except Exception:
                pass
        if show_feedback:
            st.error(f"❌ Failed to duplicate project: {e}")
        return None


def duplicate_project_bulk(project_id: str, copies_count: int, include_materials: bool = False):
    """
    Duplicate one project multiple times.
    Returns list of new project ids.
    """
    try:
        count = int(copies_count)
    except Exception:
        count = 0

    if count <= 0:
        st.warning("Copies count must be at least 1.")
        return []

    created_ids = []
    for _ in range(count):
        new_id = duplicate_project(
            project_id=project_id,
            new_name=None,
            include_materials=include_materials,
            show_feedback=False,
        )
        if not new_id:
            st.error(
                f"❌ Bulk duplication stopped after {len(created_ids)} of {count} copies."
            )
            return created_ids
        created_ids.append(str(new_id))

    st.success(f"✅ Created {len(created_ids)} duplicate project(s).")
    return created_ids


def _touch_project(project_id: str):
    try:
        sb = get_supabase(_token())
        sb.table("projects").update({"updated_at": "now()"}).eq("id", project_id).execute()
    except Exception:
        # Non-critical best-effort metadata update.
        pass


def update_project_name(project_id: str, new_name: str):
    name_clean = (new_name or "").strip()
    if not name_clean:
        st.warning("⚠️ Project name cannot be empty.")
        return False

    try:
        sb = get_supabase(_token())
        rows = (
            sb.table("projects")
            .select("id,name")
            .eq("name", name_clean)
            .execute()
            .data
            or []
        )
        conflict = [r for r in rows if str(r.get("id")) != str(project_id)]
        if conflict:
            st.warning(f"⚠️ Project '{name_clean}' already exists.")
            return False

        sb.table("projects").update({"name": name_clean, "updated_at": "now()"}).eq("id", project_id).execute()
        return True
    except Exception as e:
        st.error(f"❌ Failed to update project name: {e}")
        return False


def rename_project_room(project_id: str, room_id: str, new_name: str):
    name_clean = (new_name or "").strip()
    if not name_clean:
        st.warning("⚠️ Room name cannot be empty.")
        return False

    try:
        sb = get_supabase(_token())
        target = (
            sb.table("project_rooms")
            .select("id,name")
            .eq("id", room_id)
            .eq("project_id", project_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not target:
            st.error("❌ Room not found for this project.")
            return False

        existing = (
            sb.table("project_rooms")
            .select("id")
            .eq("project_id", project_id)
            .eq("name", name_clean)
            .execute()
            .data
            or []
        )
        if any(str(row.get("id")) != str(room_id) for row in existing):
            st.warning(f"⚠️ Room '{name_clean}' already exists in this project.")
            return False

        sb.table("project_rooms").update({"name": name_clean}).eq("id", room_id).eq("project_id", project_id).execute()
        _touch_project(project_id)
        return True
    except Exception as e:
        st.error(f"❌ Failed to rename room: {e}")
        return False


def add_project_room(project_id: str, room_name: str, template_map: dict | None = None):
    room_clean = (room_name or "").strip()
    if not room_clean:
        st.warning("⚠️ Room name cannot be empty.")
        return False

    try:
        sb = get_supabase(_token())
        existing = (
            sb.table("project_rooms")
            .select("id")
            .eq("project_id", project_id)
            .eq("name", room_clean)
            .execute()
            .data
            or []
        )
        if existing:
            st.warning(f"⚠️ Room '{room_clean}' already exists.")
            return False

        room_res = (
            sb.table("project_rooms")
            .insert({"project_id": project_id, "name": room_clean})
            .execute()
        )
        created = room_res.data[0] if room_res.data else None
        if not created:
            raise RuntimeError("Failed to create room.")

        template_source = _normalize_template_map(template_map) or _normalize_template_map(SMALL_VILLA_TEMPLATE)
        objects_payload = []
        for obj in _template_objects_for_room_name(template_source, room_clean):
            objects_payload.append(
                {
                    "room_id": created["id"],
                    "object_key": str(obj.get("key") or "").strip() or _slugify(obj.get("name") or "item"),
                    "object_name": str(obj.get("name") or "").strip() or "Item",
                    "category": obj.get("category"),
                    "qty": _safe_qty(obj.get("qty", 1)),
                    "status": "unassigned",
                    "material_id": None,
                }
            )

        if objects_payload:
            sb.table("room_objects").insert(objects_payload).execute()

        _touch_project(project_id)
        return True
    except Exception as e:
        st.error(f"❌ Failed to add room: {e}")
        return False


def _prune_project_cart_object_metadata(project_id: str, object_ids):
    object_keys = {str(oid) for oid in (object_ids or []) if oid is not None}
    if not object_keys:
        return

    try:
        items, cart_meta = _project_cart_items_and_meta(project_id)
        if isinstance(items, list):
            next_items = []
            for row in items:
                if not isinstance(row, dict):
                    next_items.append(row)
                    continue
                ref_id = row.get("object_id")
                if ref_id is not None and str(ref_id) in object_keys:
                    continue
                next_items.append(row)
            cart_meta["items"] = next_items

        for key in ["comments", "approval_history", "assignment_notes"]:
            block = cart_meta.get(key)
            if isinstance(block, dict):
                cart_meta[key] = {str(k): v for k, v in block.items() if str(k) not in object_keys}

        procurement = cart_meta.get("procurement")
        if isinstance(procurement, dict):
            clean_procurement = dict(procurement)
            for key in ["notes", "quote_status", "priority", "target_price", "order_stage"]:
                block = clean_procurement.get(key)
                if isinstance(block, dict):
                    clean_procurement[key] = {
                        str(k): v for k, v in block.items() if str(k) not in object_keys
                    }
            cart_meta["procurement"] = clean_procurement

        _save_project_cart(project_id, cart_meta)
    except Exception:
        # Best effort cleanup to avoid surfacing unrelated failures to users.
        pass


def delete_project_room(project_id: str, room_id: str):
    try:
        sb = get_supabase(_token())
        target = (
            sb.table("project_rooms")
            .select("id")
            .eq("id", room_id)
            .eq("project_id", project_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not target:
            st.error("❌ Room not found for this project.")
            return False

        obj_rows = (
            sb.table("room_objects")
            .select("id")
            .eq("room_id", room_id)
            .execute()
            .data
            or []
        )
        object_ids = [str(row.get("id")) for row in obj_rows if row.get("id") is not None]

        if object_ids:
            sb.table("room_objects").delete().eq("room_id", room_id).execute()
            _prune_project_cart_object_metadata(project_id, object_ids)

        sb.table("project_rooms").delete().eq("id", room_id).eq("project_id", project_id).execute()
        _touch_project(project_id)
        return True
    except Exception as e:
        st.error(f"❌ Failed to delete room: {e}")
        return False


def delete_project(project_id: str):
    project_key = str(project_id or "").strip()
    if not project_key:
        st.warning("Project id is required.")
        return False

    try:
        sb = get_supabase(_token())
        user_id = str(st.session_state.get("user_id") or "").strip()

        target_query = sb.table("projects").select("id").eq("id", project_key).limit(1)
        if user_id:
            target_query = target_query.eq("owner_id", user_id)
        target = target_query.execute().data or []
        if not target:
            st.error("Project not found.")
            return False

        room_rows = (
            sb.table("project_rooms")
            .select("id")
            .eq("project_id", project_key)
            .execute()
            .data
            or []
        )
        room_ids = [str(row.get("id")) for row in room_rows if row.get("id") is not None]
        if room_ids:
            sb.table("room_objects").delete().in_("room_id", room_ids).execute()
            sb.table("project_rooms").delete().eq("project_id", project_key).execute()

        delete_query = sb.table("projects").delete().eq("id", project_key)
        if user_id:
            delete_query = delete_query.eq("owner_id", user_id)
        delete_query.execute()
        return True
    except Exception as e:
        st.error(f"Failed to delete project: {e}")
        return False


def get_current_cart(projects, project_id: str):
    """Return cart for the selected project id from the provided list."""
    for p in projects:
        if str(p.get("id")) == str(project_id):
            cart = p.get("cart", []) or []
            if isinstance(cart, dict):
                return cart.get("items", []) or []
            return cart
    return []


def update_current_cart(project_id: str, updated_cart):
    """Update cart for a specific project id."""
    try:
        sb = get_supabase(_token())
        proj = (
            sb.table("projects")
            .select("cart")
            .eq("id", project_id)
            .limit(1)
            .execute()
            .data
        )
        existing_cart = (proj[0].get("cart") if proj else None) or []

        payload_cart = updated_cart
        if isinstance(existing_cart, dict):
            payload_cart = {
                "items": updated_cart,
                "budget": existing_cart.get("budget", {"project": None, "rooms": {}}),
            }

        sb.table("projects").update({"cart": payload_cart, "updated_at": "now()"}).eq("id", project_id).execute()
    except Exception as e:
        st.error(f"❌ Failed to update cart for project '{project_id}': {e}")


def get_project_budget_from_row(project_row: dict | None):
    """
    Read budget config from a project row cart payload.
    Backward compatible with legacy `cart: []`.
    Returns: {"project": float | None, "rooms": {room_id: float}}
    """
    default = {"project": None, "rooms": {}}
    if not project_row:
        return default

    cart = (project_row.get("cart") if isinstance(project_row, dict) else None) or []
    if not isinstance(cart, dict):
        return default

    budget = cart.get("budget") or {}
    project_budget = budget.get("project")
    room_budgets = budget.get("rooms") or {}

    clean_rooms = {}
    if isinstance(room_budgets, dict):
        for k, v in room_budgets.items():
            try:
                if v is None:
                    continue
                clean_rooms[str(k)] = float(v)
            except Exception:
                continue

    try:
        project_budget = float(project_budget) if project_budget is not None else None
    except Exception:
        project_budget = None

    return {"project": project_budget, "rooms": clean_rooms}


def save_project_budget(project_id: str, project_budget: float | None, room_budgets: dict):
    """
    Persist budget config inside `projects.cart.budget` while preserving existing cart items.
    """
    try:
        sb = get_supabase(_token())
        proj = (
            sb.table("projects")
            .select("cart")
            .eq("id", project_id)
            .limit(1)
            .execute()
            .data
        )
        existing_cart = (proj[0].get("cart") if proj else None) or []

        if isinstance(existing_cart, dict):
            items = existing_cart.get("items", []) or []
        elif isinstance(existing_cart, list):
            items = existing_cart
        else:
            items = []

        clean_rooms = {}
        if isinstance(room_budgets, dict):
            for k, v in room_budgets.items():
                if v is None:
                    continue
                clean_rooms[str(k)] = float(v)

        payload = {
            "items": items,
            "budget": {
                "project": float(project_budget) if project_budget is not None else None,
                "rooms": clean_rooms,
            },
        }

        sb.table("projects").update({"cart": payload, "updated_at": "now()"}).eq("id", project_id).execute()
        return True
    except Exception as e:
        st.error(f"❌ Failed to save budget for project '{project_id}': {e}")
        return False


def _project_cart_items_and_meta(project_id: str):
    """
    Return (items, meta_dict) from projects.cart in a backward-compatible way.
    `meta_dict` stores optional nested data such as budget/share/comments.
    """
    sb = get_supabase(_token())
    proj = (
        sb.table("projects")
        .select("cart")
        .eq("id", project_id)
        .limit(1)
        .execute()
        .data
    )
    existing_cart = (proj[0].get("cart") if proj else None) or []

    if isinstance(existing_cart, dict):
        items = existing_cart.get("items", []) or []
        meta = dict(existing_cart)
        return items, meta

    if isinstance(existing_cart, list):
        return existing_cart, {"items": existing_cart}

    return [], {"items": []}


def _save_project_cart(project_id: str, cart_payload: dict):
    sb = get_supabase(_token())
    sb.table("projects").update({"cart": cart_payload, "updated_at": "now()"}).eq("id", project_id).execute()


def get_project_share_from_row(project_row: dict | None):
    """
    Extract share metadata from project cart payload.
    Returns:
      {
        "token": str | None,
        "created_at": str | None,
        "enabled": bool
      }
    """
    default = {"token": None, "created_at": None, "enabled": False}
    if not project_row or not isinstance(project_row, dict):
        return default

    cart = project_row.get("cart") or {}
    if not isinstance(cart, dict):
        return default

    share = cart.get("share") or {}
    if not isinstance(share, dict):
        return default

    token = share.get("token")
    created_at = share.get("created_at")
    enabled = _coerce_bool(share.get("enabled"))
    if not isinstance(token, str) or not token.strip():
        token = None
    if not isinstance(created_at, str) or not created_at.strip():
        created_at = None

    return {"token": token, "created_at": created_at, "enabled": enabled}


def rotate_project_share_token(project_id: str):
    """
    Generate and persist a new client share token for a project.
    """
    try:
        items, cart_meta = _project_cart_items_and_meta(project_id)
        token = secrets.token_urlsafe(24)
        cart_meta["items"] = items
        cart_meta["share"] = {
            "token": token,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "enabled": True,
        }
        _save_project_cart(project_id, cart_meta)
        return token
    except Exception as e:
        st.error(f"❌ Failed to rotate share token for project '{project_id}': {e}")
        return None


def set_project_share_enabled(project_id: str, enabled: bool):
    try:
        items, cart_meta = _project_cart_items_and_meta(project_id)
        share = cart_meta.get("share") if isinstance(cart_meta.get("share"), dict) else {}
        share["enabled"] = bool(enabled)
        cart_meta["items"] = items
        cart_meta["share"] = share
        _save_project_cart(project_id, cart_meta)
        return True
    except Exception as e:
        st.error(f"❌ Failed to update share settings for project '{project_id}': {e}")
        return False


def append_object_comment(project_id: str, object_id: str, author_role: str, author_name: str, comment: str):
    """
    Persist a per-object comment inside projects.cart.comments.
    """
    text = (comment or "").strip()
    if not text:
        return False

    try:
        items, cart_meta = _project_cart_items_and_meta(project_id)
        comments = cart_meta.get("comments")
        if not isinstance(comments, dict):
            comments = {}

        key = str(object_id)
        rows = comments.get(key)
        if not isinstance(rows, list):
            rows = []

        rows.append(
            {
                "author_role": (author_role or "unknown").strip(),
                "author_name": (author_name or "Unknown").strip(),
                "comment": text,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

        comments[key] = rows
        cart_meta["items"] = items
        cart_meta["comments"] = comments
        _save_project_cart(project_id, cart_meta)
        return True
    except Exception as e:
        st.error(f"❌ Failed to save comment: {e}")
        return False


def _append_object_approval_event(
    project_id: str,
    object_id: str,
    action: str,
    actor_role: str,
    actor_name: str,
):
    """
    Persist per-object approval history in projects.cart.approval_history.
    """
    if action not in {"approved", "unapproved"}:
        return False

    try:
        items, cart_meta = _project_cart_items_and_meta(project_id)
        history = cart_meta.get("approval_history")
        if not isinstance(history, dict):
            history = {}

        key = str(object_id)
        rows = history.get(key)
        if not isinstance(rows, list):
            rows = []

        rows.append(
            {
                "action": action,
                "actor_role": (actor_role or "unknown").strip(),
                "actor_name": (actor_name or "Unknown").strip(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

        history[key] = rows
        cart_meta["items"] = items
        cart_meta["approval_history"] = history
        _save_project_cart(project_id, cart_meta)
        return True
    except Exception as e:
        st.error(f"❌ Failed to save approval history: {e}")
        return False


def get_object_comments_from_row(project_row: dict | None, object_id: str):
    if not project_row or not isinstance(project_row, dict):
        return []

    cart = project_row.get("cart") or {}
    if not isinstance(cart, dict):
        return []

    comments = cart.get("comments") or {}
    if not isinstance(comments, dict):
        return []

    rows = comments.get(str(object_id)) or []
    if not isinstance(rows, list):
        return []
    return rows


def get_object_approval_history_from_row(project_row: dict | None, object_id: str):
    if not project_row or not isinstance(project_row, dict):
        return []

    cart = project_row.get("cart") or {}
    if not isinstance(cart, dict):
        return []

    history = cart.get("approval_history") or {}
    if not isinstance(history, dict):
        return []

    rows = history.get(str(object_id)) or []
    if not isinstance(rows, list):
        return []
    return rows


def _clean_share_token(share_token: str | None):
    token = (share_token or "").strip()
    return token or None


def _coerce_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on", "enabled"}
    return False


def get_shared_project_by_token(share_token: str | None):
    """
    Return one project that has a matching enabled share token.
    """
    token = _clean_share_token(share_token)
    if not token:
        return None

    try:
        sb = get_supabase(None)
        rows = (
            sb.table("projects")
            .select("*")
            .contains("cart", {"share": {"token": token}})
            .limit(1)
            .execute()
            .data
            or []
        )
        if not rows:
            return None
        project = rows[0]
        share_meta = get_project_share_from_row(project)
        if not share_meta.get("enabled"):
            return None
        return project
    except Exception as e:
        st.error(f"❌ Failed to load shared project: {e}")
        return None


def _room_belongs_to_project(sb, room_id: str, project_id: str):
    rows = (
        sb.table("project_rooms")
        .select("id")
        .eq("id", room_id)
        .eq("project_id", project_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    return bool(rows)


def _object_row(sb, object_id: str):
    rows = (
        sb.table("room_objects")
        .select("id, room_id, material_id, status")
        .eq("id", object_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


def update_object_status_by_share_token(
    share_token: str,
    object_id: str,
    new_status: str,
    actor_name: str | None = None,
):
    """
    Update a single object's status through share token access.
    Returns: (ok: bool, message: str)
    """
    allowed = {"selected", "client_approved"}
    if new_status not in allowed:
        return False, "Invalid status requested."

    project = get_shared_project_by_token(share_token)
    if not project:
        return False, "Shared project link is invalid or disabled."

    try:
        sb = get_supabase(None)
        obj = _object_row(sb, object_id)
        if not obj:
            return False, "Object not found."

        if not _room_belongs_to_project(sb, str(obj.get("room_id")), str(project.get("id"))):
            return False, "Object does not belong to this shared project."

        if new_status == "client_approved" and not obj.get("material_id"):
            return False, "Cannot approve an object without assigned material."

        current_status = obj.get("status") or "unassigned"
        if current_status == new_status:
            return True, "Status already up to date."

        sb.table("room_objects").update({"status": new_status}).eq("id", object_id).execute()
        action = "approved" if new_status == "client_approved" else "unapproved"
        _append_object_approval_event(
            project_id=str(project.get("id")),
            object_id=str(object_id),
            action=action,
            actor_role="client",
            actor_name=(actor_name or "Client"),
        )
        return True, "Status updated."
    except Exception as e:
        return False, f"Failed to update object status: {e}"


def update_room_status_by_share_token(
    share_token: str,
    room_id: str,
    approve_all: bool,
    actor_name: str | None = None,
):
    """
    Bulk approve or unapprove all assigned objects in a room via share token.
    Returns: (ok: bool, message: str)
    """
    project = get_shared_project_by_token(share_token)
    if not project:
        return False, "Shared project link is invalid or disabled."

    try:
        sb = get_supabase(None)
        if not _room_belongs_to_project(sb, room_id, str(project.get("id"))):
            return False, "Room does not belong to this shared project."

        rows = (
            sb.table("room_objects")
            .select("id, material_id, status")
            .eq("room_id", room_id)
            .execute()
            .data
            or []
        )
        assigned = [r for r in rows if r.get("material_id")]

        if approve_all:
            target_ids = [str(r["id"]) for r in assigned if r.get("status") != "client_approved"]
            next_status = "client_approved"
        else:
            target_ids = [str(r["id"]) for r in assigned if r.get("status") == "client_approved"]
            next_status = "selected"

        for oid in target_ids:
            sb.table("room_objects").update({"status": next_status}).eq("id", oid).execute()
            _append_object_approval_event(
                project_id=str(project.get("id")),
                object_id=str(oid),
                action=("approved" if approve_all else "unapproved"),
                actor_role="client",
                actor_name=(actor_name or "Client"),
            )

        action = "approved" if approve_all else "reset"
        return True, f"{len(target_ids)} object(s) {action}."
    except Exception as e:
        return False, f"Failed to update room approvals: {e}"


def append_object_comment_by_share_token(share_token: str, object_id: str, author_name: str, comment: str):
    """
    Append a comment to an object using share token context.
    Returns: (ok: bool, message: str)
    """
    project = get_shared_project_by_token(share_token)
    if not project:
        return False, "Shared project link is invalid or disabled."

    try:
        sb = get_supabase(None)
        obj = _object_row(sb, object_id)
        if not obj:
            return False, "Object not found."

        if not _room_belongs_to_project(sb, str(obj.get("room_id")), str(project.get("id"))):
            return False, "Object does not belong to this shared project."

        ok = append_object_comment(
            project_id=str(project.get("id")),
            object_id=str(object_id),
            author_role="client",
            author_name=(author_name or "Client"),
            comment=comment,
        )
        if not ok:
            return False, "Failed to save comment."
        return True, "Comment saved."
    except Exception as e:
        return False, f"Failed to save comment: {e}"

def load_project_rooms(project_id: str):
    sb = get_supabase(_token())
    # Some deployments do not have project_rooms.created_at.
    # Keep a deterministic order without relying on optional schema columns.
    res = sb.table("project_rooms").select("*").eq("project_id", project_id).order("name").execute()
    rooms = res.data or []
    if rooms:
        return rooms

    legacy_project_rows = (
        sb.table("projects")
        .select("rooms")
        .eq("id", project_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    legacy_rooms = _normalize_room_names((legacy_project_rows[0] or {}).get("rooms") if legacy_project_rows else [])
    if not legacy_rooms:
        return []

    created = (
        sb.table("project_rooms")
        .insert([{"project_id": project_id, "name": room_name} for room_name in legacy_rooms])
        .execute()
        .data
        or []
    )
    return created


def load_room_objects(room_id: str):
    sb = get_supabase(_token())
    res = sb.table("room_objects").select("*").eq("room_id", room_id).order("category").execute()
    return res.data or []


def load_room_objects_batch(room_ids):
    """
    Batch fetch objects for many rooms.
    Returns {room_id: [objects...]}
    """
    out = {str(rid): [] for rid in (room_ids or [])}
    if not room_ids:
        return out

    sb = get_supabase(_token())
    rows = (
        sb.table("room_objects")
        .select("*")
        .in_("room_id", room_ids)
        .execute()
        .data
        or []
    )

    for row in rows:
        rid = str(row.get("room_id"))
        out.setdefault(rid, []).append(row)

    return out


def load_room_statuses(room_ids):
    """
    Batch status aggregation for many rooms in one query.
    Returns: {room_id: {total, assigned, designer_ok, client_ok}}
    """
    status_by_room = {
        str(rid): {"total": 0, "assigned": 0, "designer_ok": 0, "client_ok": 0}
        for rid in (room_ids or [])
    }
    if not room_ids:
        return status_by_room

    sb = get_supabase(_token())
    objs = (
        sb.table("room_objects")
        .select("room_id, material_id, status")
        .in_("room_id", room_ids)
        .execute()
        .data
        or []
    )

    for o in objs:
        rid = str(o.get("room_id"))
        if rid not in status_by_room:
            status_by_room[rid] = {"total": 0, "assigned": 0, "designer_ok": 0, "client_ok": 0}

        slot = status_by_room[rid]
        slot["total"] += 1
        if o.get("material_id"):
            slot["assigned"] += 1
        if o.get("status") == "designer_approved":
            slot["designer_ok"] += 1
        if o.get("status") == "client_approved":
            slot["client_ok"] += 1

    return status_by_room


def load_projects_statuses(project_ids):
    """
    Batch status aggregation for many projects.
    Returns: {project_id: {rooms, total, assigned, designer_ok, client_ok}}
    """
    base = {
        str(pid): {"rooms": 0, "total": 0, "assigned": 0, "designer_ok": 0, "client_ok": 0}
        for pid in (project_ids or [])
    }
    if not project_ids:
        return base

    sb = get_supabase(_token())
    rooms = (
        sb.table("project_rooms")
        .select("id, project_id")
        .in_("project_id", project_ids)
        .execute()
        .data
        or []
    )

    room_ids = [r["id"] for r in rooms]
    room_stats = load_room_statuses(room_ids)

    for r in rooms:
        pid = str(r.get("project_id"))
        rid = str(r.get("id"))
        if pid not in base:
            base[pid] = {"rooms": 0, "total": 0, "assigned": 0, "designer_ok": 0, "client_ok": 0}

        slot = base[pid]
        slot["rooms"] += 1

        rs = room_stats.get(rid, {"total": 0, "assigned": 0, "designer_ok": 0, "client_ok": 0})
        slot["total"] += rs["total"]
        slot["assigned"] += rs["assigned"]
        slot["designer_ok"] += rs["designer_ok"]
        slot["client_ok"] += rs["client_ok"]

    return base


def room_status(room_id: str):
    return load_room_statuses([room_id]).get(
        str(room_id), {"total": 0, "assigned": 0, "designer_ok": 0, "client_ok": 0}
    )


def project_status(project_id: str):
    return load_projects_statuses([project_id]).get(
        str(project_id), {"rooms": 0, "total": 0, "assigned": 0, "designer_ok": 0, "client_ok": 0}
    )

