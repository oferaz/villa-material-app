# app.py

import os
import streamlit as st
import pandas as pd
import numpy as np
from sentence_transformers import util

from ui_utils import inject_custom_css, apply_custom_css, render_product_card, set_background_image
from config import CATALOG_PKL
from embedding import get_embedder

# Auth + Supabase
from auth_ui import require_login
from profiles_manager import get_profile
from supabase_client import get_supabase

# Supabase-backed managers
from materials_manager import list_materials, add_private_material
from project_manager import (
    load_projects,
    create_project,
    load_project_rooms,
    load_room_objects,
    load_projects_statuses,
    load_room_statuses,
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

# -----------------------------
# Require login (critical for RLS auth.uid())
# -----------------------------
require_login()

access_token = st.session_state.get("sb_access_token")
user_id = st.session_state.get("user_id")

profile = get_profile(access_token, user_id) if (access_token and user_id) else {}
full_name = profile.get("full_name") or (
    st.session_state.user_email.split("@")[0] if st.session_state.get("user_email") else "User"
)

# -----------------------------
# Sidebar: user area (name + logout + profile editor)
# -----------------------------
st.sidebar.markdown("---")
st.sidebar.markdown(f"👤 Logged in as: **{full_name}**")

if st.sidebar.button("🚪 Logout"):
    for k in ["sb_access_token", "user_id", "user_email", "pending_email", "current_project_id", "current_room_id", "current_object_id"]:
        st.session_state.pop(k, None)
    st.rerun()

with st.sidebar.expander("👤 Profile", expanded=False):
    new_name = st.text_input("Display name", value=full_name, key="profile_display_name")
    if st.button("Save name", key="save_profile_btn", disabled=not (access_token and user_id)):
        sb = get_supabase(access_token)
        sb.table("profiles").update({"full_name": new_name.strip()}).eq("id", user_id).execute()
        st.success("Saved.")
        st.rerun()

# -----------------------------
# Main: welcome message
# -----------------------------
st.markdown(
    f"""
    <div class="welcome-box">
        <h2>👋 Welcome back, {full_name}</h2>
        <p>Pick a project to work on, or manage your materials library.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

# -----------------------------
# Sidebar Navigation
# -----------------------------
st.sidebar.markdown("### 🧭 Navigation")
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

# -----------------------------
# Page: Projects
# -----------------------------
if page == "Projects":
    st.subheader("🗂️ Projects")

    projects = load_projects()
    project_statuses = load_projects_statuses([p["id"] for p in projects]) if projects else {}

    # Sidebar: Create project (simple + works)
    with st.sidebar.expander("➕ Create New Project", expanded=False):
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

        if st.button("✅ Create", type="primary", key="create_project_btn"):
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
            st.markdown(f"### 📌 {proj.get('name','Project')}")

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

            st.markdown("#### Overall progress")
            st.progress((assigned / total) if total else 0.0)
            st.caption(f"Designer approved: {designer_ok}/{total} • Client approved: {client_ok}/{total}")

            st.markdown("---")
            st.markdown("#### Rooms")

            rooms = load_project_rooms(pid)
            room_statuses = load_room_statuses([r["id"] for r in rooms]) if rooms else {}
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
                    st.markdown(f"### 🧩 Room: {room.get('name') if room else ''}")

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
                                    st.write("✅" if o.get("material_id") else "—")
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
                        st.markdown(f"### 🔧 Edit: {obj.get('object_name')}")

                        material_options = []
                        material_labels = {}
                        material_error = None
                        if access_token:
                            try:
                                material_options = load_materials_cached(access_token)
                            except Exception as e:
                                material_error = str(e)

                        current_material_id = str(obj.get("material_id")) if obj.get("material_id") else None

                        select_options = [None]
                        for m in material_options:
                            mid = str(m.get("id"))
                            if not mid:
                                continue
                            select_options.append(mid)
                            name = m.get("name") or "Unnamed material"
                            category = m.get("category") or "Uncategorized"
                            material_labels[mid] = f"{name} ({category})"

                        if current_material_id and current_material_id not in material_labels:
                            material_labels[current_material_id] = f"Current material ({current_material_id[:8]})"
                            select_options.append(current_material_id)

                        selected_index = select_options.index(current_material_id) if current_material_id in select_options else 0
                        selected_material_id = st.selectbox(
                            "Material",
                            options=select_options,
                            index=selected_index,
                            format_func=lambda x: "None" if x is None else material_labels.get(x, x),
                            key=f"obj_material_select_{oid}",
                        )

                        if material_error:
                            st.warning(f"Could not load materials: {material_error}")
                        elif not material_options:
                            st.info("No materials available. Add materials in 'My Materials' first.")

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
                        with col_d:
                            if st.button("Close", key="close_obj_editor"):
                                st.session_state.current_object_id = None
                                st.rerun()

# -----------------------------
# Page: Search Catalog
# -----------------------------
elif page == "Search Catalog":
    st.title("🔎 Search Catalog")

    if st.button("🔄 Refresh Product Catalog"):
        st.cache_data.clear()
        st.rerun()

    if embeddings is None or df.empty:
        st.warning("Catalog is empty or embeddings are missing. Add products or re-index the catalog.")
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
    st.title("📚 My Materials Library")

    with st.expander("➕ Add material", expanded=False):
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
            st.success("Saved to your library.")
            st.rerun()
        if not (access_token and user_id):
            st.caption("Debug mode: login is bypassed, so creating private materials is disabled.")

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
