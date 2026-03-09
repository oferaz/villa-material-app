# app.py

import os
import html
import json
import inspect
import base64
from io import BytesIO
from datetime import datetime, timezone
from urllib.parse import urlparse
import streamlit as st
import pandas as pd
import numpy as np
from sentence_transformers import util
from PIL import Image

from ui_utils import inject_custom_css, apply_custom_css, render_product_card, set_background_image
from config import CATALOG_PKL
from embedding import get_embedder

# Auth + Supabase
from auth_ui import require_login, clear_auth_state
from profiles_manager import get_profile
from supabase_client import get_supabase
from user_template_manager import (
    default_user_template,
    load_user_template_from_profile,
    save_user_template,
    template_dict_from_payload,
    template_payload_from_dict,
)

# Supabase-backed managers
from materials_manager import list_materials, add_private_material, search_materials_semantic
from link_scraper import extract_material_payload_from_url
import project_manager as _project_manager
import project_items_manager as _project_items_manager


def _missing_project_manager_fn(name: str):
    def _missing(*args, **kwargs):
        raise RuntimeError(
            f"project_manager.{name} is unavailable. "
            "Deploy app.py and project_manager.py from the same revision."
        )

    return _missing


def _missing_project_items_manager_fn(name: str):
    def _missing(*args, **kwargs):
        raise RuntimeError(
            f"project_items_manager.{name} is unavailable. "
            "Deploy app.py and project_items_manager.py from the same revision."
        )

    return _missing


load_projects = getattr(_project_manager, "load_projects", _missing_project_manager_fn("load_projects"))
create_project = getattr(_project_manager, "create_project", _missing_project_manager_fn("create_project"))
update_project_name = getattr(
    _project_manager, "update_project_name", _missing_project_manager_fn("update_project_name")
)
rename_project_room = getattr(
    _project_manager, "rename_project_room", _missing_project_manager_fn("rename_project_room")
)
add_project_room = getattr(_project_manager, "add_project_room", _missing_project_manager_fn("add_project_room"))
delete_project_room = getattr(
    _project_manager, "delete_project_room", _missing_project_manager_fn("delete_project_room")
)
delete_project = getattr(_project_manager, "delete_project", _missing_project_manager_fn("delete_project"))
load_project_rooms = getattr(
    _project_manager, "load_project_rooms", _missing_project_manager_fn("load_project_rooms")
)
load_room_objects = getattr(_project_manager, "load_room_objects", _missing_project_manager_fn("load_room_objects"))
load_room_objects_batch = getattr(
    _project_manager, "load_room_objects_batch", _missing_project_manager_fn("load_room_objects_batch")
)
load_projects_statuses = getattr(
    _project_manager, "load_projects_statuses", _missing_project_manager_fn("load_projects_statuses")
)
load_room_statuses = getattr(_project_manager, "load_room_statuses", _missing_project_manager_fn("load_room_statuses"))
get_project_budget_from_row = getattr(
    _project_manager, "get_project_budget_from_row", _missing_project_manager_fn("get_project_budget_from_row")
)
save_project_budget = getattr(
    _project_manager, "save_project_budget", _missing_project_manager_fn("save_project_budget")
)
get_project_share_from_row = getattr(
    _project_manager, "get_project_share_from_row", _missing_project_manager_fn("get_project_share_from_row")
)
rotate_project_share_token = getattr(
    _project_manager, "rotate_project_share_token", _missing_project_manager_fn("rotate_project_share_token")
)
set_project_share_enabled = getattr(
    _project_manager, "set_project_share_enabled", _missing_project_manager_fn("set_project_share_enabled")
)
get_object_comments_from_row = getattr(
    _project_manager, "get_object_comments_from_row", _missing_project_manager_fn("get_object_comments_from_row")
)
get_object_approval_history_from_row = getattr(
    _project_manager,
    "get_object_approval_history_from_row",
    _missing_project_manager_fn("get_object_approval_history_from_row"),
)
append_object_comment = getattr(
    _project_manager, "append_object_comment", _missing_project_manager_fn("append_object_comment")
)
get_shared_project_by_token = getattr(
    _project_manager, "get_shared_project_by_token", _missing_project_manager_fn("get_shared_project_by_token")
)
update_object_status_by_share_token = getattr(
    _project_manager,
    "update_object_status_by_share_token",
    _missing_project_manager_fn("update_object_status_by_share_token"),
)
update_room_status_by_share_token = getattr(
    _project_manager,
    "update_room_status_by_share_token",
    _missing_project_manager_fn("update_room_status_by_share_token"),
)
append_object_comment_by_share_token = getattr(
    _project_manager,
    "append_object_comment_by_share_token",
    _missing_project_manager_fn("append_object_comment_by_share_token"),
)

list_project_items_relational = getattr(
    _project_items_manager,
    "list_project_items",
    _missing_project_items_manager_fn("list_project_items"),
)
list_project_items_grouped_by_room_relational = getattr(
    _project_items_manager,
    "list_project_items_grouped_by_room",
    _missing_project_items_manager_fn("list_project_items_grouped_by_room"),
)
list_project_items_grouped_by_supplier_relational = getattr(
    _project_items_manager,
    "list_project_items_grouped_by_supplier",
    _missing_project_items_manager_fn("list_project_items_grouped_by_supplier"),
)
list_project_items_grouped_by_category_relational = getattr(
    _project_items_manager,
    "list_project_items_grouped_by_category",
    _missing_project_items_manager_fn("list_project_items_grouped_by_category"),
)
build_project_items_excel_bytes_relational = getattr(
    _project_items_manager,
    "build_project_items_excel_bytes",
    _missing_project_items_manager_fn("build_project_items_excel_bytes"),
)

# -----------------------------
# Page setup
# -----------------------------
LOGO_PNG_PATH = os.path.join("assets", "materia_logo.png")
_page_config = {"page_title": "Materia", "layout": "wide"}
if os.path.exists(LOGO_PNG_PATH):
    _page_config["page_icon"] = LOGO_PNG_PATH
st.set_page_config(**_page_config)
st.markdown(
    """
    <link rel="shortcut icon" href="assets/favicon.ico">
    """,
    unsafe_allow_html=True,
)
inject_custom_css()
apply_custom_css()
set_background_image()


def _app_base_url():
    url = None
    if hasattr(st, "secrets"):
        url = st.secrets.get("PUBLIC_APP_URL")
    if not url:
        url = os.getenv("PUBLIC_APP_URL")
    return (url or "").strip().rstrip("/")


def _build_share_url(token: str):
    base = _app_base_url()
    if not token:
        return ""
    if base:
        return f"{base}/?share={token}"
    return f"?share={token}"


def _format_ts(ts_value):
    text = str(ts_value or "").strip()
    if not text:
        return "-"
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone().strftime("%Y-%m-%d %H:%M")
    except Exception:
        return text


def _template_json_from_map(template_map: dict) -> str:
    return json.dumps(template_payload_from_dict(template_map), indent=2)


def _template_map_from_json(raw_text: str):
    try:
        parsed = json.loads(raw_text or "{}")
    except Exception as e:
        return {}, f"Invalid JSON: {e}"

    template_map = template_dict_from_payload(parsed)
    if not template_map:
        return {}, "Template must include at least one room."
    return template_map, None


def _copy_session_value(source_key: str, target_key: str):
    st.session_state[target_key] = st.session_state.get(source_key)


def _normalize_mood_image_refs(values, limit: int = 6) -> list[str]:
    refs = []
    for value in (values or []):
        text = str(value or "").strip()
        if not text:
            continue
        if text.startswith("http://") or text.startswith("https://") or text.startswith("data:image/"):
            refs.append(text)
    return refs[:limit]


def _uploaded_mood_file_to_data_url(uploaded_file) -> str | None:
    try:
        image = Image.open(uploaded_file)
        image = image.convert("RGB")
        image.thumbnail((1600, 1600))
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=85, optimize=True)
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"
    except Exception:
        return None


def _create_project_compat(name: str, rooms=None, template_map: dict | None = None):
    """Call create_project with optional template_map only when supported."""
    kwargs = {"rooms": rooms}
    if template_map is not None:
        try:
            params = inspect.signature(create_project).parameters
            if "template_map" in params:
                kwargs["template_map"] = template_map
        except Exception:
            # Fail closed to keep older create_project signatures working.
            pass
    return create_project(name, **kwargs)


def _cart_payload_from_row(project_row: dict | None):
    cart = (project_row.get("cart") if isinstance(project_row, dict) else None) or []
    if isinstance(cart, dict):
        payload = dict(cart)
        payload["items"] = payload.get("items", []) or []
        return payload
    if isinstance(cart, list):
        return {"items": cart}
    return {"items": []}


def _design_brief_from_row(project_row: dict | None):
    payload = _cart_payload_from_row(project_row)
    brief = payload.get("design_brief") if isinstance(payload.get("design_brief"), dict) else {}
    keywords = brief.get("keywords")
    mood_images = brief.get("mood_images")
    hero_material_ids = brief.get("hero_material_ids")
    if not isinstance(keywords, list):
        keywords = []
    if not isinstance(mood_images, list):
        mood_images = []
    if not isinstance(hero_material_ids, list):
        hero_material_ids = []
    return {
        "keywords": [str(x).strip() for x in keywords if str(x).strip()],
        "references": str(brief.get("references") or "").strip(),
        "materials_mood": str(brief.get("materials_mood") or "").strip(),
        "mood_images": _normalize_mood_image_refs(mood_images, limit=6),
        "hero_material_ids": [str(x).strip() for x in hero_material_ids if str(x).strip()],
    }


def _object_assignment_notes_from_row(project_row: dict | None):
    payload = _cart_payload_from_row(project_row)
    notes = payload.get("assignment_notes")
    if not isinstance(notes, dict):
        return {}
    return {str(k): str(v or "") for k, v in notes.items()}


def _save_project_cart_fields(access_token: str | None, project_id: str, fields: dict):
    if not access_token:
        return False, "Session token missing."
    try:
        sb = get_supabase(access_token)
        rows = (
            sb.table("projects")
            .select("cart")
            .eq("id", project_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        existing_payload = _cart_payload_from_row({"cart": rows[0].get("cart")} if rows else {})
        for key, value in (fields or {}).items():
            existing_payload[key] = value
        sb.table("projects").update({"cart": existing_payload, "updated_at": "now()"}).eq("id", project_id).execute()
        return True, None
    except Exception as e:
        return False, str(e)


def _infer_tactile_tags(material_row: dict):
    tags = material_row.get("tags") or []
    if isinstance(tags, str):
        tags = [x.strip() for x in tags.split(",") if x.strip()]
    elif not isinstance(tags, list):
        tags = []
    tags = [str(x).strip() for x in tags if str(x).strip()]
    if tags:
        return tags[:4]

    text = f"{material_row.get('name') or ''} {material_row.get('description') or ''}".lower()
    inferred = []
    lookup = [
        ("matte", "Matte"),
        ("warm", "Warm"),
        ("wood", "Natural Grain"),
        ("stone", "Stone-like"),
        ("texture", "Textured"),
        ("linen", "Soft Weave"),
        ("metal", "Satin Metal"),
    ]
    for needle, label in lookup:
        if needle in text and label not in inferred:
            inferred.append(label)
    if not inferred:
        inferred = ["Refined", "Balanced"]
    return inferred[:4]


def _lead_time_label(material_row: dict):
    lead = material_row.get("lead_time") or material_row.get("lead_time_days")
    if lead is None or str(lead).strip() == "":
        return "Lead time: 2-4 weeks"
    return f"Lead time: {lead}"


def _supplier_confidence_label(material_row: dict):
    confidence = str(material_row.get("supplier_confidence") or "").strip()
    if confidence:
        return f"Supplier confidence: {confidence}"
    if str(material_row.get("visibility") or "").lower() == "global":
        return "Supplier confidence: Verified catalog source"
    return "Supplier confidence: Designer-curated source"


def _render_editorial_title(title: str, kicker: str | None = None):
    kicker_html = ""
    if kicker:
        kicker_html = f'<div class="editorial-kicker">{html.escape(kicker)}</div>'
    st.markdown(
        f'{kicker_html}<div class="editorial-title">{html.escape(title)}</div>',
        unsafe_allow_html=True,
    )


def _render_mood_strip(image_urls: list[str]):
    clean_urls = _normalize_mood_image_refs(image_urls, limit=6)
    if not clean_urls:
        st.markdown(
            '<div class="inspire-empty">Start with a concept board: add 3-6 mood references to shape palette and form language.</div>',
            unsafe_allow_html=True,
        )
        return

    cells = []
    for url in clean_urls:
        safe_url = html.escape(url.strip(), quote=True)
        cells.append(f'<div class="mood-strip-item"><img src="{safe_url}" alt="Mood reference"/></div>')
    st.markdown(f'<div class="mood-strip-wrap">{"".join(cells)}</div>', unsafe_allow_html=True)


def render_client_portal(share_token: str):
    st.title("Project Review Portal")
    project = get_shared_project_by_token(share_token)
    if not project:
        st.error("This project link is invalid, disabled, or expired.")
        return

    project_id = str(project.get("id"))
    st.caption(f"Project: {project.get('name') or 'Untitled'}")

    if "client_portal_name" not in st.session_state:
        st.session_state["client_portal_name"] = "Client"

    client_name = st.text_input(
        "Your name",
        key="client_portal_name",
        help="Used when saving your comments.",
    ).strip()
    client_actor_name = client_name or "Client"

    rooms = load_project_rooms(project_id)
    room_ids = [r["id"] for r in rooms]
    room_statuses = load_room_statuses(room_ids) if room_ids else {}
    room_objects_map = load_room_objects_batch(room_ids) if room_ids else {}

    material_prices = {}
    material_lookup = {}
    try:
        for m in list_materials(None):
            mid = m.get("id")
            if mid is None:
                continue
            material_lookup[str(mid)] = m
            try:
                price = float(m.get("price")) if m.get("price") is not None else None
            except Exception:
                price = None
            if price is not None:
                material_prices[str(mid)] = price
    except Exception:
        material_prices = {}

    budget_cfg = get_project_budget_from_row(project)
    project_budget = budget_cfg.get("project")
    room_budgets = budget_cfg.get("rooms", {})

    total_objects = 0
    total_assigned = 0
    total_client_ok = 0
    project_spend = 0.0

    for rid in room_ids:
        stats = room_statuses.get(str(rid), {"total": 0, "assigned": 0, "client_ok": 0})
        total_objects += stats["total"]
        total_assigned += stats["assigned"]
        total_client_ok += stats["client_ok"]

        for o in room_objects_map.get(str(rid), []):
            mid = o.get("material_id")
            if not mid:
                continue
            price = material_prices.get(str(mid))
            if price is None:
                continue
            try:
                qty = float(o.get("qty") or 1)
            except Exception:
                qty = 1.0
            project_spend += qty * price

    metric_cols = st.columns(4)
    metric_cols[0].metric("Rooms", len(rooms))
    metric_cols[1].metric("Objects", total_objects)
    metric_cols[2].metric("Approved", f"{total_client_ok}/{total_objects}" if total_objects else "0/0")
    metric_cols[3].metric("Assigned", f"{total_assigned}/{total_objects}" if total_objects else "0/0")

    budget_cols = st.columns(3)
    budget_cols[0].metric("Estimated Spend", f"{project_spend:,.0f} THB")
    budget_cols[1].metric("Budget", f"{project_budget:,.0f} THB" if project_budget is not None else "Not set")
    if project_budget is None:
        budget_cols[2].metric("Remaining", "Not set")
    else:
        budget_cols[2].metric("Remaining", f"{(project_budget - project_spend):,.0f} THB")

    st.markdown("---")
    st.subheader("Rooms and Objects")

    if not rooms:
        st.info("No rooms were found for this project.")
        return

    for room in rooms:
        rid = str(room["id"])
        room_name = room.get("name") or "Room"
        stats = room_statuses.get(rid, {"total": 0, "assigned": 0, "client_ok": 0})
        room_budget = room_budgets.get(rid)
        room_spend = 0.0
        for o in room_objects_map.get(rid, []):
            mid = o.get("material_id")
            if not mid:
                continue
            price = material_prices.get(str(mid))
            if price is None:
                continue
            try:
                qty = float(o.get("qty") or 1)
            except Exception:
                qty = 1.0
            room_spend += qty * price

        with st.expander(
            f"{room_name} | {stats['client_ok']}/{stats['total']} approved | {stats['assigned']}/{stats['total']} assigned",
            expanded=False,
        ):
            room_info = f"Estimated spend: {room_spend:,.0f} THB"
            if room_budget is not None:
                room_info += f" | Budget: {float(room_budget):,.0f} THB"
            st.caption(room_info)

            action_cols = st.columns(2)
            with action_cols[0]:
                if st.button("Approve all assigned objects", key=f"client_room_approve_{rid}", type="primary"):
                    ok, msg = update_room_status_by_share_token(
                        share_token,
                        rid,
                        approve_all=True,
                        actor_name=client_actor_name,
                    )
                    (st.success if ok else st.error)(msg)
                    if ok:
                        st.rerun()
            with action_cols[1]:
                if st.button("Reset room approvals", key=f"client_room_reset_{rid}"):
                    ok, msg = update_room_status_by_share_token(
                        share_token,
                        rid,
                        approve_all=False,
                        actor_name=client_actor_name,
                    )
                    (st.success if ok else st.error)(msg)
                    if ok:
                        st.rerun()

            for obj in room_objects_map.get(rid, []):
                oid = str(obj["id"])
                status = obj.get("status") or "unassigned"
                is_assigned = bool(obj.get("material_id"))
                material_row = material_lookup.get(str(obj.get("material_id"))) if is_assigned else None

                with st.container(border=True):
                    header_cols = st.columns([0.55, 0.15, 0.3])
                    with header_cols[0]:
                        st.markdown(f"**{obj.get('object_name') or 'Object'}**")
                        st.caption(f"Category: {obj.get('category') or '-'} | Qty: {obj.get('qty') or 1}")
                    with header_cols[1]:
                        st.caption("Assigned")
                        st.write("Yes" if is_assigned else "No")
                    with header_cols[2]:
                        st.caption("Status")
                        st.write(status)

                    if is_assigned:
                        st.caption("Assigned material")
                        if material_row:
                            material_name = material_row.get("name") or "Material"
                            material_category = material_row.get("category") or "Uncategorized"
                            material_price = material_row.get("price")
                            material_line = f"{material_name} ({material_category})"
                            if material_price is not None:
                                try:
                                    material_line += f" - {float(material_price):,.0f} THB"
                                except Exception:
                                    pass
                            st.write(material_line)

                            image_url = (material_row.get("image_url") or "").strip()
                            if image_url:
                                st.image(image_url, width=320, caption=material_name)
                            else:
                                st.caption("No product image available.")

                            product_link = (material_row.get("link") or "").strip()
                            if product_link:
                                st.markdown(f"[Open product link]({product_link})")
                            else:
                                st.caption("No product link available.")
                        else:
                            st.caption("Material details are not available.")

                    btn_cols = st.columns(2)
                    with btn_cols[0]:
                        if st.button(
                            "Approve object",
                            key=f"client_obj_approve_{oid}",
                            disabled=not is_assigned,
                        ):
                            ok, msg = update_object_status_by_share_token(
                                share_token,
                                oid,
                                "client_approved",
                                actor_name=client_actor_name,
                            )
                            (st.success if ok else st.error)(msg)
                            if ok:
                                st.rerun()
                    with btn_cols[1]:
                        if st.button(
                            "Remove approval",
                            key=f"client_obj_unapprove_{oid}",
                            disabled=not is_assigned,
                        ):
                            ok, msg = update_object_status_by_share_token(
                                share_token,
                                oid,
                                "selected",
                                actor_name=client_actor_name,
                            )
                            (st.success if ok else st.error)(msg)
                            if ok:
                                st.rerun()

                    approvals = get_object_approval_history_from_row(project, oid)
                    if approvals:
                        latest = approvals[-1]
                        st.caption(
                            "Latest approval update: "
                            f"{latest.get('actor_name') or 'Client'} "
                            f"({latest.get('action') or '-'}) at {_format_ts(latest.get('created_at'))}"
                        )
                        with st.expander("Approval history", expanded=False):
                            for row in reversed(approvals[-10:]):
                                st.write(
                                    f"- {_format_ts(row.get('created_at'))}: "
                                    f"{row.get('actor_name') or 'Client'} "
                                    f"({row.get('actor_role') or 'client'}) "
                                    f"{row.get('action') or '-'}"
                                )

                    comments = get_object_comments_from_row(project, oid)
                    if comments:
                        st.caption("Comments")
                        for row in comments[-5:]:
                            author = row.get("author_name") or "Unknown"
                            role = row.get("author_role") or "user"
                            text = row.get("comment") or ""
                            st.write(f"- {author} ({role}): {text}")

                    comment_text = st.text_area(
                        "Comment on this object",
                        key=f"client_comment_text_{oid}",
                        placeholder="Write your feedback for the designer",
                        height=80,
                    )
                    if st.button("Send comment", key=f"client_send_comment_{oid}"):
                        ok, msg = append_object_comment_by_share_token(
                            share_token=share_token,
                            object_id=oid,
                            author_name=client_actor_name,
                            comment=comment_text,
                        )
                        (st.success if ok else st.error)(msg)
                        if ok:
                            st.rerun()


# Shared-link customer portal (no login required)
share_param = st.query_params.get("share", "")
if isinstance(share_param, list):
    share_param = share_param[0] if share_param else ""
share_token = str(share_param or "").strip()

if share_token:
    render_client_portal(share_token)
    st.stop()

# -----------------------------
# Require login (critical for RLS auth.uid())
# -----------------------------
require_login()

access_token = st.session_state.get("sb_access_token")
user_id = st.session_state.get("user_id")

if access_token and user_id:
    try:
        profile = get_profile(access_token, user_id)
    except Exception:
        profile = {}
else:
    profile = {}
full_name = profile.get("full_name") or (
    st.session_state.user_email.split("@")[0] if st.session_state.get("user_email") else "User"
)

user_key = str(user_id or "")
if st.session_state.get("user_template_owner") != user_key:
    loaded_template = load_user_template_from_profile(profile)
    st.session_state.user_template_owner = user_key
    st.session_state.user_template_map = loaded_template
    st.session_state.user_template_editor_json = _template_json_from_map(loaded_template)
elif "user_template_map" not in st.session_state:
    loaded_template = load_user_template_from_profile(profile)
    st.session_state.user_template_map = loaded_template
    st.session_state.user_template_editor_json = _template_json_from_map(loaded_template)

# -----------------------------
# Sidebar: user area (name + logout + profile editor)
# -----------------------------
if os.path.exists(LOGO_PNG_PATH):
    st.sidebar.image(LOGO_PNG_PATH, use_container_width=True)

st.sidebar.markdown("---")
st.sidebar.markdown(f"Logged in as: **{full_name}**")

if st.sidebar.button("Logout"):
    clear_auth_state([
        "current_project_id",
        "current_room_id",
        "current_object_id",
        "user_template_owner",
        "user_template_map",
        "user_template_editor_json",
    ])
    st.rerun()

with st.sidebar.expander("Profile", expanded=False):
    new_name = st.text_input("Display name", value=full_name, key="profile_display_name")
    if st.button("Save name", key="save_profile_btn", disabled=not (access_token and user_id)):
        try:
            sb = get_supabase(access_token)
            sb.table("profiles").update({"full_name": new_name.strip()}).eq("id", user_id).execute()
            st.success("Saved.")
            st.rerun()
        except Exception:
            st.error("Could not save profile name. Check profiles table permissions/schema.")

# -----------------------------
# Main: welcome message
# -----------------------------
st.markdown(
    f"""
    <div class="welcome-box">
        <h2>Welcome back, {full_name}</h2>
        <p>Shape mood, material, and sourcing decisions across every room from one shared workspace.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

# -----------------------------
# Sidebar Navigation
# -----------------------------
st.sidebar.markdown("### Navigation")
page = st.sidebar.radio(
    "",
    ["Projects Workspace", "Materials Gallery", "My Materials", "Suggestions"],
    label_visibility="collapsed",
)

workspace_focus_options = ["Dashboard", "Project Setup", "Material Selection", "Client Review", "Procurement"]
workspace_focus_labels = {
    "Dashboard": "Overview dashboard",
    "Project Setup": "Project setup and brief",
    "Material Selection": "Assign materials",
    "Client Review": "Client review and sharing",
    "Procurement": "Procurement tracking",
}
if "workspace_focus" not in st.session_state:
    st.session_state.workspace_focus = "Dashboard"

if page == "Projects Workspace":
    st.sidebar.markdown("### Workspace section")
    st.sidebar.caption("Choose which project workflow section to show in the main panel.")
    st.session_state.workspace_focus = st.sidebar.radio(
        "",
        workspace_focus_options,
        index=workspace_focus_options.index(st.session_state.workspace_focus)
        if st.session_state.workspace_focus in workspace_focus_options
        else 0,
        format_func=lambda option: workspace_focus_labels.get(option, option),
        label_visibility="collapsed",
    )

    if st.sidebar.button(
        "New project",
        key="qa_new_project",
        type="primary",
        use_container_width=True,
        help="Open the project setup panel to create a new project.",
    ):
        st.session_state.workspace_focus = "Project Setup"
        st.session_state.open_create_project = True

# -----------------------------
# Shared: Load embedding model + catalog
# -----------------------------
model = get_embedder()

@st.cache_data
def load_data():
    if os.path.exists(CATALOG_PKL):
        df_ = pd.read_pickle(CATALOG_PKL)
    else:
        df_ = pd.DataFrame()
    if not df_.empty and "embedding" in df_.columns:
        df_["embedding"] = df_["embedding"].apply(np.array)
    return df_

df = load_data()
if df.empty or "embedding" not in df.columns or df["embedding"].isna().all():
    embeddings = None
else:
    embeddings = np.vstack(df["embedding"].values)


@st.cache_data(ttl=60, show_spinner=False)
def load_materials_cached(token: str | None):
    if not token:
        return []
    return list_materials(token)


@st.cache_data(ttl=45, show_spinner=False)
def search_materials_cached(token: str | None, query: str, limit: int = 20, refresh_nonce: int = 0):
    _ = refresh_nonce
    if not token:
        return []
    return search_materials_semantic(token, query, limit=limit)


def _safe_float(value):
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


PROCUREMENT_STAGE_OPTIONS = [
    "planning",
    "start_construction",
    "finish_roof",
    "finish_plaster",
    "finish_installation",
    "finish_electricity",
    "finish_floors",
    "finish_windows",
    "finish_paint",
    "installation",
    "house_ready",
]
PROCUREMENT_STAGE_LABELS = {
    "planning": "Planning",
    "start_construction": "Start Construction",
    "finish_roof": "Finish Roof",
    "finish_plaster": "Finish Plaster",
    "finish_installation": "Finish Installation",
    "finish_electricity": "Finish Electricity",
    "finish_floors": "Finish Floors",
    "finish_windows": "Finish Windows",
    "finish_paint": "Finish Paint",
    "installation": "Installation",
    "house_ready": "House Ready",
}
PROCUREMENT_STAGE_RANK = {stage: idx for idx, stage in enumerate(PROCUREMENT_STAGE_OPTIONS)}
PROCUREMENT_STAGE_ALIASES = {
    "first_fix": "finish_electricity",
    "finishing": "finish_plaster",
    "final_install": "installation",
    "delivered": "house_ready",
    "start construction": "start_construction",
    "finish roof": "finish_roof",
    "finish plaster": "finish_plaster",
    "finish installation prep": "finish_installation",
    "finish_installation_prep": "finish_installation",
    "finish installation": "finish_installation",
    "finish electricity": "finish_electricity",
    "finish floors": "finish_floors",
    "finish windows": "finish_windows",
    "finish paint": "finish_paint",
    "house ready": "house_ready",
}


def _normalize_procurement_stage(stage: str | None):
    value = str(stage or "").strip().lower().replace("-", "_")
    value = PROCUREMENT_STAGE_ALIASES.get(value, value)
    value = value.replace(" ", "_")
    if value in PROCUREMENT_STAGE_LABELS:
        return value
    return None


def _procurement_stage_label(stage: str):
    stage_key = _normalize_procurement_stage(stage) or "planning"
    return PROCUREMENT_STAGE_LABELS.get(stage_key, PROCUREMENT_STAGE_LABELS["planning"])


def _suggest_procurement_stage(type_value: str):
    text = str(type_value or "").strip().lower()
    if not text:
        return "planning"

    roof_tokens = ["roof", "shingle", "waterproof membrane", "gutter"]
    if any(token in text for token in roof_tokens):
        return "finish_roof"

    electricity_tokens = [
        "electrical",
        "switch",
        "socket",
        "wiring",
        "cable",
        "conduit",
        "panel",
        "breaker",
        "light fitting",
    ]
    if any(token in text for token in electricity_tokens):
        return "finish_electricity"

    installation_prep_tokens = [
        "sanitary",
        "plumbing",
        "pipe",
        "toilet",
        "shower",
        "tap",
        "mixer",
        "drain",
        "valve",
        "hvac",
        "ac ",
        "air condition",
        "vent",
    ]
    if any(token in text for token in installation_prep_tokens):
        return "finish_installation"

    floor_tokens = ["tile", "floor", "parquet", "vinyl", "marble floor", "wood floor"]
    if any(token in text for token in floor_tokens):
        return "finish_floors"

    window_tokens = ["window", "glass", "aluminum frame", "curtain wall"]
    if any(token in text for token in window_tokens):
        return "finish_windows"

    paint_tokens = ["paint", "coating", "primer"]
    if any(token in text for token in paint_tokens):
        return "finish_paint"

    plaster_tokens = [
        "stone",
        "wall",
        "ceiling",
        "carpentry",
        "cabinet",
        "partition",
        "gypsum",
        "plaster",
        "door",
    ]
    if any(token in text for token in plaster_tokens):
        return "finish_plaster"

    installation_tokens = [
        "furniture",
        "lighting",
        "decor",
        "appliance",
        "mirror",
        "table",
        "chair",
        "bed",
    ]
    if any(token in text for token in installation_tokens):
        return "installation"

    start_construction_tokens = [
        "cement",
        "concrete",
        "block",
        "rebar",
        "steel",
        "foundation",
    ]
    if any(token in text for token in start_construction_tokens):
        return "start_construction"

    ready_tokens = ["handover", "final cleaning", "snag", "as built"]
    if any(token in text for token in ready_tokens):
        return "house_ready"

    return "planning"


def _buy_from_value(material_row: dict):
    if not isinstance(material_row, dict):
        return "TBD"

    supplier = str(material_row.get("supplier") or material_row.get("supplier_name") or "").strip()
    if supplier:
        return supplier

    raw_link = str(material_row.get("link") or "").strip()
    if raw_link.startswith("http://") or raw_link.startswith("https://"):
        host = (urlparse(raw_link).netloc or "").strip().lower()
        if host.startswith("www."):
            host = host[4:]
        if host:
            return host
    return "TBD"


def _file_safe_name(text: str):
    raw = str(text or "").strip().lower()
    if not raw:
        return "project"
    chars = []
    last_was_sep = False
    for ch in raw:
        if ("a" <= ch <= "z") or ("0" <= ch <= "9"):
            chars.append(ch)
            last_was_sep = False
        elif not last_was_sep:
            chars.append("_")
            last_was_sep = True
    safe = "".join(chars).strip("_")
    return safe or "project"


def _submit_app_suggestion(
    access_token: str | None,
    user_id: str | None,
    user_name: str,
    user_email: str,
    title: str,
    category: str,
    suggestion_text: str,
    allow_contact: bool,
):
    if not access_token or not user_id:
        return False, "Login is required before sending suggestions."
    try:
        sb = get_supabase(access_token)
        payload = {
            "user_id": str(user_id),
            "user_name": (user_name or "").strip() or None,
            "user_email": (user_email or "").strip() or None,
            "title": title.strip(),
            "category": category.strip(),
            "suggestion": suggestion_text.strip(),
            "allow_contact": bool(allow_contact),
            "status": "new",
        }
        sb.table("app_suggestions").insert(payload).execute()
        return True, None
    except Exception as e:
        return False, str(e)


def _procurement_from_row(project_row: dict | None):
    payload = _cart_payload_from_row(project_row)
    block = payload.get("procurement") if isinstance(payload.get("procurement"), dict) else {}

    notes = block.get("notes") if isinstance(block.get("notes"), dict) else {}
    quote_status = block.get("quote_status") if isinstance(block.get("quote_status"), dict) else {}
    priority = block.get("priority") if isinstance(block.get("priority"), dict) else {}
    target_price = block.get("target_price") if isinstance(block.get("target_price"), dict) else {}
    order_stage = block.get("order_stage") if isinstance(block.get("order_stage"), dict) else {}

    clean_target_price = {}
    for key, value in target_price.items():
        cast_value = _safe_float(value)
        if cast_value is not None:
            clean_target_price[str(key)] = cast_value

    clean_order_stage = {}
    for key, value in order_stage.items():
        stage_key = _normalize_procurement_stage(value)
        if stage_key:
            clean_order_stage[str(key)] = stage_key

    return {
        "notes": {str(k): str(v or "") for k, v in notes.items()},
        "quote_status": {str(k): str(v or "").strip().lower() for k, v in quote_status.items() if str(v or "").strip()},
        "priority": {str(k): str(v or "").strip().lower() for k, v in priority.items() if str(v or "").strip()},
        "target_price": clean_target_price,
        "order_stage": clean_order_stage,
    }


def _update_procurement_for_object(
    procurement_block: dict,
    object_id: str,
    note: str,
    quote_status: str,
    priority: str,
    target_price: float | None,
    order_stage: str,
):
    next_block = {
        "notes": dict(procurement_block.get("notes") or {}),
        "quote_status": dict(procurement_block.get("quote_status") or {}),
        "priority": dict(procurement_block.get("priority") or {}),
        "target_price": dict(procurement_block.get("target_price") or {}),
        "order_stage": dict(procurement_block.get("order_stage") or {}),
    }
    key = str(object_id)

    clean_note = str(note or "").strip()
    clean_quote = str(quote_status or "").strip().lower()
    clean_priority = str(priority or "").strip().lower()
    clean_target = _safe_float(target_price)
    clean_stage = _normalize_procurement_stage(order_stage)

    if clean_note:
        next_block["notes"][key] = clean_note
    else:
        next_block["notes"].pop(key, None)

    if clean_quote:
        next_block["quote_status"][key] = clean_quote
    else:
        next_block["quote_status"].pop(key, None)

    if clean_priority:
        next_block["priority"][key] = clean_priority
    else:
        next_block["priority"].pop(key, None)

    if clean_target is not None:
        next_block["target_price"][key] = clean_target
    else:
        next_block["target_price"].pop(key, None)

    if clean_stage:
        next_block["order_stage"][key] = clean_stage
    else:
        next_block["order_stage"].pop(key, None)

    return next_block


def _procurement_metrics(room_objects_map, material_lookup, procurement_block):
    metrics = {
        "assigned": 0,
        "priced": 0,
        "lead_known": 0,
        "supplier_named": 0,
        "quote_requested": 0,
        "quote_received": 0,
        "po_ready": 0,
        "po_sent": 0,
    }

    quote_status = procurement_block.get("quote_status") or {}
    for objects in (room_objects_map or {}).values():
        for obj in (objects or []):
            material_id = obj.get("material_id")
            if not material_id:
                continue

            metrics["assigned"] += 1
            material_row = material_lookup.get(str(material_id)) or {}

            if _safe_float(material_row.get("price")) is not None:
                metrics["priced"] += 1

            lead_time = material_row.get("lead_time") or material_row.get("lead_time_days")
            if lead_time is not None and str(lead_time).strip():
                metrics["lead_known"] += 1

            supplier_name = str(material_row.get("supplier") or material_row.get("supplier_name") or "").strip()
            if supplier_name:
                metrics["supplier_named"] += 1

            status = str(quote_status.get(str(obj.get("id"))) or "").strip().lower()
            if status == "quote_requested":
                metrics["quote_requested"] += 1
            elif status == "quote_received":
                metrics["quote_received"] += 1
            elif status == "po_ready":
                metrics["po_ready"] += 1
            elif status == "po_sent":
                metrics["po_sent"] += 1

    return metrics


def _procurement_quote_label(status: str):
    labels = {
        "not_started": "Not started",
        "quote_requested": "Quote requested",
        "quote_received": "Quote received",
        "po_ready": "PO ready",
        "po_sent": "PO sent",
    }
    return labels.get(str(status or "").strip().lower(), "Not started")


def _procurement_priority_label(priority: str):
    labels = {
        "routine": "Routine",
        "high": "High",
        "critical": "Critical",
    }
    return labels.get(str(priority or "").strip().lower(), "Routine")


def _procurement_quote_tone(status: str):
    tones = {
        "not_started": "proc-tone-neutral",
        "quote_requested": "proc-tone-amber",
        "quote_received": "proc-tone-blue",
        "po_ready": "proc-tone-purple",
        "po_sent": "proc-tone-green",
    }
    return tones.get(str(status or "").strip().lower(), "proc-tone-neutral")


def _procurement_priority_tone(priority: str):
    tones = {
        "routine": "proc-tone-neutral",
        "high": "proc-tone-amber",
        "critical": "proc-tone-red",
    }
    return tones.get(str(priority or "").strip().lower(), "proc-tone-neutral")


def _build_procurement_export_rows(
    project_row: dict | None,
    rooms: list,
    room_objects_map: dict,
    material_lookup: dict,
    procurement_block: dict,
    include_internal_notes: bool = False,
    stage_filter: str = "all",
):
    stage_filter_key = _normalize_procurement_stage(stage_filter)
    assignment_notes = _object_assignment_notes_from_row(project_row)
    quote_status_map = procurement_block.get("quote_status") or {}
    priority_map = procurement_block.get("priority") or {}
    target_price_map = procurement_block.get("target_price") or {}
    procurement_notes_map = procurement_block.get("notes") or {}
    order_stage_map = procurement_block.get("order_stage") or {}

    room_name_map = {str(room.get("id")): str(room.get("name") or "Room") for room in (rooms or [])}
    project_name = str((project_row or {}).get("name") or "Project")

    rows = []
    for room_id, objects in (room_objects_map or {}).items():
        room_name = room_name_map.get(str(room_id), "Room")
        for obj in (objects or []):
            material_id = obj.get("material_id")
            if not material_id:
                continue

            object_id = str(obj.get("id") or "")
            material_row = material_lookup.get(str(material_id)) if material_id else {}
            if not isinstance(material_row, dict):
                material_row = {}

            object_category = str(obj.get("category") or "").strip()
            material_category = str(material_row.get("category") or "").strip()
            object_type = object_category or "Uncategorized"
            material_type = material_category or "Uncategorized"
            if object_type.casefold() == material_type.casefold():
                type_value = object_type
            else:
                type_value = f"{object_type} | {material_type}"

            saved_stage = _normalize_procurement_stage(order_stage_map.get(object_id))
            if saved_stage:
                stage_value = saved_stage
                stage_source = "Manual"
            else:
                stage_value = _suggest_procurement_stage(
                    f"{object_type} {material_type} {obj.get('object_name') or ''}"
                )
                stage_source = "Auto"

            if stage_filter_key and stage_value != stage_filter_key:
                continue

            qty_value = _safe_float(obj.get("qty"))
            qty = qty_value if qty_value is not None and qty_value > 0 else 1.0
            unit_price = _safe_float(material_row.get("price"))
            line_total = (qty * unit_price) if unit_price is not None else None
            lead_time = material_row.get("lead_time") or material_row.get("lead_time_days")

            row_payload = {
                "Project": project_name,
                "Room": room_name,
                "Object": str(obj.get("object_name") or "Object"),
                "Type": type_value,
                "Object Type": object_type,
                "Material Type": material_type,
                "Material": str(material_row.get("name") or ""),
                "Qty": qty,
                "Unit Price (THB)": unit_price,
                "Line Total (THB)": line_total,
                "Price Missing": "Yes" if unit_price is None else "No",
                "Place to Buy": _buy_from_value(material_row),
                "Material Link": str(material_row.get("link") or ""),
                "Order Stage Key": stage_value,
                "Order Stage": _procurement_stage_label(stage_value),
                "Stage Source": stage_source,
                "Quote Status": _procurement_quote_label(quote_status_map.get(object_id)),
                "Priority": _procurement_priority_label(priority_map.get(object_id)),
                "Target Price (THB)": _safe_float(target_price_map.get(object_id)),
                "Object Status": str(obj.get("status") or "unassigned"),
                "Lead Time": str(lead_time or "").strip(),
            }
            if include_internal_notes:
                row_payload["Assignment Note"] = str(assignment_notes.get(object_id) or "").strip()
                row_payload["Procurement Note"] = str(procurement_notes_map.get(object_id) or "").strip()
            rows.append(row_payload)

    rows.sort(
        key=lambda row: (
            PROCUREMENT_STAGE_RANK.get(str(row.get("Order Stage Key") or "planning"), 0),
            str(row.get("Type") or "").lower(),
            str(row.get("Place to Buy") or "").lower(),
            str(row.get("Room") or "").lower(),
            str(row.get("Object") or "").lower(),
        )
    )
    return rows


def _build_procurement_export_workbook(export_rows: list[dict], include_internal_notes: bool = False):
    detail_columns = [
        "Project",
        "Order Stage",
        "Stage Source",
        "Type",
        "Object Type",
        "Material Type",
        "Place to Buy",
        "Room",
        "Object",
        "Material",
        "Qty",
        "Unit Price (THB)",
        "Line Total (THB)",
        "Price Missing",
        "Quote Status",
        "Priority",
        "Target Price (THB)",
        "Object Status",
        "Lead Time",
        "Material Link",
    ]
    if include_internal_notes:
        detail_columns.extend(["Assignment Note", "Procurement Note"])
    detail_df = pd.DataFrame(export_rows, columns=detail_columns)

    if detail_df.empty:
        supplier_df = pd.DataFrame(columns=["Order Stage", "Place to Buy", "Lines", "Total Qty", "Known Value (THB)", "Lines Missing Price"])
        type_df = pd.DataFrame(columns=["Order Stage", "Type", "Lines", "Total Qty", "Known Value (THB)", "Lines Missing Price"])
        room_df = pd.DataFrame(columns=["Order Stage", "Room", "Lines", "Total Qty", "Known Value (THB)", "Lines Missing Price"])
    else:
        for col_name in ["Qty", "Line Total (THB)"]:
            detail_df[col_name] = pd.to_numeric(detail_df[col_name], errors="coerce")

        grouped = detail_df.assign(_missing_price=(detail_df["Price Missing"] == "Yes").astype(int))

        supplier_df = (
            grouped.groupby(["Order Stage", "Place to Buy"], dropna=False)
            .agg(
                Lines=("Object", "count"),
                **{
                    "Total Qty": ("Qty", "sum"),
                    "Known Value (THB)": ("Line Total (THB)", "sum"),
                    "Lines Missing Price": ("_missing_price", "sum"),
                },
            )
            .reset_index()
            .sort_values(["Order Stage", "Place to Buy"])
        )

        type_df = (
            grouped.groupby(["Order Stage", "Type"], dropna=False)
            .agg(
                Lines=("Object", "count"),
                **{
                    "Total Qty": ("Qty", "sum"),
                    "Known Value (THB)": ("Line Total (THB)", "sum"),
                    "Lines Missing Price": ("_missing_price", "sum"),
                },
            )
            .reset_index()
            .sort_values(["Order Stage", "Type"])
        )

        room_df = (
            grouped.groupby(["Order Stage", "Room"], dropna=False)
            .agg(
                Lines=("Object", "count"),
                **{
                    "Total Qty": ("Qty", "sum"),
                    "Known Value (THB)": ("Line Total (THB)", "sum"),
                    "Lines Missing Price": ("_missing_price", "sum"),
                },
            )
            .reset_index()
            .sort_values(["Order Stage", "Room"])
        )

    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        detail_df.to_excel(writer, sheet_name="Order List", index=False)
        supplier_df.to_excel(writer, sheet_name="By Supplier", index=False)
        type_df.to_excel(writer, sheet_name="By Type", index=False)
        room_df.to_excel(writer, sheet_name="By Room", index=False)

    return output.getvalue()


def _room_spend(objects, material_prices):
    spend = 0.0
    assigned = 0
    priced = 0
    missing_price = 0

    for o in (objects or []):
        mid = o.get("material_id")
        if not mid:
            continue
        assigned += 1

        price = material_prices.get(str(mid))
        qty = o.get("qty") or 1
        try:
            qty = float(qty)
        except Exception:
            qty = 1.0

        if price is None:
            missing_price += 1
            continue

        spend += qty * price
        priced += 1

    return {
        "spend": spend,
        "assigned": assigned,
        "priced": priced,
        "missing_price": missing_price,
    }

# -----------------------------
# Page: Projects
# -----------------------------
if page == "Projects Workspace":
    focus = st.session_state.get("workspace_focus", "Dashboard")
    show_setup = focus in ["Dashboard", "Project Setup"]
    show_selection = focus in ["Dashboard", "Material Selection", "Procurement", "Client Review"]
    show_review = focus in ["Dashboard", "Client Review"]
    show_procurement = focus in ["Dashboard", "Procurement"]
    open_create_project_panel = bool(st.session_state.pop("open_create_project", False))

    _render_editorial_title("Projects Workspace", "Projects")

    projects = load_projects()
    project_statuses = load_projects_statuses([p["id"] for p in projects]) if projects else {}

    # Sidebar: Create project (simple + works)
    if show_setup or open_create_project_panel:
        with st.sidebar.expander("New Project Setup", expanded=open_create_project_panel):
            st.caption("Create a project and choose whether to start from your saved room template.")
            st.markdown("#### My Base Template")
            st.caption("New projects can start from this template. You can edit room names and object rows in JSON.")

            template_text = st.text_area(
                "Template JSON",
                key="user_template_editor_json",
                height=260,
                help='Use format: {"rooms":[{"name":"Room","objects":[{"name":"Item","category":"Furniture","qty":1}]}]}',
            )

            template_buttons = st.columns(3)
            with template_buttons[0]:
                if st.button("Apply JSON", key="template_apply_json_btn"):
                    parsed_template, parse_error = _template_map_from_json(template_text)
                    if parse_error:
                        st.error(parse_error)
                    else:
                        st.session_state.user_template_map = parsed_template
                        st.success(f"Loaded template with {len(parsed_template)} room(s).")
            with template_buttons[1]:
                if st.button(
                    "Save as my template",
                    key="template_save_profile_btn",
                    disabled=not (access_token and user_id),
                ):
                    parsed_template, parse_error = _template_map_from_json(template_text)
                    if parse_error:
                        st.error(parse_error)
                    else:
                        ok, err = save_user_template(access_token, user_id, profile, parsed_template)
                        if ok:
                            st.session_state.user_template_map = parsed_template
                            st.success("Template saved to your profile.")
                        else:
                            st.error(f"Could not save template: {err}")
            with template_buttons[2]:
                if st.button("Reset default", key="template_reset_default_btn"):
                    reset_template = default_user_template()
                    st.session_state.user_template_map = reset_template
                    st.session_state.user_template_editor_json = _template_json_from_map(reset_template)
                    st.success("Reset editor to default villa template.")

            active_template_map = st.session_state.get("user_template_map") or default_user_template()
            active_room_names = list(active_template_map.keys())
            st.caption(
                f"Active template: {len(active_room_names)} room(s). "
                f"{', '.join(active_room_names[:5])}{' ...' if len(active_room_names) > 5 else ''}"
            )
            use_my_template = st.checkbox("Use my base template for new projects", value=True, key="use_my_template_for_new_project")

            st.markdown("---")
            new_proj = st.text_input("Project Name", key="new_proj_name")

            predefined = [
                "Living Room", "Kitchen", "Dining Room", "Bedroom", "Master Bedroom", "Guest Bedroom",
                "Bathroom", "Guest Bathroom", "Outdoor / Terrace", "Garden", "Balcony", "Pool Area",
                "Entrance", "Walk-in Closet", "Pantry", "Laundry Room", "Garage", "Storage Room",
                "Office / Study", "Kids Room", "Play Area", "Hallway"
            ]

            room_counts = {}
            st.markdown("#### Rooms")
            for room in predefined:
                count = st.number_input(room, min_value=0, max_value=10, value=0, step=1, key=f"cnt_{room}")
                if count > 0:
                    room_counts[room] = count

            custom_rooms = st.text_input("Custom Rooms (comma-separated)", "", key="custom_rooms")

            if st.button("Create", type="primary", key="create_project_btn"):
                all_rooms = []
                for room, count in room_counts.items():
                    for i in range(count):
                        label = f"{room} {i+1}" if count > 1 else room
                        all_rooms.append(label)

                all_rooms.extend([r.strip() for r in custom_rooms.split(",") if r.strip()])

                if not new_proj.strip():
                    st.warning("Please enter a project name.")
                else:
                    rooms_arg = all_rooms if all_rooms else None
                    if use_my_template:
                        _create_project_compat(
                            new_proj.strip(),
                            rooms=rooms_arg,
                            template_map=st.session_state.get("user_template_map") or default_user_template(),
                        )
                    else:
                        _create_project_compat(new_proj.strip(), rooms=rooms_arg)
                    st.rerun()

    # pick selected project (by id)
    if "current_project_id" not in st.session_state:
        st.session_state.current_project_id = projects[0]["id"] if projects else None

    left, right = st.columns([0.35, 0.65], gap="large")

    with left:
        _render_editorial_title("Your Creative Tracks", "Project Library")

        if not projects:
            st.markdown(
                '<div class="inspire-empty">Start with a concept board: create your first project from the sidebar, then define its mood direction.</div>',
                unsafe_allow_html=True,
            )
        else:
            q = st.text_input("Filter projects", placeholder="type to filter...", key="proj_filter")
            filtered = [p for p in projects if (q.strip().lower() in (p.get("name", "").lower())) or not q.strip()]

            for p in filtered:
                pid = p["id"]
                name = p.get("name", "Untitled")

                ps = project_statuses.get(
                    str(pid), {"rooms": 0, "total": 0, "assigned": 0, "designer_ok": 0, "client_ok": 0}
                )
                total = ps["total"]
                assigned = ps["assigned"]
                client_ok = ps["client_ok"]
                pct = (assigned / total) if total else 0.0

                is_current = (str(pid) == str(st.session_state.current_project_id))

                with st.container(border=True):
                    cols = st.columns([0.72, 0.28])
                    with cols[0]:
                        st.markdown(f"**{name}**")
                        st.caption(f"{ps['rooms']} rooms | {assigned}/{total} assigned | {client_ok}/{total} client approved")
                        st.progress(pct)
                    with cols[1]:
                        if st.button("Open", key=f"open_proj_{pid}", type=("primary" if is_current else "secondary")):
                            st.session_state.current_project_id = pid
                            st.session_state.current_room_id = None
                            st.session_state.current_object_id = None
                            st.rerun()

    with right:
        pid = st.session_state.current_project_id
        if not pid:
            st.markdown(
                '<div class="inspire-empty">Select a project to open its mood direction, room flow, and material story.</div>',
                unsafe_allow_html=True,
            )
        else:
            proj = next((x for x in projects if str(x["id"]) == str(pid)), None)
            if not proj:
                st.error("Project could not be loaded.")
                st.stop()
            share_meta = get_project_share_from_row(proj)
            share_token_value = share_meta.get("token")
            share_enabled = bool(share_meta.get("enabled"))
            share_link = _build_share_url(share_token_value) if share_token_value else ""

            if show_review:
                with st.expander("Create Shareable Customer Link", expanded=False):
                    st.caption("Create a shareable link so your customer can view only this project.")

                    controls = st.columns(3)
                    with controls[0]:
                        if st.button("Create link", key=f"share_generate_{pid}", type="primary"):
                            new_token = rotate_project_share_token(pid)
                            if new_token:
                                st.success("Shareable customer link created.")
                                st.rerun()
                    with controls[1]:
                        share_toggle_key = f"share_enabled_{pid}"
                        share_toggle_token_key = f"share_enabled_token_{pid}"
                        if (
                            share_toggle_key not in st.session_state
                            or st.session_state.get(share_toggle_token_key) != (share_token_value or "")
                            or bool(st.session_state.get(share_toggle_key)) != bool(share_enabled)
                        ):
                            st.session_state[share_toggle_key] = bool(share_enabled)
                            st.session_state[share_toggle_token_key] = share_token_value or ""

                        enable_value = st.checkbox(
                            "Allow customer access",
                            key=share_toggle_key,
                            disabled=not bool(share_token_value),
                        )
                        if share_token_value and enable_value != share_enabled:
                            if set_project_share_enabled(pid, enable_value):
                                st.session_state[share_toggle_key] = bool(enable_value)
                                st.session_state[share_toggle_token_key] = share_token_value or ""
                                st.success("Customer link access updated.")
                                st.rerun()
                    with controls[2]:
                        if st.button("Regenerate link", key=f"share_rotate_{pid}", disabled=not bool(share_token_value)):
                            new_token = rotate_project_share_token(pid)
                            if new_token:
                                st.success("Shareable customer link regenerated.")
                                st.rerun()

                    if share_link:
                        st.text_input("Customer View Link", value=share_link, key=f"share_url_{pid}", disabled=True)
                        if share_link.startswith("?share="):
                            st.caption("Set PUBLIC_APP_URL in secrets/env to generate a full absolute URL.")
                    else:
                        st.info("No customer link yet. Click 'Create link'.")
            project_material_rows = load_materials_cached(access_token) if access_token else []
            material_name_map = {str(m.get("id")): (m.get("name") or "Material") for m in project_material_rows if m.get("id")}
            material_lookup = {str(m.get("id")): m for m in project_material_rows if m.get("id")}
            procurement_meta = _procurement_from_row(proj)

            _render_editorial_title(proj.get("name", "Project"), "Creative Direction")
            design_brief = _design_brief_from_row(proj)
            _render_mood_strip(design_brief.get("mood_images", []))

            if show_setup:
                with st.expander("Mood Direction", expanded=False):
                    brief_keywords_text = st.text_input(
                        "Style keywords",
                        value=", ".join(design_brief.get("keywords", [])),
                        key=f"brief_keywords_{pid}",
                        placeholder="e.g. warm minimal, tropical modern, tactile calm",
                    )
                    brief_references_text = st.text_area(
                        "Reference intent",
                        value=design_brief.get("references", ""),
                        key=f"brief_refs_{pid}",
                        height=88,
                        placeholder="Describe forms, lines, and inspiration notes.",
                    )
                    brief_materials_mood = st.text_area(
                        "Materials mood",
                        value=design_brief.get("materials_mood", ""),
                        key=f"brief_material_mood_{pid}",
                        height=78,
                        placeholder="e.g. limewash walls, soft bronze accents, warm travertine.",
                    )
                    existing_mood_images = _normalize_mood_image_refs(design_brief.get("mood_images", []), limit=6)
                    st.caption(f"Current mood images: {len(existing_mood_images)}")
                    uploaded_mood_files = st.file_uploader(
                        "Mood strip image files (upload 3-6)",
                        type=["png", "jpg", "jpeg", "webp"],
                        accept_multiple_files=True,
                        key=f"brief_mood_files_{pid}",
                        help="Uploading files replaces the current mood strip images.",
                    )
                    clear_mood_images = st.checkbox("Clear current mood images", key=f"brief_mood_clear_{pid}", value=False)
                    hero_options = sorted(material_name_map.keys(), key=lambda mid: material_name_map.get(mid, ""))
                    selected_hero_ids = st.multiselect(
                        "Hero materials",
                        options=hero_options,
                        default=[mid for mid in design_brief.get("hero_material_ids", []) if mid in hero_options],
                        format_func=lambda mid: material_name_map.get(mid, mid),
                        key=f"brief_hero_materials_{pid}",
                    )

                    if st.button("Save Mood Direction", type="primary", key=f"save_mood_brief_{pid}"):
                        mood_images_for_save = list(existing_mood_images)
                        can_save_mood = True
                        if clear_mood_images:
                            mood_images_for_save = []
                        elif uploaded_mood_files:
                            converted_mood_images = []
                            failed_uploads = 0
                            for uploaded_file in uploaded_mood_files[:6]:
                                data_url = _uploaded_mood_file_to_data_url(uploaded_file)
                                if data_url:
                                    converted_mood_images.append(data_url)
                                else:
                                    failed_uploads += 1
                            if failed_uploads:
                                st.warning(f"{failed_uploads} mood image file(s) could not be processed.")
                            if converted_mood_images:
                                mood_images_for_save = converted_mood_images
                            else:
                                st.error("Could not process uploaded mood images. Please use PNG/JPG/WEBP files.")
                                can_save_mood = False

                        if can_save_mood:
                            next_brief = {
                                "keywords": [x.strip() for x in brief_keywords_text.split(",") if x.strip()],
                                "references": brief_references_text.strip(),
                                "materials_mood": brief_materials_mood.strip(),
                                "mood_images": mood_images_for_save[:6],
                                "hero_material_ids": selected_hero_ids[:6],
                            }
                            ok, err = _save_project_cart_fields(access_token, str(pid), {"design_brief": next_brief})
                            if ok:
                                st.success("Mood direction saved.")
                                st.rerun()
                            else:
                                st.error(f"Could not save mood direction: {err}")

                    hero_names = [material_name_map.get(mid, mid) for mid in selected_hero_ids[:6]]
                    if hero_names:
                        st.caption("Hero materials: " + " | ".join(hero_names))
                    else:
                        st.caption("Pin hero materials to steer object decisions quickly.")

            ps = project_statuses.get(
                str(pid), {"rooms": 0, "total": 0, "assigned": 0, "designer_ok": 0, "client_ok": 0}
            )
            total = ps["total"]
            assigned = ps["assigned"]
            designer_ok = ps["designer_ok"]
            client_ok = ps["client_ok"]

            if show_setup:
                c1, c2, c3, c4 = st.columns(4)
                c1.metric("Rooms", ps["rooms"])
                c2.metric("Objects", total)
                c3.metric("Assigned", f"{assigned}/{total}" if total else "0/0")
                c4.metric("Client OK", f"{client_ok}/{total}" if total else "0/0")

            rooms = load_project_rooms(pid)
            room_statuses = load_room_statuses([r["id"] for r in rooms]) if rooms else {}

            budget_cfg = get_project_budget_from_row(proj)
            project_budget = budget_cfg.get("project")
            room_budgets = budget_cfg.get("rooms", {})

            materials_rows = project_material_rows
            material_prices = {}
            for m in materials_rows:
                mid = m.get("id")
                if mid is None:
                    continue
                price = _safe_float(m.get("price"))
                if price is not None:
                    material_prices[str(mid)] = price

            room_ids = [r["id"] for r in rooms]
            room_objects_map = load_room_objects_batch(room_ids) if room_ids else {}

            room_spend_map = {}
            project_spend = 0.0
            project_missing_prices = 0
            for rid_iter in room_ids:
                metrics = _room_spend(room_objects_map.get(str(rid_iter), []), material_prices)
                room_spend_map[str(rid_iter)] = metrics
                project_spend += metrics["spend"]
                project_missing_prices += metrics["missing_price"]

            st.markdown("---")
            _render_editorial_title("Manage Project", "Live Edit")
            st.caption("Rename this project, manage rooms, or delete the project while working.")

            manage_panel_key = f"show_manage_panel_{pid}"
            if manage_panel_key not in st.session_state:
                st.session_state[manage_panel_key] = False

            if st.button("Manage Project", type="primary", key=f"toggle_manage_panel_{pid}"):
                st.session_state[manage_panel_key] = not st.session_state[manage_panel_key]

            if st.session_state[manage_panel_key]:
                project_name_key = f"manage_project_name_{pid}"
                if project_name_key not in st.session_state:
                    st.session_state[project_name_key] = proj.get("name", "")

                st.markdown("#### Project name")
                st.text_input("Project name", key=project_name_key)
                if st.button("Save project name", key=f"save_project_name_{pid}"):
                    if update_project_name(pid, st.session_state.get(project_name_key, "")):
                        st.success("Project name updated.")
                        st.rerun()

                st.markdown("#### Add room")
                add_room_key = f"manage_add_room_name_{pid}"
                if add_room_key not in st.session_state:
                    st.session_state[add_room_key] = ""

                add_cols = st.columns([0.75, 0.25])
                with add_cols[0]:
                    st.text_input("New room name", key=add_room_key, placeholder="e.g. Media Room")
                with add_cols[1]:
                    if st.button("Add room", key=f"add_room_btn_{pid}", type="secondary"):
                        next_room = st.session_state.get(add_room_key, "").strip()
                        if add_project_room(
                            pid,
                            next_room,
                            template_map=st.session_state.get("user_template_map") or default_user_template(),
                        ):
                            st.session_state[add_room_key] = ""
                            st.success(f"Added room: {next_room}")
                            st.rerun()

                st.markdown("#### Existing rooms")
                if not rooms:
                    st.info("No rooms yet. Add your first room above.")
                else:
                    for room_row in rooms:
                        rid_manage = str(room_row.get("id"))
                        room_name = str(room_row.get("name") or "Room")
                        room_name_key = f"manage_room_name_{pid}_{rid_manage}"
                        if room_name_key not in st.session_state:
                            st.session_state[room_name_key] = room_name

                        with st.expander(room_name, expanded=False):
                            st.text_input("Room name", key=room_name_key)

                            row_cols = st.columns([0.3, 0.35, 0.35])
                            with row_cols[0]:
                                if st.button("Rename", key=f"rename_room_btn_{pid}_{rid_manage}"):
                                    next_name = st.session_state.get(room_name_key, "").strip()
                                    if rename_project_room(pid, rid_manage, next_name):
                                        st.success("Room renamed.")
                                        st.rerun()
                            with row_cols[1]:
                                confirm_key = f"confirm_delete_room_{pid}_{rid_manage}"
                                st.checkbox("Confirm delete", key=confirm_key)
                            with row_cols[2]:
                                if st.button(
                                    "Delete room",
                                    key=f"delete_room_btn_{pid}_{rid_manage}",
                                    disabled=not st.session_state.get(confirm_key, False),
                                ):
                                    if delete_project_room(pid, rid_manage):
                                        if str(st.session_state.get("current_room_id")) == rid_manage:
                                            st.session_state.current_room_id = None
                                            st.session_state.current_object_id = None
                                        st.success("Room deleted.")
                                        st.rerun()

                st.markdown("#### Delete project")
                st.caption("This will permanently delete this project, all rooms, and all room objects.")
                project_confirm_key = f"confirm_delete_project_{pid}"
                st.checkbox("I understand this cannot be undone", key=project_confirm_key)
                if st.button(
                    "Delete project",
                    key=f"delete_project_btn_{pid}",
                    disabled=not st.session_state.get(project_confirm_key, False),
                ):
                    if delete_project(pid):
                        remaining_projects = [p for p in projects if str(p.get("id")) != str(pid)]
                        st.session_state.current_project_id = remaining_projects[0]["id"] if remaining_projects else None
                        st.session_state.current_room_id = None
                        st.session_state.current_object_id = None
                        st.success("Project deleted.")
                        st.rerun()

            _render_editorial_title("Project Rhythm", "Progress")
            st.progress((assigned / total) if total else 0.0)
            st.caption(f"Designer approved: {designer_ok}/{total} | Client approved: {client_ok}/{total}")

            st.markdown("---")
            _render_editorial_title("Budget Story", "Financial Lens")

            budget_cols = st.columns([0.34, 0.33, 0.33])
            budget_cols[0].metric("Estimated Spend", f"{project_spend:,.0f} THB")
            budget_cols[1].metric("Project Budget", f"{project_budget:,.0f} THB" if project_budget is not None else "Not set")
            if project_budget is None:
                budget_cols[2].metric("Remaining", "Not set")
            else:
                budget_cols[2].metric("Remaining", f"{(project_budget - project_spend):,.0f} THB")

            if project_budget is not None:
                if project_budget > 0:
                    budget_ratio = project_spend / project_budget
                else:
                    budget_ratio = 1.0 if project_spend > 0 else 0.0
                st.progress(max(0.0, min(1.0, budget_ratio)))
                if project_spend > project_budget:
                    st.warning(f"Over budget by {(project_spend - project_budget):,.0f} THB")
                else:
                    st.caption(f"Within budget by {(project_budget - project_spend):,.0f} THB")
            else:
                st.caption("Set a project budget to track spend against target.")

            if project_missing_prices:
                st.caption(f"{project_missing_prices} assigned objects have no material price and are excluded from spend.")

            budget_panel_key = f"show_budget_panel_{pid}"
            if budget_panel_key not in st.session_state:
                st.session_state[budget_panel_key] = False

            panel_toggle_label = "Manage Budget"
            if st.button(panel_toggle_label, type="primary", key=f"toggle_budget_panel_{pid}"):
                st.session_state[budget_panel_key] = not st.session_state[budget_panel_key]

            if st.session_state[budget_panel_key]:
                st.info("Set the overall project budget and optional room budgets.")

                proj_default = float(project_budget) if project_budget is not None else 0.0
                proj_budget_input = st.number_input(
                    "Project budget (THB)",
                    min_value=0.0,
                    value=proj_default,
                    step=1000.0,
                    key=f"project_budget_input_{pid}",
                )
                set_proj_budget = st.checkbox(
                    "Enable project budget",
                    value=(project_budget is not None),
                    key=f"enable_project_budget_{pid}",
                )

                st.markdown("Room budgets (optional)")
                edited_room_budgets = {}
                for r in rooms:
                    rid = str(r["id"])
                    current_room_budget = _safe_float(room_budgets.get(rid))
                    room_budget_value = st.number_input(
                        f"{r.get('name', 'Room')} budget (THB)",
                        min_value=0.0,
                        value=float(current_room_budget) if current_room_budget is not None else 0.0,
                        step=500.0,
                        key=f"room_budget_input_{pid}_{rid}",
                    )
                    include_room_budget = st.checkbox(
                        f"Enable {r.get('name', 'Room')} budget",
                        value=(current_room_budget is not None),
                        key=f"room_budget_enabled_{pid}_{rid}",
                    )
                    if include_room_budget:
                        edited_room_budgets[rid] = room_budget_value

                total_room_budget = sum(edited_room_budgets.values())
                st.caption(f"Total enabled room budgets: {total_room_budget:,.0f} THB")

                save_col, clear_col = st.columns([1, 1])
                with save_col:
                    if st.button("Save budgets", type="primary", key=f"save_budgets_{pid}"):
                        next_project_budget = proj_budget_input if set_proj_budget else None
                        if next_project_budget is not None and total_room_budget > next_project_budget:
                            st.error(
                                "Total room budgets cannot exceed the project budget. "
                                f"Room budgets: {total_room_budget:,.0f} THB, "
                                f"Project budget: {next_project_budget:,.0f} THB."
                            )
                        elif save_project_budget(pid, next_project_budget, edited_room_budgets):
                            st.success("Budgets saved.")
                            st.rerun()
                with clear_col:
                    if st.button("Clear all budgets", key=f"clear_budgets_{pid}"):
                        if save_project_budget(pid, None, {}):
                            st.success("All budgets cleared.")
                            st.rerun()

            st.markdown("---")
            _render_editorial_title("Procurement Pulse", "Purchasing Lens")
            procurement_stats = _procurement_metrics(room_objects_map, material_lookup, procurement_meta)
            assigned_specs = procurement_stats["assigned"]

            pulse_cols = st.columns(4)
            pulse_cols[0].metric("Assigned specs", assigned_specs)
            pulse_cols[1].metric(
                "Priced",
                f"{procurement_stats['priced']}/{assigned_specs}" if assigned_specs else "0/0",
            )
            pulse_cols[2].metric(
                "Lead time known",
                f"{procurement_stats['lead_known']}/{assigned_specs}" if assigned_specs else "0/0",
            )
            pulse_cols[3].metric(
                "Supplier named",
                f"{procurement_stats['supplier_named']}/{assigned_specs}" if assigned_specs else "0/0",
            )

            stage_cols = st.columns(4)
            stage_cols[0].metric("Quote requested", procurement_stats["quote_requested"])
            stage_cols[1].metric("Quote received", procurement_stats["quote_received"])
            stage_cols[2].metric("PO ready", procurement_stats["po_ready"])
            stage_cols[3].metric("PO sent", procurement_stats["po_sent"])

            if assigned_specs > 0:
                price_ratio = procurement_stats["priced"] / assigned_specs
                lead_ratio = procurement_stats["lead_known"] / assigned_specs
                supplier_ratio = procurement_stats["supplier_named"] / assigned_specs
                readiness = (price_ratio + lead_ratio + supplier_ratio) / 3.0
                st.progress(max(0.0, min(1.0, readiness)))
                st.caption(
                    f"Procurement readiness: {readiness * 100:.0f}% | "
                    f"Quotes received: {procurement_stats['quote_received']}/{assigned_specs}"
                )

                missing_signals = []
                if procurement_stats["priced"] < assigned_specs:
                    missing_signals.append("price")
                if procurement_stats["lead_known"] < assigned_specs:
                    missing_signals.append("lead time")
                if procurement_stats["supplier_named"] < assigned_specs:
                    missing_signals.append("supplier")

                if missing_signals:
                    st.markdown(
                        '<div class="inspire-empty">Purchasing focus: complete '
                        + ", ".join(missing_signals)
                        + " details on assigned objects to speed quote-to-PO flow.</div>",
                        unsafe_allow_html=True,
                    )
            else:
                st.markdown(
                    '<div class="inspire-empty">Assign first materials to activate the procurement pulse and track quote readiness.</div>',
                    unsafe_allow_html=True,
                )

            relational_items = []
            relational_error = None
            if access_token:
                try:
                    relational_items = list_project_items_relational(str(pid), access_token=access_token) or []
                except Exception as e:
                    relational_error = str(e)

            with st.expander("Export Procurement to Excel", expanded=False):
                st.caption("Primary source: relational project_items (new model).")
                if relational_error:
                    st.warning(f"Relational model unavailable: {relational_error}")

                if relational_items:
                    group_mode = st.selectbox(
                        "Preview grouping",
                        ["By room", "By supplier", "By category"],
                        key=f"rel_group_mode_{pid}",
                    )
                    if group_mode == "By room":
                        grouped_blocks = list_project_items_grouped_by_room_relational(str(pid), access_token=access_token)
                    elif group_mode == "By supplier":
                        grouped_blocks = list_project_items_grouped_by_supplier_relational(str(pid), access_token=access_token)
                    else:
                        grouped_blocks = list_project_items_grouped_by_category_relational(str(pid), access_token=access_token)

                    metrics_cols = st.columns(3)
                    total_value = sum(float(item.get("line_total") or 0.0) for item in relational_items)
                    priced_lines = sum(1 for item in relational_items if item.get("unit_price") is not None)
                    metrics_cols[0].metric("Project items", len(relational_items))
                    metrics_cols[1].metric("Priced lines", f"{priced_lines}/{len(relational_items)}")
                    metrics_cols[2].metric("Known value", f"{total_value:,.0f} THB")

                    preview_rows = []
                    for group in grouped_blocks[:20]:
                        preview_rows.append(
                            {
                                "Group": group.get("label"),
                                "Items": group.get("count"),
                                "Known Value (THB)": float(group.get("total_value") or 0.0),
                            }
                        )
                    if preview_rows:
                        st.dataframe(pd.DataFrame(preview_rows), use_container_width=True, hide_index=True)

                    workbook_bytes, frames = build_project_items_excel_bytes_relational(str(pid), access_token=access_token)
                    summary_df = frames.get("summary") if isinstance(frames, dict) else None
                    summary_rows = len(summary_df.index) if hasattr(summary_df, "index") else 0
                    by_room_rows = len(frames.get("by_room", [])) if isinstance(frames, dict) else 0
                    by_supplier_rows = len(frames.get("by_supplier", [])) if isinstance(frames, dict) else 0
                    by_category_rows = len(frames.get("by_category", [])) if isinstance(frames, dict) else 0
                    st.caption(
                        "Workbook rows: "
                        f"Summary={summary_rows}, By Room={by_room_rows}, "
                        f"By Supplier={by_supplier_rows}, By Category={by_category_rows}"
                    )
                    project_slug = _file_safe_name(proj.get("name") or "project")
                    timestamp_suffix = datetime.now().strftime("%Y%m%d_%H%M")
                    export_filename = f"{project_slug}_project_items_{timestamp_suffix}.xlsx"
                    st.download_button(
                        "Download Excel (Relational)",
                        data=workbook_bytes,
                        file_name=export_filename,
                        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        key=f"proc_export_download_rel_{pid}",
                        type="primary",
                    )
                else:
                    st.caption("Fallback source: legacy room objects (during migration period).")
                    stage_filter_options = ["all"] + PROCUREMENT_STAGE_OPTIONS
                    selected_stage_filter = st.selectbox(
                        "Order stage filter",
                        options=stage_filter_options,
                        format_func=lambda value: "All stages" if value == "all" else _procurement_stage_label(value),
                        key=f"proc_export_stage_filter_{pid}",
                    )
                    include_internal_notes_export = st.checkbox(
                        "Include internal notes",
                        value=False,
                        key=f"proc_export_internal_notes_{pid}",
                    )

                    export_rows = _build_procurement_export_rows(
                        project_row=proj,
                        rooms=rooms,
                        room_objects_map=room_objects_map,
                        material_lookup=material_lookup,
                        procurement_block=procurement_meta,
                        include_internal_notes=include_internal_notes_export,
                        stage_filter=selected_stage_filter,
                    )
                    st.caption(f"{len(export_rows)} rows included in fallback export.")

                    if export_rows:
                        workbook_bytes = _build_procurement_export_workbook(
                            export_rows,
                            include_internal_notes=include_internal_notes_export,
                        )
                        project_slug = _file_safe_name(proj.get("name") or "project")
                        stage_slug = selected_stage_filter if selected_stage_filter != "all" else "all_stages"
                        timestamp_suffix = datetime.now().strftime("%Y%m%d_%H%M")
                        export_filename = f"{project_slug}_procurement_{stage_slug}_{timestamp_suffix}.xlsx"
                        st.download_button(
                            "Download Excel (Legacy)",
                            data=workbook_bytes,
                            file_name=export_filename,
                            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            key=f"proc_export_download_{pid}",
                            type="primary",
                        )
                    else:
                        st.info("No rows matched this filter. Adjust filters or assign materials first.")

            st.markdown("---")
            _render_editorial_title("Client Pulse", "Feedback")
            object_map = {}
            room_name_map = {str(r.get("id")): (r.get("name") or "Room") for r in rooms}
            for rid_key, objects in room_objects_map.items():
                room_name = room_name_map.get(str(rid_key), "Room")
                for obj_row in (objects or []):
                    object_map[str(obj_row.get("id"))] = {
                        "object_name": obj_row.get("object_name") or "Object",
                        "room_name": room_name,
                    }

            cart = proj.get("cart") if isinstance(proj.get("cart"), dict) else {}
            comments_map = cart.get("comments") if isinstance(cart.get("comments"), dict) else {}
            approvals_map = cart.get("approval_history") if isinstance(cart.get("approval_history"), dict) else {}

            client_events = []
            for oid_key, rows in comments_map.items():
                if not isinstance(rows, list):
                    continue
                for row in rows:
                    if str(row.get("author_role") or "").strip().lower() != "client":
                        continue
                    obj_meta = object_map.get(str(oid_key), {"object_name": "Object", "room_name": "Unknown room"})
                    client_events.append(
                        {
                            "kind": "comment",
                            "created_at": row.get("created_at"),
                            "actor_name": row.get("author_name") or "Client",
                            "text": row.get("comment") or "",
                            "object_name": obj_meta["object_name"],
                            "room_name": obj_meta["room_name"],
                        }
                    )

            for oid_key, rows in approvals_map.items():
                if not isinstance(rows, list):
                    continue
                for row in rows:
                    if str(row.get("actor_role") or "").strip().lower() != "client":
                        continue
                    obj_meta = object_map.get(str(oid_key), {"object_name": "Object", "room_name": "Unknown room"})
                    client_events.append(
                        {
                            "kind": "approval",
                            "created_at": row.get("created_at"),
                            "actor_name": row.get("actor_name") or "Client",
                            "action": row.get("action") or "-",
                            "object_name": obj_meta["object_name"],
                            "room_name": obj_meta["room_name"],
                        }
                    )

            client_events.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
            feedback_cols = st.columns(3)
            feedback_cols[0].metric("Client comments", sum(1 for e in client_events if e["kind"] == "comment"))
            feedback_cols[1].metric("Approval actions", sum(1 for e in client_events if e["kind"] == "approval"))
            feedback_cols[2].metric("Latest update", _format_ts(client_events[0].get("created_at")) if client_events else "-")

            if not client_events:
                st.markdown(
                    '<div class="inspire-empty">No client responses yet. Share one curated room to start focused feedback.</div>',
                    unsafe_allow_html=True,
                )
            else:
                for event in client_events[:30]:
                    if event["kind"] == "comment":
                        st.write(
                            f"- {_format_ts(event.get('created_at'))} - {event.get('actor_name')} commented on "
                            f"{event.get('room_name')} / {event.get('object_name')}: {event.get('text')}"
                        )
                    else:
                        st.write(
                            f"- {_format_ts(event.get('created_at'))} - {event.get('actor_name')} "
                            f"{event.get('action')} {event.get('room_name')} / {event.get('object_name')}"
                        )

            st.markdown("---")
            _render_editorial_title("Room Chapters", "Execution")
            if not show_selection:
                st.caption("Switch Workspace focus to Material Selection, Client Review, or Procurement to open and edit room objects.")

            if not rooms:
                st.markdown(
                    '<div class="inspire-empty">No room chapters yet. Add rooms to begin turning concept into specification.</div>',
                    unsafe_allow_html=True,
                )
                objs = []
            else:
                grid_cols = st.columns(3)
                for i, r in enumerate(rooms):
                    rid = r["id"]
                    rname = r["name"]
                    rs = room_statuses.get(
                        str(rid), {"total": 0, "assigned": 0, "designer_ok": 0, "client_ok": 0}
                    )
                    rt = rs["total"]
                    ra = rs["assigned"]
                    rc = rs["client_ok"]
                    pct = (ra / rt) if rt else 0.0

                    with grid_cols[i % 3]:
                        with st.container(border=True):
                            st.markdown(f"**{rname}**")
                            st.caption(f"{ra}/{rt} assigned | {rc}/{rt} client ok")
                            st.progress(pct)
                            rm = room_spend_map.get(str(rid), {"spend": 0.0, "missing_price": 0})
                            room_budget = _safe_float(room_budgets.get(str(rid)))
                            if room_budget is None:
                                st.caption(f"Spend: {rm['spend']:,.0f} THB - Room budget not set")
                            else:
                                delta = room_budget - rm["spend"]
                                if delta >= 0:
                                    st.caption(f"Spend: {rm['spend']:,.0f} / {room_budget:,.0f} THB - {delta:,.0f} THB left")
                                else:
                                    st.caption(f"Spend: {rm['spend']:,.0f} / {room_budget:,.0f} THB - Over by {abs(delta):,.0f} THB")
                            if rm["missing_price"]:
                                st.caption(f"{rm['missing_price']} assigned objects have no price")

                            if st.button("Open room", key=f"open_room_{rid}", disabled=not show_selection):
                                st.session_state.current_room_id = rid
                                st.session_state.current_object_id = None
                                st.rerun()

                # Room detail
                st.markdown("---")
                objs = []
                if st.session_state.get("current_room_id"):
                    rid = st.session_state.current_room_id
                    room = next((x for x in rooms if str(x["id"]) == str(rid)), None)
                    st.markdown(f"### Room: {room.get('name') if room else ''}")

                    current_room_budget = _safe_float(room_budgets.get(str(rid)))
                    current_room_metrics = room_spend_map.get(str(rid), {"spend": 0.0, "missing_price": 0})
                    if current_room_budget is None:
                        st.caption(f"Budget: not set - Estimated spend: {current_room_metrics['spend']:,.0f} THB")
                    else:
                        st.caption(
                            f"Budget: {current_room_budget:,.0f} THB - Estimated spend: {current_room_metrics['spend']:,.0f} THB"
                        )
                    if current_room_metrics["missing_price"]:
                        st.caption(f"{current_room_metrics['missing_price']} assigned objects in this room have no price.")

                    objs = load_room_objects(rid)
                    if not objs:
                        st.markdown(
                            "<div class=\"inspire-empty\">No objects yet. Start with anchor pieces to define this room's character.</div>",
                            unsafe_allow_html=True,
                        )
                    else:
                        for o in objs:
                            oid = o["id"]
                            with st.container(border=True):
                                col1, col2, col3, col4 = st.columns([3, 1, 1, 1])
                                with col1:
                                    st.markdown(f"**{o.get('object_name')}**")
                                    st.caption(f"Category: {o.get('category')} | Qty: {o.get('qty')}")
                                with col2:
                                    st.markdown("Assigned")
                                    st.write("Yes" if o.get("material_id") else "No")
                                with col3:
                                    st.markdown("Status")
                                    st.write(o.get("status", "unassigned"))
                                with col4:
                                    if st.button("Open", key=f"edit_obj_{oid}"):
                                        st.session_state.current_object_id = oid
                                        st.rerun()

                # Object editor
                if st.session_state.get("current_object_id") and show_selection:
                    st.markdown("---")
                    oid = st.session_state.current_object_id
                    obj = next((x for x in objs if str(x["id"]) == str(oid)), None)

                    if not st.session_state.get("current_room_id"):
                        st.info("Select a room first.")
                    elif not obj:
                        st.info("Object not found in current room (maybe room changed).")
                    else:
                        _render_editorial_title(f"Edit: {obj.get('object_name')}", "Object Studio")
                        st.markdown(
                            '<div class="quick-actions"><strong>Guided workflow:</strong> 1) Pick material 2) Optional context 3) Assign material + save</div>',
                            unsafe_allow_html=True,
                        )

                        material_options = []
                        material_labels = {}
                        material_rows = {}
                        material_error = None

                        query_key = f"obj_material_query_{oid}"
                        if query_key not in st.session_state:
                            st.session_state[query_key] = obj.get("object_name") or ""

                        st.markdown("#### Step 1 · Pick a material")
                        search_cols = st.columns([0.78, 0.22])
                        query_text = search_cols[0].text_input(
                            "Search materials",
                            key=query_key,
                            placeholder="Type texture, style, or usage",
                        )
                        refresh_key = f"obj_material_refresh_{oid}"
                        if refresh_key not in st.session_state:
                            st.session_state[refresh_key] = 0
                        if search_cols[1].button("Search", key=f"obj_search_btn_{oid}"):
                            st.session_state[refresh_key] += 1

                        if access_token and query_text.strip():
                            try:
                                material_options = search_materials_cached(
                                    access_token,
                                    query_text.strip(),
                                    limit=20,
                                    refresh_nonce=int(st.session_state.get(refresh_key, 0)),
                                )
                            except Exception as e:
                                material_error = str(e)

                        current_material_id = str(obj.get("material_id")) if obj.get("material_id") else None
                        select_options = [None]
                        for m in material_options:
                            mid = str(m.get("id"))
                            if not mid:
                                continue
                            select_options.append(mid)
                            material_rows[mid] = m
                            name = m.get("name") or "Unnamed material"
                            category = m.get("category") or "Uncategorized"
                            material_labels[mid] = f"{name} ({category})"

                        if current_material_id and current_material_id not in material_labels:
                            all_rows = load_materials_cached(access_token) if access_token else []
                            cur_row = next((r for r in all_rows if str(r.get("id")) == current_material_id), None)
                            if cur_row:
                                material_rows[current_material_id] = cur_row
                                material_labels[current_material_id] = (
                                    f"{cur_row.get('name') or 'Current material'} "
                                    f"({cur_row.get('category') or 'Uncategorized'})"
                                )
                            else:
                                material_labels[current_material_id] = f"Current material ({current_material_id[:8]})"
                            select_options.append(current_material_id)

                        select_key = f"obj_material_select_{oid}"
                        if select_key not in st.session_state:
                            st.session_state[select_key] = current_material_id if current_material_id in select_options else None
                        elif st.session_state[select_key] not in select_options:
                            st.session_state[select_key] = current_material_id if current_material_id in select_options else None

                        selected_material_id = st.selectbox(
                            "Selected material",
                            options=select_options,
                            format_func=lambda x: "None" if x is None else material_labels.get(x, x),
                            key=select_key,
                        )

                        preview_rows = material_options[:8]
                        if preview_rows:
                            keyboard_options = [str(m.get("id")) for m in preview_rows if m.get("id") is not None]
                            if keyboard_options:
                                radio_key = f"obj_keyboard_pick_{oid}"
                                if str(selected_material_id) in keyboard_options:
                                    st.session_state[radio_key] = str(selected_material_id)
                                elif st.session_state.get(radio_key) not in keyboard_options:
                                    st.session_state[radio_key] = keyboard_options[0]
                                st.radio(
                                    "Navigate top matches (use up/down arrows, press Enter on Assign)",
                                    options=keyboard_options,
                                    format_func=lambda mid: material_labels.get(mid, mid),
                                    key=radio_key,
                                    on_change=_copy_session_value,
                                    args=(radio_key, select_key),
                                )

                        if material_error:
                            st.warning(f"Could not search materials: {material_error}")
                        elif not query_text.strip():
                            st.caption("Search is prefilled with object name. Refine with mood keywords.")
                        elif not material_options:
                            st.markdown(
                                '<div class="inspire-empty">No match yet. Try broader texture terms like "linen", "matte oak", or "handmade tile".</div>',
                                unsafe_allow_html=True,
                            )

                        assignment_notes = _object_assignment_notes_from_row(proj)
                        procurement_notes = procurement_meta.get("notes") or {}
                        procurement_quotes = procurement_meta.get("quote_status") or {}
                        procurement_priorities = procurement_meta.get("priority") or {}
                        procurement_targets = procurement_meta.get("target_price") or {}
                        procurement_stages = procurement_meta.get("order_stage") or {}

                        note_key = f"obj_why_note_{oid}"
                        if note_key not in st.session_state:
                            st.session_state[note_key] = assignment_notes.get(str(oid), "")

                        priority_options = ["routine", "high", "critical"]
                        priority_key = f"obj_proc_priority_{oid}"
                        if priority_key not in st.session_state:
                            priority_value = str(procurement_priorities.get(str(oid)) or "routine").strip().lower()
                            st.session_state[priority_key] = priority_value if priority_value in priority_options else "routine"

                        quote_options = ["not_started", "quote_requested", "quote_received", "po_ready", "po_sent"]
                        quote_key = f"obj_proc_quote_{oid}"
                        if quote_key not in st.session_state:
                            quote_value = str(procurement_quotes.get(str(oid)) or "not_started").strip().lower()
                            st.session_state[quote_key] = quote_value if quote_value in quote_options else "not_started"

                        stage_options = PROCUREMENT_STAGE_OPTIONS
                        stage_key = f"obj_proc_stage_{oid}"
                        if stage_key not in st.session_state:
                            stage_value = _normalize_procurement_stage(procurement_stages.get(str(oid)))
                            if not stage_value:
                                stage_value = _suggest_procurement_stage(
                                    f"{obj.get('category') or ''} {obj.get('object_name') or ''}"
                                )
                            st.session_state[stage_key] = stage_value if stage_value in stage_options else "planning"

                        target_price_default = _safe_float(procurement_targets.get(str(oid)))
                        target_toggle_key = f"obj_proc_target_enabled_{oid}"
                        if target_toggle_key not in st.session_state:
                            st.session_state[target_toggle_key] = target_price_default is not None
                        target_price_key = f"obj_proc_target_price_{oid}"
                        if target_price_key not in st.session_state:
                            st.session_state[target_price_key] = float(target_price_default) if target_price_default is not None else 0.0

                        procurement_note_key = f"obj_proc_note_{oid}"
                        if procurement_note_key not in st.session_state:
                            st.session_state[procurement_note_key] = procurement_notes.get(str(oid), "")

                        st.markdown("#### Step 2 - Optional context")
                        with st.expander("Optional: Design + purchasing context", expanded=False):
                            st.text_area(
                                "Why this works",
                                key=note_key,
                                height=84,
                                placeholder="Explain fit with mood, light, durability, and budget intent.",
                            )

                            purchasing_priority = st.selectbox(
                                "Sourcing priority",
                                options=priority_options,
                                format_func=_procurement_priority_label,
                                key=priority_key,
                                disabled=not show_procurement,
                            )
                            quote_status = st.selectbox(
                                "Quote status",
                                options=quote_options,
                                format_func=_procurement_quote_label,
                                key=quote_key,
                                disabled=not show_procurement,
                            )
                            order_stage = st.selectbox(
                                "Order stage",
                                options=stage_options,
                                format_func=_procurement_stage_label,
                                key=stage_key,
                                disabled=not show_procurement,
                            )
                            priority_chip = _procurement_priority_label(purchasing_priority)
                            quote_chip = _procurement_quote_label(quote_status)
                            stage_chip = _procurement_stage_label(order_stage)
                            priority_tone = _procurement_priority_tone(purchasing_priority)
                            quote_tone = _procurement_quote_tone(quote_status)
                            disabled_class = " proc-pill-disabled" if not show_procurement else ""
                            st.markdown(
                                (
                                    '<div class="procurement-indicators">'
                                    f'<span class="procurement-pill {priority_tone}{disabled_class}">Priority: {html.escape(priority_chip)}</span>'
                                    f'<span class="procurement-pill {quote_tone}{disabled_class}">Quote: {html.escape(quote_chip)}</span>'
                                    "</div>"
                                ),
                                unsafe_allow_html=True,
                            )
                            st.caption(f"Order stage: {stage_chip}")

                            target_cols = st.columns([0.35, 0.65])
                            with target_cols[0]:
                                use_target_price = st.checkbox(
                                    "Set target price",
                                    key=target_toggle_key,
                                    disabled=not show_procurement,
                                )
                            with target_cols[1]:
                                st.number_input(
                                    "Target price (THB)",
                                    min_value=0.0,
                                    value=float(st.session_state[target_price_key]),
                                    step=10.0,
                                    key=target_price_key,
                                    disabled=(not use_target_price) or (not show_procurement),
                                )

                            st.text_area(
                                "Purchasing note",
                                key=procurement_note_key,
                                height=82,
                                placeholder="Capture quote context, alternates, and supplier constraints.",
                                disabled=not show_procurement,
                            )

                        st.markdown("#### Step 3 - Assign material + save")
                        status_options = ["unassigned", "selected", "designer_approved", "client_approved"]
                        current_status = obj.get("status") or "unassigned"
                        if current_status not in status_options:
                            current_status = "unassigned"

                        new_status = st.selectbox(
                            "Status",
                            status_options,
                            index=status_options.index(current_status),
                            key=f"obj_status_select_{oid}",
                        )

                        def _assign_material_and_save(material_id_value: str):
                            sb = get_supabase(access_token)
                            next_status = new_status if new_status in status_options else (obj.get("status") or "unassigned")
                            if next_status == "unassigned":
                                next_status = "selected"
                            sb.table("room_objects").update({"material_id": material_id_value, "status": next_status}).eq("id", oid).execute()

                            next_notes = dict(assignment_notes)
                            clean_why = str(st.session_state.get(note_key) or "").strip()
                            if clean_why:
                                next_notes[str(oid)] = clean_why
                            else:
                                next_notes.pop(str(oid), None)

                            raw_quote = str(st.session_state.get(quote_key) or "not_started").strip().lower()
                            raw_priority = str(st.session_state.get(priority_key) or "routine").strip().lower()
                            raw_proc_note = str(st.session_state.get(procurement_note_key) or "").strip()
                            raw_target_value = _safe_float(st.session_state.get(target_price_key))
                            raw_stage_value = _normalize_procurement_stage(st.session_state.get(stage_key))
                            use_target_value = bool(st.session_state.get(target_toggle_key))
                            target_price_value = raw_target_value if use_target_value else None

                            next_procurement = _update_procurement_for_object(
                                procurement_meta,
                                str(oid),
                                raw_proc_note,
                                raw_quote if raw_quote != "not_started" else "",
                                raw_priority if raw_priority != "routine" else "",
                                target_price_value,
                                raw_stage_value or "",
                            )
                            return _save_project_cart_fields(
                                access_token,
                                str(pid),
                                {"assignment_notes": next_notes, "procurement": next_procurement},
                            )

                        action_cols = st.columns([2, 1, 1])
                        with action_cols[0]:
                            if st.button(
                                "Assign Material + Save",
                                key=f"assign_obj_material_{oid}",
                                type="primary",
                                disabled=not (access_token and selected_material_id),
                            ):
                                ok, err = _assign_material_and_save(str(selected_material_id))
                                if not ok:
                                    st.warning(f"Material was assigned, but notes were not saved: {err}")
                                st.success("Material assigned with design and purchasing context.")
                                st.rerun()
                        with action_cols[1]:
                            if st.button("Clear", key=f"clear_obj_material_{oid}", disabled=not access_token):
                                sb = get_supabase(access_token)
                                sb.table("room_objects").update({"material_id": None, "status": "unassigned"}).eq("id", oid).execute()

                                next_notes = dict(assignment_notes)
                                next_notes.pop(str(oid), None)
                                next_procurement = _update_procurement_for_object(
                                    procurement_meta,
                                    str(oid),
                                    "",
                                    "",
                                    "",
                                    None,
                                    "",
                                )
                                _save_project_cart_fields(
                                    access_token,
                                    str(pid),
                                    {"assignment_notes": next_notes, "procurement": next_procurement},
                                )
                                st.success("Material, status, and notes reset.")
                                st.rerun()
                        with action_cols[2]:
                            if st.button("Close", key=f"close_obj_editor_{oid}"):
                                st.session_state.current_object_id = None
                                st.rerun()

                        if preview_rows:
                            _render_editorial_title("Top Material Matches", "Mini Spec Sheets")
                            card_cols = st.columns(2)
                            for i, m in enumerate(preview_rows):
                                mid = str(m.get("id")) if m.get("id") is not None else None
                                with card_cols[i % 2]:
                                    st.markdown('<div class="material-sheet">', unsafe_allow_html=True)
                                    img = (m.get("image_url") or "").strip()
                                    if img.startswith("http"):
                                        st.image(img, use_container_width=True)
                                    else:
                                        st.caption("No reference image")

                                    st.markdown(f"#### {m.get('name') or 'Unnamed material'}")
                                    tags = _infer_tactile_tags(m)
                                    tags_html = "".join([f'<span class="tag-line">{html.escape(t)}</span>' for t in tags])
                                    st.markdown(tags_html, unsafe_allow_html=True)

                                    price_value = _safe_float(m.get("price"))
                                    price_label = f"{price_value:,.0f} THB" if price_value is not None else "Price on request"
                                    st.caption(
                                        f"Price: {price_label} | {_lead_time_label(m)} | {_supplier_confidence_label(m)}"
                                    )
                                    if m.get("category"):
                                        st.caption(f"Category: {m.get('category')}")
                                    if m.get("description"):
                                        st.write(str(m.get("description"))[:220])
                                    if mid and st.button("Use this", key=f"obj_pick_mat_{oid}_{mid}", disabled=not access_token):
                                        ok, err = _assign_material_and_save(mid)
                                        if not ok:
                                            st.warning(f"Material was assigned, but notes were not saved: {err}")
                                        st.success("Material assigned from top matches.")
                                        st.rerun()
                                    st.markdown("</div>", unsafe_allow_html=True)

                        _render_editorial_title("Object Conversation", "Comments")
                        comments = get_object_comments_from_row(proj, oid)
                        if comments:
                            for row in comments[-10:]:
                                author = row.get("author_name") or "Unknown"
                                role = row.get("author_role") or "user"
                                text = row.get("comment") or ""
                                st.write(f"- {author} ({role}): {text}")
                        else:
                            st.caption("No comments yet. Capture intent early to align supplier and client decisions.")

                        _render_editorial_title("Approval Timeline", "History")
                        approval_rows = get_object_approval_history_from_row(proj, oid)
                        if approval_rows:
                            for row in reversed(approval_rows[-10:]):
                                st.write(
                                    f"- {_format_ts(row.get('created_at'))}: "
                                    f"{row.get('actor_name') or 'Unknown'} "
                                    f"({row.get('actor_role') or 'user'}) "
                                    f"{row.get('action') or '-'}"
                                )
                        else:
                            st.caption("No approval history yet. Mark one material as approved to build confidence momentum.")

                        designer_comment = st.text_area(
                            "Add comment",
                            key=f"designer_comment_{oid}",
                            placeholder="Reply to client or leave internal note",
                            height=80,
                        )
                        if st.button("Post comment", key=f"designer_post_comment_{oid}"):
                            if append_object_comment(
                                project_id=str(pid),
                                object_id=str(oid),
                                author_role="designer",
                                author_name=full_name,
                                comment=designer_comment,
                            ):
                                st.success("Comment posted.")
                                st.rerun()

# -----------------------------
# Page: Materials Gallery
# -----------------------------
elif page == "Materials Gallery":
    st.title("Materials Gallery")

    if st.button("Refresh Product Catalog"):
        st.cache_data.clear()
        st.rerun()

    if embeddings is None or df.empty:
        st.warning("Catalog needs curation before inspiration can flow. Add products and refresh the catalog.")
    else:
        query = st.text_input("What material or item are you looking for?", placeholder="e.g. light wood bench for outdoor")
        if query:
            query_vec = model.encode(query, convert_to_numpy=True)
            scores = util.cos_sim(query_vec, embeddings)[0]
            top_k_idx = np.argsort(-scores)[:10]
            results = df.iloc[top_k_idx]

            for i, (_, row) in enumerate(results.iterrows()):
                render_product_card(row, i, room_options=[])

# -----------------------------
# Page: My Materials
# -----------------------------
elif page == "My Materials":
    st.title("My Materials Library")

    with st.expander("Add material", expanded=False):
        name = st.text_input("Name", key="mat_name")
        description = st.text_area("Description", key="mat_desc")
        category = st.text_input("Category", key="mat_cat")
        supplier = st.text_input("Supplier / Store", key="mat_supplier")
        lead_time_days = st.number_input("Lead time (days)", min_value=0, step=1, value=0, key="mat_lead_days")
        price = st.number_input("Price (THB)", min_value=0.0, step=10.0, key="mat_price")
        link = st.text_input("Link", key="mat_link")
        image_url = st.text_input("Image URL", key="mat_img")
        tags_csv = st.text_input("Tags (comma separated)", placeholder="bathroom, modern, wood", key="mat_tags")

        if st.button("Save", type="primary", disabled=(not name.strip() or not (access_token and user_id)), key="mat_save"):
            tags = [t.strip() for t in tags_csv.split(",") if t.strip()]
            add_private_material(
                access_token=access_token,
                user_id=user_id,
                payload={
                    "name": name.strip(),
                    "description": description.strip() or None,
                    "category": category.strip() or None,
                    "supplier": supplier.strip() or None,
                    "lead_time_days": int(lead_time_days) if int(lead_time_days) > 0 else None,
                    "price": float(price) if price else None,
                    "link": link.strip() or None,
                    "image_url": image_url.strip() or None,
                    "tags": tags,
                },
            )
            load_materials_cached.clear()
            search_materials_cached.clear()
            st.success("Saved to your library.")
            st.rerun()
        if not (access_token and user_id):
            st.caption("Debug mode: login is bypassed, so creating private materials is disabled.")

    with st.expander("Add from product link", expanded=False):
        source_url = st.text_input(
            "Product URL",
            key="mat_link_source_url",
            placeholder="https://example.com/product/123",
        ).strip()

        fetch_disabled = not bool(source_url)
        quick_save_disabled = fetch_disabled or not (access_token and user_id)

        col_fetch, col_quick = st.columns(2)
        if col_fetch.button("Fetch from URL", key="mat_link_fetch_btn", disabled=fetch_disabled):
            payload = extract_material_payload_from_url(source_url)
            if "error" in payload:
                st.error(payload["error"])
            else:
                st.session_state["mat_link_payload"] = payload
                st.session_state["mat_link_name"] = payload.get("name") or ""
                st.session_state["mat_link_desc"] = payload.get("description") or ""
                st.session_state["mat_link_cat"] = payload.get("category") or ""
                st.session_state["mat_link_price"] = float(payload.get("price") or 0.0)
                st.session_state["mat_link_link"] = payload.get("link") or source_url
                st.session_state["mat_link_img"] = payload.get("image_url") or ""
                st.session_state["mat_link_supplier"] = payload.get("supplier") or ""
                st.session_state["mat_link_lead_days"] = int(payload.get("lead_time_days") or 0)
                st.session_state["mat_link_tags"] = ", ".join(payload.get("tags") or [])
                st.success("Fetched product details. Review and save.")

        if col_quick.button("Fetch + Save", key="mat_link_quick_save_btn", disabled=quick_save_disabled):
            payload = extract_material_payload_from_url(source_url)
            if "error" in payload:
                st.error(payload["error"])
            else:
                add_private_material(
                    access_token=access_token,
                    user_id=user_id,
                    payload=payload,
                )
                load_materials_cached.clear()
                search_materials_cached.clear()
                st.success("Added to your private library from link.")
                st.rerun()

        fetched_payload = st.session_state.get("mat_link_payload")
        if fetched_payload:
            if (st.session_state.get("mat_link_img") or "").startswith("http"):
                st.image(st.session_state["mat_link_img"], width=260)

            st.text_input("Name", key="mat_link_name")
            st.text_area("Description", key="mat_link_desc")
            st.text_input("Category", key="mat_link_cat")
            st.text_input("Supplier / Store", key="mat_link_supplier")
            st.number_input("Lead time (days)", min_value=0, step=1, key="mat_link_lead_days")
            st.number_input("Price (THB)", min_value=0.0, step=10.0, key="mat_link_price")
            st.text_input("Source Link", key="mat_link_link")
            st.text_input("Image URL", key="mat_link_img")
            st.text_input("Tags (comma separated)", key="mat_link_tags")

            save_disabled = not (
                st.session_state.get("mat_link_name", "").strip() and access_token and user_id
            )
            if st.button("Save fetched material", type="primary", key="mat_link_save_btn", disabled=save_disabled):
                tags = [
                    t.strip()
                    for t in str(st.session_state.get("mat_link_tags") or "").split(",")
                    if t.strip()
                ]
                add_private_material(
                    access_token=access_token,
                    user_id=user_id,
                    payload={
                        "name": st.session_state.get("mat_link_name", "").strip(),
                        "description": st.session_state.get("mat_link_desc", "").strip() or None,
                        "category": st.session_state.get("mat_link_cat", "").strip() or None,
                        "supplier": st.session_state.get("mat_link_supplier", "").strip() or None,
                        "lead_time_days": int(st.session_state.get("mat_link_lead_days") or 0)
                        if int(st.session_state.get("mat_link_lead_days") or 0) > 0
                        else None,
                        "price": float(st.session_state.get("mat_link_price") or 0.0)
                        if st.session_state.get("mat_link_price")
                        else None,
                        "link": st.session_state.get("mat_link_link", "").strip() or None,
                        "image_url": st.session_state.get("mat_link_img", "").strip() or None,
                        "tags": tags,
                    },
                )
                load_materials_cached.clear()
                search_materials_cached.clear()
                st.success("Saved fetched material to your private library.")
                st.rerun()

            if not (access_token and user_id):
                st.caption("Login is required to save fetched materials.")

    q = st.text_input("Search my library", placeholder="type to filter by name/description/tags")

    rows = load_materials_cached(access_token)

    if q.strip():
        qq = q.lower()

        def hit(r):
            tags = r.get("tags") or []
            tags_text = " ".join(tags).lower() if isinstance(tags, list) else str(tags).lower()
            return (
                qq in (r.get("name") or "").lower()
                or qq in (r.get("description") or "").lower()
                or qq in tags_text
            )

        rows = [r for r in rows if hit(r)]

    st.caption(f"{len(rows)} items visible (your private + global supplier items).")

    if not rows:
        st.markdown(
            '<div class="inspire-empty">No materials yet. Start a concept board by adding your first hero material.</div>',
            unsafe_allow_html=True,
        )
    else:
        for r in rows:
            with st.container(border=True):
                st.markdown(f"**{r.get('name','')}**")
                meta_bits = []
                if r.get("category"):
                    meta_bits.append(r["category"])
                supplier_value = str(r.get("supplier") or r.get("supplier_name") or "").strip()
                if supplier_value:
                    meta_bits.append(supplier_value)
                lead_days = _safe_float(r.get("lead_time_days"))
                if lead_days is not None and lead_days > 0:
                    meta_bits.append(f"{int(lead_days)}d lead")
                if r.get("price") is not None:
                    meta_bits.append(f"{r['price']} THB")
                if r.get("visibility") == "global":
                    meta_bits.append("GLOBAL")
                if meta_bits:
                    st.caption(" | ".join(meta_bits))

                if r.get("description"):
                    st.write(r["description"])

                if r.get("link"):
                    st.write(f"[Link]({r['link']})")

                tags = r.get("tags") or []
                if isinstance(tags, list) and tags:
                    st.caption("Tags: " + ", ".join(tags))

# -----------------------------
# Page: Suggestions
# -----------------------------
elif page == "Suggestions":
    st.title("Suggestions")
    st.caption("Share feature requests and improvements directly with the app owner.")

    with st.form("suggestion_form", clear_on_submit=True):
        suggestion_title = st.text_input(
            "Title",
            placeholder="Short summary of your idea",
        )
        suggestion_category = st.selectbox(
            "Type",
            ["Feature request", "Improvement", "Bug / issue", "Other"],
            index=0,
        )
        suggestion_text = st.text_area(
            "Details",
            placeholder="Describe what you want, why it helps, and any examples.",
            height=160,
        )
        allow_contact = st.checkbox("Allow owner to contact me about this suggestion", value=True)
        submit_clicked = st.form_submit_button(
            "Send suggestion",
            type="primary",
            disabled=not (access_token and user_id),
        )

    if submit_clicked:
        clean_title = suggestion_title.strip()
        clean_text = suggestion_text.strip()
        if len(clean_title) < 4:
            st.warning("Please add a clearer title (at least 4 characters).")
        elif len(clean_text) < 12:
            st.warning("Please add more detail (at least 12 characters).")
        else:
            ok, err = _submit_app_suggestion(
                access_token=access_token,
                user_id=user_id,
                user_name=full_name,
                user_email=st.session_state.get("user_email", ""),
                title=clean_title,
                category=suggestion_category,
                suggestion_text=clean_text,
                allow_contact=allow_contact,
            )
            if ok:
                st.success("Thanks, your suggestion was sent.")
            else:
                st.error(f"Could not save suggestion: {err}")

    if not (access_token and user_id):
        st.caption("Login is required to submit suggestions.")

