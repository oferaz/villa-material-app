from supabase_client import get_supabase
from embedding import get_embedder
import ast
import numpy as np

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

    # Search against the same visible rows as the app library (global + private under RLS),
    # then rank by lexical hits and embedding similarity when embeddings exist.
    rows = list_materials(access_token)
    if rows:
        q_lower = q.lower()
        tokens = [tok for tok in q_lower.split() if tok]

        query_vec = None
        try:
            model = get_embedder()
            query_vec = np.asarray(model.encode(q, convert_to_numpy=True), dtype=float)
        except Exception:
            query_vec = None

        def _coerce_vec(value):
            if value is None:
                return None
            parsed = value
            if isinstance(parsed, str):
                try:
                    parsed = ast.literal_eval(parsed)
                except Exception:
                    return None
            if not isinstance(parsed, (list, tuple)):
                return None
            try:
                vec = np.asarray(parsed, dtype=float)
            except Exception:
                return None
            if vec.ndim != 1 or vec.size == 0:
                return None
            return vec

        ranked = []
        for row in rows:
            text = _material_text_for_embedding(row)
            haystack = text.lower()
            token_hits = sum(1 for tok in tokens if tok in haystack)
            phrase_hit = 1 if q_lower in haystack else 0

            score = (2.0 * phrase_hit) + (0.8 * token_hits)

            row_vec = _coerce_vec(row.get("embedding"))
            if query_vec is not None and row_vec is not None and row_vec.shape == query_vec.shape:
                denom = float(np.linalg.norm(query_vec) * np.linalg.norm(row_vec))
                if denom > 0:
                    score += float(np.dot(query_vec, row_vec) / denom)

            if score > 0:
                ranked.append((score, row))

        if ranked:
            ranked.sort(key=lambda item: (item[0], str(item[1].get("created_at") or "")), reverse=True)
            return [row for _, row in ranked[:limit]]

    sb = get_supabase(access_token)

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
