from supabase_client import get_supabase

try:
    from postgrest.exceptions import APIError
except Exception:  # pragma: no cover - dependency may not be available in local tooling
    class APIError(Exception):
        pass

def get_profile(access_token: str, user_id: str):
    try:
        sb = get_supabase(access_token)
        res = sb.table("profiles").select("*").eq("id", user_id).limit(1).execute()
        row = (res.data or [None])[0]
        return row if isinstance(row, dict) else {}
    except APIError:
        # Keep the app running when profiles table/RLS is not configured yet.
        return {}
    except Exception:
        # Keep the app running when profiles table/RLS is not configured yet.
        return {}
