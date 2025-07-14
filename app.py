import os
import streamlit as st
import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer, util
import urllib.parse
from ui_utils import inject_custom_css, apply_custom_css, render_product_card, set_background_image
from config import CATALOG_PKL, MODEL_PATH, ROOM_OPTIONS
from project_manager import load_projects, create_project, update_current_cart, get_current_cart


# --- Setup page ---
st.set_page_config(page_title="Villa Material Search", layout="wide")
st.markdown(
    """
    <link rel="shortcut icon" href="assets/favicon.ico">
    """,
    unsafe_allow_html=True,
)
inject_custom_css()
apply_custom_css()

set_background_image()
# --- Project Management ---
projects = load_projects()
if "current_project" not in st.session_state:
    st.session_state.current_project = projects[0]["name"] if projects else None
    st.session_state.cart = get_current_cart(projects, st.session_state.current_project)

st.sidebar.markdown("### 🗂️ Project")
project_names = [p["name"] for p in projects]
selected = st.sidebar.selectbox("Select Project", project_names, index=project_names.index(st.session_state.current_project) if st.session_state.current_project in project_names else 0)

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
        count = st.number_input(f"{room}", min_value=0, max_value=10, value=0, step=1, key=f"{room}_count")
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
            projects = create_project(name_clean, all_rooms)
            if any(p["name"].strip().lower() == name_clean.lower() for p in projects):
                st.session_state.current_project = name_clean
                st.session_state.cart = get_current_cart(projects, name_clean)
                st.rerun()




# --- Session state ---
if "cart" not in st.session_state:
    st.session_state.cart = []
if "show_cart" not in st.session_state:
    st.session_state.show_cart = False

# --- Load Model & Data ---
@st.cache_resource
def load_model():
    return SentenceTransformer(MODEL_PATH, device="cpu")

@st.cache_data
def load_data():
    if os.path.exists(CATALOG_PKL):
        df = pd.read_pickle(CATALOG_PKL)
    else:
        df = pd.DataFrame()  # Start with empty catalog
    df["embedding"] = df["embedding"].apply(np.array)
    return df

model = load_model()
df = load_data()
embeddings = np.vstack(df["embedding"].values)

# --- Title ---
st.title("🏡 Find the Right Materials for Every Room - Powered by Materia")

if st.button("🔄 Refresh Product Catalog"):
    st.cache_data.clear()
    st.rerun()

with st.sidebar:
    st.markdown("### 🔧 Tools")
    if st.button("🔄 Re-index Catalog"):
        st.switch_page("pages/Reindex_Catalog.py")

# --- Toggle Cart ---
if st.button("🛍️ View My Cart"):
    st.session_state.show_cart = not st.session_state.show_cart

# --- Search Input ---
query = st.text_input("What material or item are you looking for?", placeholder="e.g. light wood bench for outdoor")

# --- Search Logic ---
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

# --- Cart Section ---
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
                    if isinstance(item['link'], str) and item['link'].startswith("http"):
                        st.write(f"[Product Link]({item['link']})")
                    if isinstance(item['supplier'], str) and item['supplier'].startswith("+66"):
                        msg = f"Hi, I'm interested in your product: {item['name']} from the Villa Builder app."
                        wa_url = f"https://wa.me/{item['supplier'].replace('+', '')}?text={urllib.parse.quote(msg)}"
                        st.write(f"[ WhatsApp Supplier]({wa_url})")
                with col2:
                    if st.button("❌ Remove", key=f"remove_{room}_{idx}"):
                        st.session_state.cart.pop(idx)
                        update_current_cart(st.session_state.current_project, st.session_state.cart)
                        st.rerun()

        # Grand total
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
