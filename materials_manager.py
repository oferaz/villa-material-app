from supabase_client import get_supabase

def list_materials(access_token: str):
    sb = get_supabase(access_token)
    res = sb.table("materials").select("*").order("created_at", desc=True).execute()

    # res.data should be a list
    return res.data or []

def add_private_material(access_token: str, user_id: str, payload: dict):
    sb = get_supabase(access_token)

    row = {
        "owner_id": user_id,
        "visibility": "private",
        "name": payload["name"],
        "description": payload.get("description"),
        "category": payload.get("category"),
        "price": payload.get("price"),
        "link": payload.get("link"),
        "image_url": payload.get("image_url"),
        "tags": payload.get("tags", []),  # jsonb list
    }

    res = sb.table("materials").insert(row).execute()

    if not res.data:
        # This usually means RLS blocked it or the token isn't attached
        raise RuntimeError(f"Insert failed. Response: {res}")

    return res.data[0]