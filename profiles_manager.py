from supabase_client import get_supabase

def get_profile(access_token: str, user_id: str):
    sb = get_supabase(access_token)
    res = sb.table("profiles").select("*").eq("id", user_id).execute()
    return (res.data or [None])[0]