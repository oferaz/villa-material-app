# project_manager.py — Supabase projects (safe, no global client)

import streamlit as st
from supabase_client import get_supabase


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


def create_project(name: str, rooms=None):
    """Create a new project. Uses unique id; avoids name collisions."""
    name_clean = (name or "").strip()
    rooms = rooms or []

    if not name_clean:
        st.warning("⚠️ Project name cannot be empty.")
        return load_projects()

    try:
        sb = get_supabase(_token())

        # Optional: prevent duplicate names for the SAME user (best effort).
        # With proper RLS later, this query will only see the user's projects.
        existing = sb.table("projects").select("id,name").eq("name", name_clean).execute().data or []
        if existing:
            st.warning(f"⚠️ Project '{name_clean}' already exists.")
            return load_projects()

        payload = {
            "name": name_clean,
            "rooms": rooms,
            "cart": [],
            # IMPORTANT for multi-user later:
            # once you add owner_id with RLS, you should set it here:
            # "owner_id": st.session_state.user_id
        }
        sb.table("projects").insert(payload).execute()
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