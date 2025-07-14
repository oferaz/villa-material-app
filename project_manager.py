import os
import json
import streamlit as st

# Set safe local storage location
APP_DATA_DIR = os.path.expanduser("~/.materia_data")
os.makedirs(APP_DATA_DIR, exist_ok=True)

PROJECTS_FILE = os.path.join(APP_DATA_DIR, "projects.json")

def load_projects():
    if not os.path.exists(PROJECTS_FILE):
        return []
    with open(PROJECTS_FILE, "r") as f:
        return json.load(f)

def save_projects(projects):
    with open(PROJECTS_FILE, "w") as f:
        json.dump(projects, f, indent=2)

def create_project(name):
    name_clean = name.strip()
    if not name_clean:
        st.warning("⚠️ Project name cannot be empty.")
        return load_projects()

    name_key = name_clean.lower()
    projects = load_projects()
    
    existing_names = [p["name"].strip().lower() for p in projects]
    if name_key in existing_names:
        st.warning(f"⚠️ Project '{name_clean}' already exists.")
        return projects

    new_project = {"name": name_clean, "cart": []}
    projects.append(new_project)
    save_projects(projects)
    st.success(f"✅ Created new project: {name_clean}")
    return projects


def get_current_cart(projects, name):
    for p in projects:
        if p["name"] == name:
            return p["cart"]
    return []

def update_current_cart(name, updated_cart):
    projects = load_projects()
    for p in projects:
        if p["name"] == name:
            p["cart"] = updated_cart
            break
    save_projects(projects)
