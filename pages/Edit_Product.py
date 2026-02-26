import streamlit as st
import pickle
import os
from embedding import get_embedder
from ui_utils import render_edit_product_form
from config import CATALOG_PKL, CSV_LOG, VERSION_DIR, MODEL_PATH

st.set_page_config(page_title="Edit Product")

# Load catalog
if not os.path.exists(CATALOG_PKL):
    st.error("Catalog file not found.")
    st.stop()

with open(CATALOG_PKL, "rb") as f:
    df = pickle.load(f)

# Load model
model = get_embedder()

# Call the form function
render_edit_product_form(df, model, CATALOG_PKL, CSV_LOG, VERSION_DIR)
