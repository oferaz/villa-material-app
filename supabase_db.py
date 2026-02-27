from supabase import create_client
import os

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")  # anon key is fine with RLS
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def list_projects():
    # RLS ensures only current user projects are returned (when auth is set)
    return supabase.table("projects").select("*").order("updated_at", desc=True).execute().data

def create_project(name, rooms):
    payload = {"name": name, "rooms": rooms, "cart": []}
    return supabase.table("projects").insert(payload).execute().data[0]

def update_project_cart(project_id, cart):
    return supabase.table("projects").update({"cart": cart}).eq("id", project_id).execute()

def get_project(project_id):
    return supabase.table("projects").select("*").eq("id", project_id).single().execute().data