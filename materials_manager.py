from supabase_client import get_supabase
from embedding import get_embedder

def list_materials(access_token: str):
    sb = get_supabase(access_token)
    res = sb.table("materials").select("*").order("created_at", desc=True).execute()

    # res.data should be a list
    return res.data or []


def _material_text_for_embedding(payload: dict) -> str:
    tags = payload.get("tags") or []
    if isinstance(tags, list):
        tags_text = " ".join(str(t).strip() for t in tags if str(t).strip())
    else:
        tags_text = str(tags).strip()

    parts = [
        str(payload.get("name") or "").strip(),
        str(payload.get("category") or "").strip(),
        str(payload.get("description") or "").strip(),
        tags_text,
    ]
    return " ".join(p for p in parts if p).strip()


def _try_build_embedding(payload: dict):
    text = _material_text_for_embedding(payload)
    if not text:
        return None
    try:
        model = get_embedder()
        return model.encode(text, convert_to_numpy=True).tolist()
    except Exception:
        return None


def add_private_material(access_token: str, user_id: str, payload: dict):
    sb = get_supabase(access_token)
    embedding = _try_build_embedding(payload)

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
    if embedding is not None:
        row["embedding"] = embedding

    try:
        res = sb.table("materials").insert(row).execute()
    except Exception:
        # Backward compatibility: allow insert when DB has no embedding column yet.
        row.pop("embedding", None)
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
