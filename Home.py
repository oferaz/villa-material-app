import os
import streamlit as st
import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer, util
import urllib.parse
from ui_utils import inject_custom_css, apply_custom_css, render_product_card

# --- Setup page ---
st.set_page_config(page_title="Villa Material Search", layout="wide")

inject_custom_css()

apply_custom_css()

st.markdown(
    """
    <style>
    .stApp {
        background-image: url("https://images.unsplash.com/photo-1507525428034-b723cf961d3e");
        background-size: cover;
        background-position: center;
        background-attachment: fixed;
    }

    .main > div {
        background-color: rgba(255, 255, 255, 0.85);
        padding: 1rem;
        border-radius: 10px;
    }
    </style>
    """,
    unsafe_allow_html=True
)

# --- Constants ---
MAIN_CATALOG = "product_catalog_with_embeddings.pkl"
room_options = ["Living Room", "Bedroom", "Master Bedroom", "Bathroom", "Kitchen", "Outdoor", "Dining Room"]

# --- Session state ---
if "cart" not in st.session_state:
    st.session_state.cart = []
if "show_cart" not in st.session_state:
    st.session_state.show_cart = False

# --- Load Model & Data ---
@st.cache_resource
def load_model():
    return SentenceTransformer("/home/ofer/LLM/models/all-MiniLM-L6-v2", device="cpu")

@st.cache_data
def load_data():
    if os.path.exists(MAIN_CATALOG):
        df = pd.read_pickle(MAIN_CATALOG)
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

    for i, (_, row) in enumerate(results.iterrows()):
        render_product_card(row, i, room_options)
        st.markdown('</div>', unsafe_allow_html=True)
    st.markdown("---")


# --- Cart Section ---
if st.session_state.show_cart:
    if st.button("🩹 Clear Entire Cart"):
        st.session_state.cart = []
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
                        st.rerun()

        # Grand total
        grand_total = cart_df["total"].sum()
        st.success(f"💰 **Total Cart Value: {grand_total} THB**")

        # Bar chart
        totals_by_room = cart_df.groupby("room")["total"].sum().reset_index()
        st.bar_chart(totals_by_room.rename(columns={"room": "index"}).set_index("index"))

        # CSV export
        st.download_button(
            label="Download Cart as CSV",
            data=cart_df.to_csv(index=False).encode("utf-8"),
            file_name="villa_cart.csv",
            mime="text/csv"
        )
    else:
        st.info("Your cart is currently empty.")
