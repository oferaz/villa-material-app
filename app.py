# app.py

import os
import streamlit as st
import pandas as pd
import numpy as np
import urllib.parse
from sentence_transformers import util

from ui_utils import inject_custom_css, apply_custom_css, render_product_card, set_background_image
from config import CATALOG_PKL, MODEL_PATH, ROOM_OPTIONS
from project_manager import load_projects, create_project, update_current_cart, get_current_cart
from embedding import get_embedder

# NEW: auth + supabase materials
from auth_ui import require_login, sidebar_logout
from materials_manager import list_materials, add_private_material
from profiles_manager import get_profile
from supabase_client import get_supabase

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

access_token = st.session_state.sb_access_token
user_id = st.session_state.user_id

profile = get_profile(access_token, user_id) or {}
full_name = profile.get("full_name") or (
    st.session_state.user_email.split("@")[0] if st.session_state.get("user_email") else "User"
)

# -----------------------------
# Sidebar: user area (name + logout + profile editor)
# -----------------------------
st.sidebar.markdown("---")
st.sidebar.markdown(f"👤 Logged in as: **{full_name}**")

if st.sidebar.button("🚪 Logout"):
    for k in ["sb_access_token", "user_id", "user_email", "pending_email"]:
        st.session_state.pop(k, None)
    st.rerun()

with st.sidebar.expander("👤 Profile", expanded=False):
    new_name = st.text_input("Display name", value=full_name, key="profile_display_name")
    if st.button("Save name", key="save_profile_btn"):
        sb = get_supabase(access_token)
        sb.table("profiles").update({"full_name": new_name.strip()}).eq("id", user_id).execute()
        st.success("Saved.")
        st.rerun()

# -----------------------------
# Main: welcome message
# -----------------------------
st.markdown(f"""
<div class="welcome-box">
    <h2>👋 Welcome back, {full_name}</h2>
    <p>Pick a project to work on, or manage your materials library.</p>
</div>
""", unsafe_allow_html=True)

# -----------------------------
# Sidebar Navigation
# -----------------------------
st.sidebar.markdown("### 🧭 Navigation")
page = st.sidebar.radio("", ["Projects", "Search Catalog", "My Materials"], label_visibility="collapsed")

# -----------------------------
# Project Management (kept as-is for now)
# (Later we migrate projects to Supabase with owner_id + RLS)
# -----------------------------
if "projects" not in st.session_state:
    st.session_state.projects = load_projects()

projects = st.session_state.projects

if "current_project" not in st.session_state:
    st.session_state.current_project = projects[0]["name"] if projects else None
    st.session_state.cart = get_current_cart(projects, st.session_state.current_project) if projects else []

if "cart" not in st.session_state:
    st.session_state.cart = []

if "show_cart" not in st.session_state:
    st.session_state.show_cart = False


def render_project_sidebar():
    st.sidebar.markdown("### 🗂️ Project")

    if not projects:
        st.sidebar.info("No projects yet. Create one below.")
        project_names = []
    else:
        project_names = [p["name"] for p in projects]

    if project_names:
        selected = st.sidebar.selectbox(
            "Select Project",
            project_names,
            index=project_names.index(st.session_state.current_project)
            if st.session_state.current_project in project_names
            else 0
        )
        if selected != st.session_state.current_project:
            st.session_state.current_project = selected
            st.session_state.cart = get_current_cart(projects, selected)

    with st.sidebar.expander("➕ Create New Project", expanded=False):
        new_proj = st.text_input("Project Name")

        predefined = [
            "Living Room", "Kitchen", "Dining Room", "Bedroom", "Master Bedroom", "Guest Bedroom",
            "Bathroom", "Guest Bathroom", "Outdoor", "Garden", "Terrace", "Balcony", "Pool Area",
            "Entrance", "Walk-in Closet", "Pantry", "Laundry Room", "Garage", "Storage Room",
            "Office / Study", "Kids Room", "Play Area", "Hallway"
        ]

        room_counts = {}
        st.markdown("#### Select Predefined Rooms")
        for room in predefined:
            count = st.number_input(
                f"{room}",
                min_value=0,
                max_value=10,
                value=0,
                step=1,
                key=f"{room}_count"
            )
            if count > 0:
                room_counts[room] = count

        custom_rooms = st.text_input("Add Custom Rooms (comma-separated)", "")

        if st.button("✅ Create Project"):
            all_rooms = []
            for room, count in room_counts.items():
                for i in range(count):
                    label = f"{room} {i+1}" if count > 1 else room
                    all_rooms.append(label)

            custom_split = [r.strip() for r in custom_rooms.split(",") if r.strip()]
            all_rooms.extend(custom_split)

            name_clean = new_proj.strip()
            if not name_clean:
                st.warning("⚠️ Please enter a project name.")
            else:
                updated_projects = create_project(name_clean, all_rooms)
                # reload local cache
                st.session_state.projects = updated_projects
                if any(p["name"].strip().lower() == name_clean.lower() for p in projects):
                    st.session_state.current_project = name_clean
                    st.session_state.cart = get_current_cart(projects, name_clean)
                    st.rerun()

    with st.sidebar:
        st.markdown("### 🔧 Tools")
        if st.button("🔄 Re-index Catalog"):
            st.switch_page("pages/Reindex_Catalog.py")
        if st.button("🔗 Add Product from Link"):
            st.switch_page("pages/Add_From_Link.py")


render_project_sidebar()

# -----------------------------
# Load Model & Data (Catalog search)
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
if df.empty:
    embeddings = None
else:
    # Guard: vstack fails if embeddings column missing/empty
    if "embedding" not in df.columns or df["embedding"].isna().all():
        embeddings = None
    else:
        embeddings = np.vstack(df["embedding"].values)


# -----------------------------
# Page: Projects
# -----------------------------
if page == "Projects":
    st.title("🗂️ Projects")

    if not projects:
        st.info("Create your first project from the sidebar.")
    else:
        st.write("Select a project from the sidebar to work on it.")
        st.markdown("#### Your Projects")
        for p in projects:
            with st.container(border=True):
                st.markdown(f"**{p.get('name','')}**")
                rooms = p.get("rooms", [])
                st.caption(f"Rooms: {len(rooms)}")

    st.markdown("---")
    st.subheader("🛍️ Cart (Current Project)")
    if not st.session_state.current_project:
        st.info("Select or create a project to see its cart.")
    else:
        if st.button("🛍️ View My Cart"):
            st.session_state.show_cart = not st.session_state.show_cart

        # Cart Section (same logic as before)
        if st.session_state.show_cart:
            if st.button("🩹 Clear Entire Cart"):
                st.session_state.cart = []
                update_current_cart(st.session_state.current_project, st.session_state.cart)
                st.rerun()

            if st.session_state.cart:
                st.subheader("📟 Cart Summary by Room")
                cart_df = pd.DataFrame(st.session_state.cart)
                cart_df["total"] = cart_df["price"] * cart_df["quantity"]
                grouped = cart_df.groupby("room")

                for room, items in grouped:
                    st.markdown(f"### 📍 {room}")
                    for idx in items.index:
                        item = cart_df.loc[idx]
                        col1, col2 = st.columns([6, 1])
                        with col1:
                            st.write(f"• **{item['name']}** — {item['quantity']} × {item['price']} = {item['total']} THB")
                            if isinstance(item.get('link'), str) and item['link'].startswith("http"):
                                st.write(f"[Product Link]({item['link']})")
                            if isinstance(item.get('supplier'), str) and item['supplier'].startswith("+66"):
                                msg = f"Hi, I'm interested in your product: {item['name']} from the Materia app."
                                wa_url = f"https://wa.me/{item['supplier'].replace('+', '')}?text={urllib.parse.quote(msg)}"
                                st.write(f"[ WhatsApp Supplier]({wa_url})")

                        with col2:
                            if st.button("❌ Remove", key=f"remove_{room}_{idx}"):
                                st.session_state.cart.pop(idx)
                                update_current_cart(st.session_state.current_project, st.session_state.cart)
                                st.rerun()

                grand_total = cart_df["total"].sum()
                st.success(f"💰 **Total Cart Value: {grand_total} THB**")

                totals_by_room = cart_df.groupby("room")["total"].sum().reset_index()
                st.bar_chart(totals_by_room.rename(columns={"room": "index"}).set_index("index"))

                st.download_button(
                    label="Download Cart as CSV",
                    data=cart_df.to_csv(index=False).encode("utf-8"),
                    file_name="villa_cart.csv",
                    mime="text/csv"
                )
            else:
                st.info("Your cart is currently empty.")


# -----------------------------
# Page: Search Catalog (your existing search UI)
# -----------------------------
elif page == "Search Catalog":
    st.title("🏡 Find the Right Materials for Every Room - Powered by Materia")

    if st.button("🔄 Refresh Product Catalog"):
        st.cache_data.clear()
        st.rerun()

    if embeddings is None or df.empty:
        st.warning("Catalog is empty or embeddings are missing. Add products or re-index the catalog.")
    else:
        query = st.text_input(
            "What material or item are you looking for?",
            placeholder="e.g. light wood bench for outdoor"
        )

        if query:
            query_vec = model.encode(query, convert_to_numpy=True)
            scores = util.cos_sim(query_vec, embeddings)[0]
            top_k_idx = np.argsort(-scores)[:5]
            results = df.iloc[top_k_idx]

            project = next((p for p in projects if p["name"] == st.session_state.current_project), None)
            project_rooms = project.get("rooms", []) if project else []

            for i, (_, row) in enumerate(results.iterrows()):
                render_product_card(row, i, project_rooms)
                st.markdown('</div>', unsafe_allow_html=True)

            st.markdown("---")

    # Cart toggle (kept available here too)
    if st.button("🛍️ View My Cart"):
        st.session_state.show_cart = not st.session_state.show_cart

    if st.session_state.show_cart:
        st.subheader("📟 Cart Summary by Room")
        if not st.session_state.cart:
            st.info("Your cart is currently empty.")
        else:
            cart_df = pd.DataFrame(st.session_state.cart)
            cart_df["total"] = cart_df["price"] * cart_df["quantity"]
            grouped = cart_df.groupby("room")

            for room, items in grouped:
                st.markdown(f"### 📍 {room}")
                for idx in items.index:
                    item = cart_df.loc[idx]
                    col1, col2 = st.columns([6, 1])
                    with col1:
                        st.write(f"• **{item['name']}** — {item['quantity']} × {item['price']} = {item['total']} THB")
                        if isinstance(item.get('link'), str) and item['link'].startswith("http"):
                            st.write(f"[Product Link]({item['link']})")
                        if isinstance(item.get('supplier'), str) and item['supplier'].startswith("+66"):
                            msg = f"Hi, I'm interested in your product: {item['name']} from the Materia app."
                            wa_url = f"https://wa.me/{item['supplier'].replace('+', '')}?text={urllib.parse.quote(msg)}"
                            st.write(f"[ WhatsApp Supplier]({wa_url})")
                    with col2:
                        if st.button("❌ Remove", key=f"remove_search_{room}_{idx}"):
                            st.session_state.cart.pop(idx)
                            update_current_cart(st.session_state.current_project, st.session_state.cart)
                            st.rerun()

            grand_total = cart_df["total"].sum()
            st.success(f"💰 **Total Cart Value: {grand_total} THB**")


# -----------------------------
# Page: My Materials (Supabase-backed, RLS protected)
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

        if st.button("Save", type="primary", disabled=not name.strip(), key="mat_save"):
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
                    "tags": tags,  # jsonb list
                },
            )
            st.success("Saved to your library.")
            st.rerun()

    q = st.text_input("Search my library", placeholder="type to filter by name/description/tags")

    try:
        rows = list_materials(access_token)
    except Exception as e:
        st.error(f"❌ Failed to load materials: {e}")
        st.stop()

    # Client-side filter (simple + fast for MVP)
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