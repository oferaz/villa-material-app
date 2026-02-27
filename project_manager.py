# project_manager.py — Supabase projects (safe, no global client)

import streamlit as st
from supabase_client import get_supabase
from assets.villa_template import SMALL_VILLA_TEMPLATE

def _token() -> str:
    tok = st.session_state.get("sb_access_token")
    if not tok:
        raise RuntimeError("Missing access token. User must be logged in.")
    return tok


def load_projects():
    """Fetch projects visible to the logged-in user (RLS will filter later)."""
    try:
        sb = get_supabase(_token())
        res = sb.table("projects").select("*").order("updated_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        st.error(f"❌ Failed to load projects from Supabase: {e}")
        return []


def create_project(name: str, rooms=None, template: str = "small_villa"):
    """
    Create a project + rooms + default room_objects.
    rooms:
      - if provided: creates these room names (template objects only for matching names)
      - if None/empty: creates rooms from SMALL_VILLA_TEMPLATE keys
    """
    name_clean = (name or "").strip()

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

        # 2) Decide room names
        rooms = rooms or []
        if rooms:
            room_names = rooms
        else:
            room_names = list(SMALL_VILLA_TEMPLATE.keys())

        # 3) Insert rooms (bulk)
        rooms_payload = [{"project_id": project_id, "name": rname} for rname in room_names]
        room_res = sb.table("project_rooms").insert(rooms_payload).execute()
        created_rooms = room_res.data or []

        # 4) Insert room objects (bulk)
        objects_payload = []
        for room_row in created_rooms:
            rid = room_row["id"]
            rname = room_row["name"]

            for obj in SMALL_VILLA_TEMPLATE.get(rname, []):
                objects_payload.append({
                    "room_id": rid,
                    "object_key": obj["key"],
                    "object_name": obj["name"],
                    "category": obj.get("category"),
                    "qty": int(obj.get("qty", 1)),
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
        st.error(f"❌ Failed to create project: {e}")
        return load_projects()


def get_current_cart(projects, project_id: str):
    """Return cart for the selected project id from the provided list."""
    for p in projects:
        if str(p.get("id")) == str(project_id):
            return p.get("cart", []) or []
    return []


def update_current_cart(project_id: str, updated_cart):
    """Update cart for a specific project id."""
    try:
        sb = get_supabase(_token())
        sb.table("projects").update({"cart": updated_cart, "updated_at": "now()"}).eq("id", project_id).execute()
    except Exception as e:
        st.error(f"❌ Failed to update cart for project '{project_id}': {e}")

def load_project_rooms(project_id: str):
    sb = get_supabase(_token())
    res = sb.table("project_rooms").select("*").eq("project_id", project_id).order("created_at").execute()
    return res.data or []


def load_room_objects(room_id: str):
    sb = get_supabase(_token())
    res = sb.table("room_objects").select("*").eq("room_id", room_id).order("category").execute()
    return res.data or []


def project_status(project_id: str):
    sb = get_supabase(_token())

    rooms = sb.table("project_rooms").select("id").eq("project_id", project_id).execute().data or []
    room_ids = [r["id"] for r in rooms]
    if not room_ids:
        return {"rooms": 0, "objects": 0, "assigned": 0}

    objs = sb.table("room_objects").select("id,material_id,status").in_("room_id", room_ids).execute().data or []
    total = len(objs)
    assigned = sum(1 for o in objs if o.get("material_id"))
    return {"rooms": len(room_ids), "objects": total, "assigned": assigned}