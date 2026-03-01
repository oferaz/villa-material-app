# app.py

import os
from datetime import datetime, timezone
import streamlit as st
import pandas as pd
import numpy as np
from sentence_transformers import util

from ui_utils import inject_custom_css, apply_custom_css, render_product_card, set_background_image
from config import CATALOG_PKL
from embedding import get_embedder

# Auth + Supabase
from auth_ui import require_login, clear_auth_state
from profiles_manager import get_profile
from supabase_client import get_supabase

# Supabase-backed managers
from materials_manager import list_materials, add_private_material, search_materials_semantic
from link_scraper import extract_material_payload_from_url
from project_manager import (
    load_projects,
    create_project,
    load_project_rooms,
    load_room_objects,
    load_room_objects_batch,
    load_projects_statuses,
    load_room_statuses,
    get_project_budget_from_row,
    save_project_budget,
    get_project_share_from_row,
    rotate_project_share_token,
    set_project_share_enabled,
    get_object_comments_from_row,
    get_object_approval_history_from_row,
    append_object_comment,
    get_shared_project_by_token,
    update_object_status_by_share_token,
    update_room_status_by_share_token,
    append_object_comment_by_share_token,
)

# -----------------------------
# Page setup
# -----------------------------
st.set_page_config(page_title="Materia", layout="wide")
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
            f"{room_name} • {stats['client_ok']}/{stats['total']} approved • {stats['assigned']}/{stats['total']} assigned",
            expanded=False,
        ):
            room_info = f"Estimated spend: {room_spend:,.0f} THB"
            if room_budget is not None:
                room_info += f" • Budget: {float(room_budget):,.0f} THB"
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
                        st.caption(f"Category: {obj.get('category') or '-'} • Qty: {obj.get('qty') or 1}")
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

# -----------------------------
# Sidebar: user area (name + logout + profile editor)
# -----------------------------
st.sidebar.markdown("---")
st.sidebar.markdown(f"Logged in as: **{full_name}**")

if st.sidebar.button("Logout"):
    clear_auth_state([
        "current_project_id",
        "current_room_id",
        "current_object_id",
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
        <p>Pick a project to work on, or manage your materials library.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

# -----------------------------
# Sidebar Navigation
# -----------------------------
st.sidebar.markdown("### Navigation")
page = st.sidebar.radio("", ["Projects", "Search Catalog", "My Materials"], label_visibility="collapsed")

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
def search_materials_cached(token: str | None, query: str, limit: int = 20):
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
if page == "Projects":
    st.subheader("Projects")

    projects = load_projects()
    project_statuses = load_projects_statuses([p["id"] for p in projects]) if projects else {}

    # Sidebar: Create project (simple + works)
    with st.sidebar.expander("Create New Project", expanded=False):
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
                st.warning("⚠️ Please enter a project name.")
            else:
                create_project(new_proj.strip(), all_rooms)
                st.rerun()

    # pick selected project (by id)
    if "current_project_id" not in st.session_state:
        st.session_state.current_project_id = projects[0]["id"] if projects else None

    left, right = st.columns([0.35, 0.65], gap="large")

    with left:
        st.markdown("#### Your projects")

        if not projects:
            st.info("No projects yet. Create one from the sidebar.")
        else:
            q = st.text_input("Filter projects", placeholder="type to filter…", key="proj_filter")
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
                        st.caption(f"{ps['rooms']} rooms • {assigned}/{total} assigned • {client_ok}/{total} client approved")
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
            st.info("Select a project on the left.")
        else:
            proj = next((x for x in projects if str(x["id"]) == str(pid)), None)
            share_meta = get_project_share_from_row(proj)
            share_token_value = share_meta.get("token")
            share_enabled = bool(share_meta.get("enabled"))
            share_link = _build_share_url(share_token_value) if share_token_value else ""

            with st.expander("Customer link", expanded=False):
                st.caption("Send this link to your customer so they can review only this project.")

                controls = st.columns(3)
                with controls[0]:
                    if st.button("Generate link", key=f"share_generate_{pid}", type="primary"):
                        new_token = rotate_project_share_token(pid)
                        if new_token:
                            st.success("Customer link generated.")
                            st.rerun()
                with controls[1]:
                    enable_value = st.checkbox(
                        "Link enabled",
                        value=share_enabled,
                        key=f"share_enabled_{pid}",
                        disabled=not bool(share_token_value),
                    )
                    if share_token_value and enable_value != share_enabled:
                        if set_project_share_enabled(pid, enable_value):
                            st.success("Share link status updated.")
                            st.rerun()
                with controls[2]:
                    if st.button("Rotate token", key=f"share_rotate_{pid}", disabled=not bool(share_token_value)):
                        new_token = rotate_project_share_token(pid)
                        if new_token:
                            st.success("Customer link rotated.")
                            st.rerun()

                if share_link:
                    st.text_input("Share URL", value=share_link, key=f"share_url_{pid}", disabled=True)
                    if share_link.startswith("?share="):
                        st.caption("Set PUBLIC_APP_URL in secrets/env to generate a full absolute URL.")
                else:
                    st.info("No customer link yet. Click 'Generate link'.")
            st.markdown(f"### {proj.get('name','Project')}")

            ps = project_statuses.get(
                str(pid), {"rooms": 0, "total": 0, "assigned": 0, "designer_ok": 0, "client_ok": 0}
            )
            total = ps["total"]
            assigned = ps["assigned"]
            designer_ok = ps["designer_ok"]
            client_ok = ps["client_ok"]

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

            materials_rows = load_materials_cached(access_token) if access_token else []
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

            st.markdown("#### Overall progress")
            st.progress((assigned / total) if total else 0.0)
            st.caption(f"Designer approved: {designer_ok}/{total} • Client approved: {client_ok}/{total}")

            st.markdown("---")
            st.markdown("#### Budget")

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

            st.markdown("---")
            st.markdown("#### Client feedback")
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
                st.caption("No client activity yet.")
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
            st.markdown("#### Rooms")

            if not rooms:
                st.info("No rooms in this project yet.")
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
                            st.caption(f"{ra}/{rt} assigned • {rc}/{rt} client ok")
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

                            if st.button("Open room", key=f"open_room_{rid}"):
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
                        st.info("No objects in this room.")
                    else:
                        for o in objs:
                            oid = o["id"]
                            with st.container(border=True):
                                col1, col2, col3, col4 = st.columns([3, 1, 1, 1])
                                with col1:
                                    st.markdown(f"**{o.get('object_name')}**")
                                    st.caption(f"Category: {o.get('category')} • Qty: {o.get('qty')}")
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
                if st.session_state.get("current_object_id"):
                    st.markdown("---")
                    oid = st.session_state.current_object_id
                    obj = next((x for x in objs if str(x["id"]) == str(oid)), None)

                    if not st.session_state.get("current_room_id"):
                        st.info("Select a room first.")
                    elif not obj:
                        st.info("Object not found in current room (maybe room changed).")
                    else:
                        st.markdown(f"### Edit: {obj.get('object_name')}")

                        material_options = []
                        material_labels = {}
                        material_rows = {}
                        material_error = None

                        query_key = f"obj_material_query_{oid}"
                        if query_key not in st.session_state:
                            st.session_state[query_key] = obj.get("object_name") or ""

                        query_text = st.text_input(
                            "Find material (semantic DB search)",
                            key=query_key,
                            placeholder="Type what this object should be made of",
                        )

                        if access_token and query_text.strip():
                            try:
                                material_options = search_materials_cached(access_token, query_text.strip(), limit=20)
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
                        pending_select_key = f"obj_material_select_pending_{oid}"

                        pending_material_id = st.session_state.pop(pending_select_key, None)
                        if pending_material_id in select_options:
                            st.session_state[select_key] = pending_material_id

                        if select_key not in st.session_state:
                            st.session_state[select_key] = current_material_id if current_material_id in select_options else None
                        elif st.session_state[select_key] not in select_options:
                            st.session_state[select_key] = current_material_id if current_material_id in select_options else None

                        selected_material_id = st.selectbox(
                            "Matched materials",
                            options=select_options,
                            format_func=lambda x: "None" if x is None else material_labels.get(x, x),
                            key=select_key,
                        )

                        if material_error:
                            st.warning(f"Could not search materials: {material_error}")
                        elif not query_text.strip():
                            st.caption("Search is prefilled with object name. Update it to refine.")
                        elif not material_options:
                            st.info("No results found. Try a broader search phrase.")

                        show_preview = st.checkbox(
                            "Show image previews",
                            value=False,
                            key=f"obj_show_material_images_{oid}",
                        )
                        if show_preview:
                            selected_row = material_rows.get(str(selected_material_id)) if selected_material_id else None
                            if selected_row:
                                image_url = selected_row.get("image_url")
                                if image_url:
                                    st.image(
                                        image_url,
                                        width=260,
                                        caption=f"Selected: {selected_row.get('name') or 'Material'}",
                                    )
                                else:
                                    st.caption("Selected material has no image.")

                            preview_rows = material_options[:6]
                            if preview_rows:
                                st.caption("Top semantic matches")
                                cols = st.columns(3)
                                for i, m in enumerate(preview_rows):
                                    with cols[i % 3]:
                                        title = m.get("name") or "Unnamed material"
                                        mid = str(m.get("id")) if m.get("id") is not None else None
                                        img = m.get("image_url")
                                        if img:
                                            st.image(img, use_container_width=True, caption=title)
                                        else:
                                            st.caption(f"{title} (no image)")
                                        if mid:
                                            if st.button("Select", key=f"obj_pick_mat_{oid}_{mid}"):
                                                st.session_state[pending_select_key] = mid
                                                st.rerun()
                                            if str(selected_material_id) == mid:
                                                st.caption("Selected")

                        status_options = ["unassigned", "selected", "designer_approved", "client_approved"]
                        current_status = obj.get("status") or "unassigned"
                        if current_status not in status_options:
                            current_status = "unassigned"

                        new_status = st.selectbox(
                            "Status",
                            status_options,
                            index=status_options.index(current_status),
                            key="obj_status_select",
                        )

                        col_a, col_b, col_c, col_d = st.columns([1, 1, 1, 1])
                        with col_a:
                            if st.button("Save Status", type="primary", key="save_obj_status"):
                                sb = get_supabase(access_token)
                                sb.table("room_objects").update({"status": new_status}).eq("id", oid).execute()
                                st.success("Status updated.")
                                st.rerun()
                        with col_b:
                            assign_disabled = not (access_token and selected_material_id)
                            if st.button("Assign Material", key="assign_obj_material", disabled=assign_disabled):
                                sb = get_supabase(access_token)
                                update_payload = {"material_id": selected_material_id}
                                if (obj.get("status") or "unassigned") == "unassigned":
                                    update_payload["status"] = "selected"
                                sb.table("room_objects").update(update_payload).eq("id", oid).execute()
                                st.success("Material assigned.")
                                st.rerun()
                        with col_c:
                            if st.button("Clear Material", key="clear_obj_material"):
                                sb = get_supabase(access_token)
                                sb.table("room_objects").update({"material_id": None, "status": "unassigned"}).eq("id", oid).execute()
                                st.success("Cleared.")
                                st.rerun()

                        st.markdown("#### Object comments")
                        comments = get_object_comments_from_row(proj, oid)
                        if comments:
                            for row in comments[-10:]:
                                author = row.get("author_name") or "Unknown"
                                role = row.get("author_role") or "user"
                                text = row.get("comment") or ""
                                st.write(f"- {author} ({role}): {text}")
                        else:
                            st.caption("No comments yet.")

                        st.markdown("#### Approval history")
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
                            st.caption("No approval history yet.")

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
                        with col_d:
                            if st.button("Close", key="close_obj_editor"):
                                st.session_state.current_object_id = None
                                st.rerun()

# -----------------------------
# Page: Search Catalog
# -----------------------------
elif page == "Search Catalog":
    st.title("Search Catalog")

    if st.button("Refresh Product Catalog"):
        st.cache_data.clear()
        st.rerun()

    if embeddings is None or df.empty:
        st.warning("Catalog is empty or embeddings are missing. Add products and refresh the catalog.")
    else:
        query = st.text_input("What material or item are you looking for?", placeholder="e.g. light wood bench for outdoor")
        if query:
            query_vec = model.encode(query, convert_to_numpy=True)
            scores = util.cos_sim(query_vec, embeddings)[0]
            top_k_idx = np.argsort(-scores)[:10]
            results = df.iloc[top_k_idx]

            for i, (_, row) in enumerate(results.iterrows()):
                render_product_card(row, i, project_rooms=[])
                st.markdown("</div>", unsafe_allow_html=True)

# -----------------------------
# Page: My Materials
# -----------------------------
elif page == "My Materials":
    st.title("My Materials Library")

    with st.expander("Add material", expanded=False):
        name = st.text_input("Name", key="mat_name")
        description = st.text_area("Description", key="mat_desc")
        category = st.text_input("Category", key="mat_cat")
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
        st.info("No materials yet.")
    else:
        for r in rows:
            with st.container(border=True):
                st.markdown(f"**{r.get('name','')}**")
                meta_bits = []
                if r.get("category"):
                    meta_bits.append(r["category"])
                if r.get("price") is not None:
                    meta_bits.append(f"{r['price']} THB")
                if r.get("visibility") == "global":
                    meta_bits.append("GLOBAL")
                if meta_bits:
                    st.caption(" • ".join(meta_bits))

                if r.get("description"):
                    st.write(r["description"])

                if r.get("link"):
                    st.write(f"[Link]({r['link']})")

                tags = r.get("tags") or []
                if isinstance(tags, list) and tags:
                    st.caption("Tags: " + ", ".join(tags))
