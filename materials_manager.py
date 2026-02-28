from supabase_client import get_supabase
from embedding import get_embedder

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


def search_materials_semantic(access_token: str, query: str, limit: int = 20):
    """
    Search materials via DB-side semantic search.
    Expected DB function:
      match_materials(query_embedding vector, match_count int)
    Fallback:
      DB text search with ILIKE over common fields.
    """
    q = (query or "").strip()
    if not q:
        return []

    sb = get_supabase(access_token)

    # Preferred path: pgvector similarity via RPC function in the DB.
    try:
        model = get_embedder()
        query_embedding = model.encode(q, convert_to_numpy=True).tolist()
        res = sb.rpc("match_materials", {"query_embedding": query_embedding, "match_count": limit}).execute()
        if res.data:
            return res.data
    except Exception:
        # Fall back to text-based DB search when vector search isn't configured.
        pass

    like = f"%{q}%"
    res = (
        sb.table("materials")
        .select("*")
        .or_(f"name.ilike.{like},description.ilike.{like},category.ilike.{like}")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []
