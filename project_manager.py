# project_manager.py — with Supabase integration and room support

import streamlit as st
from supabase_client import supabase

def load_projects():
    """Fetch all projects from Supabase."""
    try:
        response = supabase.table("projects").select("*").execute()
        return response.data if response.data else []
    except Exception as e:
        st.error(f"❌ Failed to load projects from Supabase: {e}")
        return []

def save_projects(projects):
    """Overwrite all projects in Supabase."""
    try:
        supabase.table("projects").delete().neq("name", "").execute()
        for project in projects:
            supabase.table("projects").insert(project).execute()
    except Exception as e:
        st.error(f"❌ Failed to save projects to Supabase: {e}")

def create_project(name, rooms=None):
    """Create a new project with optional rooms if it doesn't exist already."""
    name_clean = name.strip()
    rooms = rooms or []

    if not name_clean:
        st.warning("⚠️ Project name cannot be empty.")
        return load_projects()

    projects = load_projects()
    if any(p["name"].strip().lower() == name_clean.lower() for p in projects):
        st.warning(f"⚠️ Project '{name_clean}' already exists.")
        return projects

    try:
        new_project = {
            "name": name_clean,
            "cart": [],
            "rooms": rooms
        }
        supabase.table("projects").insert(new_project).execute()
        st.success(f"✅ Created new project: {name_clean}")
        return load_projects()
    except Exception as e:
        st.error(f"❌ Failed to create project: {e}")
        return projects

def get_current_cart(projects, name):
    for p in projects:
        if p["name"] == name:
            return p.get("cart", [])
    return []

def update_current_cart(name, updated_cart):
    try:
        supabase.table("projects").update({"cart": updated_cart}).eq("name", name).execute()
    except Exception as e:
        st.error(f"❌ Failed to update cart for '{name}': {e}")
