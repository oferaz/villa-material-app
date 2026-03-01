# pages/Gallery.py

import streamlit as st
import pandas as pd
import pickle
import os
from ui_utils import render_product_card, apply_custom_css
from config import CATALOG_PKL, ROOM_OPTIONS

st.set_page_config(page_title="Product Gallery", layout="wide")
apply_custom_css()

st.title("🖼 Product Gallery")

# Reload button
if st.sidebar.button("🔄 Reload Catalog"):
    st.cache_data.clear()
    st.rerun()

# Load catalog
if not os.path.exists(CATALOG_PKL):
    st.error("❌ Catalog file not found.")
    st.stop()

with open(CATALOG_PKL, "rb") as f:
    df = pickle.load(f)

# Validate required columns
required_columns = ["product_name", "Rooms", "ImageFile"]
missing_cols = [col for col in required_columns if col not in df.columns]
if missing_cols:
    st.error(f"❌ Catalog is missing required fields: {', '.join(missing_cols)}")
    st.stop()

# Filter rooms (dynamic based on catalog)
room_options = sorted(df["Rooms"].dropna().apply(lambda x: x.split(",")[0] if isinstance(x, str) else "").unique())
room_options = [room for room in room_options if room]

selected_room = st.sidebar.selectbox("Filter by Room", ["All"] + room_options)
search_text = st.sidebar.text_input("Search products", placeholder="Name, description, supplier")
sort_option = st.sidebar.selectbox("Sort by", ["Name (A-Z)", "Name (Z-A)", "Price (Low-High)", "Price (High-Low)"])

# Filter products
if selected_room != "All":
    filtered_df = df[df["Rooms"].str.contains(selected_room, case=False, na=False)]
else:
    filtered_df = df.copy()

if search_text.strip():
    q = search_text.strip().lower()
    filtered_df = filtered_df[
        filtered_df.apply(
            lambda row: q in str(row.get("product_name", "")).lower()
            or q in str(row.get("Description", "")).lower()
            or q in str(row.get("Supplier", "")).lower(),
            axis=1,
        )
    ]

if sort_option == "Name (A-Z)":
    filtered_df = filtered_df.sort_values(by="product_name", ascending=True, na_position="last")
elif sort_option == "Name (Z-A)":
    filtered_df = filtered_df.sort_values(by="product_name", ascending=False, na_position="last")
elif "Price" in filtered_df.columns:
    filtered_df = filtered_df.assign(__price_sort=pd.to_numeric(filtered_df["Price"], errors="coerce")).sort_values(
        by="__price_sort",
        ascending=(sort_option == "Price (Low-High)"),
        na_position="last",
    ).drop(columns=["__price_sort"])

st.markdown(f"🧮 Showing **{len(filtered_df)}** product(s) in '{selected_room}'")

# Show gallery
if filtered_df.empty:
    st.warning("No products found for this room.")
else:
    for i, (_, row) in enumerate(filtered_df.iterrows()):
        with st.container():
            render_product_card(row, i=i, room_options=ROOM_OPTIONS)
