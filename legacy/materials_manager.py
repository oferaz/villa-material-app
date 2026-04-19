from supabase_client import get_supabase
from embedding import get_embedder
import ast
import numpy as np


GENERAL_TAG_ALIASES = {
    "general",
    "generic",
    "baseline",
    "default",
    "common",
}


def _normalize_tags(value) -> list[str]:
    if value is None:
        return []
    raw = value
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return []
        if text.startswith("[") and text.endswith("]"):
            try:
                parsed = ast.literal_eval(text)
                raw = parsed
            except Exception:
                raw = text
        else:
            raw = text
    if isinstance(raw, (list, tuple)):
        return [str(t).strip() for t in raw if str(t).strip()]
    return [str(raw).strip()] if str(raw).strip() else []


def _is_general_material(material_row: dict) -> bool:
    category = str(material_row.get("category") or "").strip().lower()
    if category == "general":
        return True
    tags = [t.lower() for t in _normalize_tags(material_row.get("tags"))]
    return any(tag in GENERAL_TAG_ALIASES for tag in tags)


def list_materials(access_token: str):
    sb = get_supabase(access_token)
    res = sb.table("materials").select("*").order("created_at", desc=True).execute()

    # res.data should be a list
    return res.data or []


def _material_text_for_embedding(payload: dict) -> str:
    tags_text = " ".join(_normalize_tags(payload.get("tags")))

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
    lead_time_days = payload.get("lead_time_days")
    try:
        lead_time_days = int(lead_time_days) if lead_time_days is not None else None
    except Exception:
        lead_time_days = None
    if lead_time_days is not None and lead_time_days <= 0:
        lead_time_days = None

    row = {
        "owner_id": user_id,
        "visibility": "private",
        "name": payload["name"],
        "description": payload.get("description"),
        "category": payload.get("category"),
        "supplier": payload.get("supplier"),
        "supplier_name": payload.get("supplier") or payload.get("supplier_name"),
        "lead_time_days": lead_time_days,
        "price": payload.get("price"),
        "link": payload.get("link"),
        "image_url": payload.get("image_url"),
        "tags": payload.get("tags", []),  # jsonb list
    }
    if embedding is not None:
        row["embedding"] = embedding

    attempts = [dict(row)]
    without_embedding = dict(row)
    without_embedding.pop("embedding", None)
    attempts.append(without_embedding)

    without_optional_columns = dict(without_embedding)
    without_optional_columns.pop("supplier", None)
    without_optional_columns.pop("supplier_name", None)
    without_optional_columns.pop("lead_time_days", None)
    attempts.append(without_optional_columns)

    last_error = None
    res = None
    for candidate in attempts:
        try:
            res = sb.table("materials").insert(candidate).execute()
            last_error = None
            break
        except Exception as exc:
            last_error = exc
            continue

    if last_error is not None:
        raise last_error

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

            lexical_score = (2.0 * phrase_hit) + (0.8 * token_hits)
            score = lexical_score

            row_vec = _coerce_vec(row.get("embedding"))
            semantic_score = None
            if query_vec is not None and row_vec is not None and row_vec.shape == query_vec.shape:
                denom = float(np.linalg.norm(query_vec) * np.linalg.norm(row_vec))
                if denom > 0:
                    semantic_score = float(np.dot(query_vec, row_vec) / denom)
                    score += max(semantic_score, 0.0) * 0.55

            is_general = _is_general_material(row)
            if is_general:
                # Keep generally tagged rows visible in object search to avoid repetitive dead-ends.
                score += 0.15

            matches_query = lexical_score > 0
            semantically_relevant = semantic_score is not None and semantic_score >= 0.20
            if matches_query or semantically_relevant or is_general:
                ranked.append((score, row))

        if ranked:
            ranked.sort(key=lambda item: (item[0], str(item[1].get("created_at") or "")), reverse=True)
            top_rows = [row for _, row in ranked[:limit]]
            seen_ids = {str(r.get("id")) for r in top_rows if r.get("id")}

            # If search is narrow, backfill with "general" rows so users always see broad alternatives.
            if len(top_rows) < limit:
                general_rows = [
                    row
                    for row in rows
                    if _is_general_material(row) and str(row.get("id")) not in seen_ids
                ]
                if general_rows:
                    general_rows.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)
                    for row in general_rows:
                        top_rows.append(row)
                        if len(top_rows) >= limit:
                            break

            return top_rows[:limit]

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
