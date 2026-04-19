import copy
import json
import re

from supabase_client import get_supabase
from assets.villa_template import SMALL_VILLA_TEMPLATE

TEMPLATE_VERSION = 1
_DIRECT_TEMPLATE_COLUMNS = ("villa_template", "template", "template_data")
_NESTED_TEMPLATE_COLUMNS = ("settings", "preferences", "metadata")
_NESTED_TEMPLATE_KEYS = ("villa_template", "template")


def default_user_template():
    return sanitize_template_dict(copy.deepcopy(SMALL_VILLA_TEMPLATE))


def _slugify(text: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "_", str(text or "").strip().lower()).strip("_")
    return value or "item"


def _safe_qty(value) -> int:
    try:
        return max(1, int(float(value)))
    except Exception:
        return 1


def sanitize_template_dict(template_map):
    """
    Normalize a template map into:
    {
      "Room Name": [{"key": "...", "name": "...", "category": "...", "qty": 1}, ...]
    }
    """
    out = {}
    if not isinstance(template_map, dict):
        return out

    for room_name, objects in template_map.items():
        clean_room = str(room_name or "").strip()
        if not clean_room:
            continue

        clean_objects = []
        if not isinstance(objects, list):
            objects = []

        for idx, obj in enumerate(objects):
            if isinstance(obj, str):
                obj = {"name": obj}
            if not isinstance(obj, dict):
                continue

            name = str(obj.get("name") or "").strip()
            key = str(obj.get("key") or "").strip()
            category = str(obj.get("category") or "").strip() or "General"
            qty = _safe_qty(obj.get("qty", 1))

            if not name:
                if key:
                    name = key.replace("_", " ").strip().title()
                else:
                    name = f"Item {idx + 1}"
            if not key:
                key = _slugify(name)

            clean_objects.append(
                {
                    "key": key,
                    "name": name,
                    "category": category,
                    "qty": qty,
                }
            )

        out[clean_room] = clean_objects

    return out


def template_payload_from_dict(template_map):
    clean = sanitize_template_dict(template_map)
    rooms = []
    for room_name, objects in clean.items():
        rooms.append(
            {
                "name": room_name,
                "objects": [
                    {
                        "key": str(obj.get("key") or "").strip(),
                        "name": str(obj.get("name") or "").strip(),
                        "category": str(obj.get("category") or "").strip() or "General",
                        "qty": _safe_qty(obj.get("qty", 1)),
                    }
                    for obj in objects
                ],
            }
        )
    return {"version": TEMPLATE_VERSION, "rooms": rooms}


def template_dict_from_payload(payload):
    """
    Accept either:
    1) {"version": 1, "rooms": [{"name": "...", "objects": [...]}, ...]}
    2) {"Room Name": [objects...], ...}
    """
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            return {}

    if isinstance(payload, dict) and isinstance(payload.get("rooms"), list):
        as_dict = {}
        for room in payload.get("rooms") or []:
            if not isinstance(room, dict):
                continue
            room_name = str(room.get("name") or "").strip()
            if not room_name:
                continue
            objects = room.get("objects") if isinstance(room.get("objects"), list) else []
            as_dict[room_name] = objects
        return sanitize_template_dict(as_dict)

    if isinstance(payload, dict):
        return sanitize_template_dict(payload)

    return {}


def extract_template_from_profile_row(profile_row):
    if not isinstance(profile_row, dict):
        return {}

    for col in _DIRECT_TEMPLATE_COLUMNS:
        if col in profile_row:
            parsed = template_dict_from_payload(profile_row.get(col))
            if parsed:
                return parsed

    for col in _NESTED_TEMPLATE_COLUMNS:
        if col not in profile_row:
            continue
        nested = profile_row.get(col)
        if isinstance(nested, str):
            try:
                nested = json.loads(nested)
            except Exception:
                nested = {}
        if not isinstance(nested, dict):
            continue

        for key in _NESTED_TEMPLATE_KEYS:
            parsed = template_dict_from_payload(nested.get(key))
            if parsed:
                return parsed

    return {}


def load_user_template_from_profile(profile_row):
    template_map = extract_template_from_profile_row(profile_row)
    if template_map:
        return template_map
    return default_user_template()


def _template_update_candidates(profile_row, payload):
    keys = set(profile_row.keys()) if isinstance(profile_row, dict) else set()
    updates = []

    for col in _DIRECT_TEMPLATE_COLUMNS:
        if col in keys:
            updates.append({col: payload})

    for col in _NESTED_TEMPLATE_COLUMNS:
        if col not in keys:
            continue
        nested = profile_row.get(col)
        if isinstance(nested, str):
            try:
                nested = json.loads(nested)
            except Exception:
                nested = {}
        if not isinstance(nested, dict):
            nested = {}
        nested_payload = dict(nested)
        nested_payload["villa_template"] = payload
        updates.append({col: nested_payload})

    return updates


def save_user_template(access_token: str, user_id: str, profile_row: dict | None, template_map):
    if not access_token or not user_id:
        return False, "Session token missing."

    payload = template_payload_from_dict(template_map)
    safe_profile = profile_row if isinstance(profile_row, dict) else {}
    update_candidates = _template_update_candidates(safe_profile, payload)
    if not update_candidates:
        return (
            False,
            "Could not find a writable template field in profiles "
            "(expected one of: settings, preferences, metadata, villa_template, template).",
        )

    last_error = "Unknown error"
    for update_payload in update_candidates:
        try:
            sb = get_supabase(access_token)
            sb.table("profiles").update(update_payload).eq("id", user_id).execute()
            return True, None
        except Exception as e:
            last_error = str(e)

    return False, last_error

