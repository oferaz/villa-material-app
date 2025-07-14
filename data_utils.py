import os
import json

APP_DATA_DIR = os.path.expanduser("~/.materia_data")
os.makedirs(APP_DATA_DIR, exist_ok=True)

PROJECTS_FILE = os.path.join(APP_DATA_DIR, "projects.json")

def load_projects():
    if os.path.exists(PROJECTS_FILE):
        with open(PROJECTS_FILE, "r") as f:
            return json.load(f)
    return []

def save_projects(projects):
    with open(PROJECTS_FILE, "w") as f:
        json.dump(projects, f, indent=2)
