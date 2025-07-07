import streamlit as st
import pickle
import os
from sentence_transformers import SentenceTransformer
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
# Load embedding model safely
try:
    model = SentenceTransformer(MODEL_PATH)
except Exception as e:
    st.error(f"❌ Embedding model not found at configured path.\n\n**Reason:** {str(e)}")
    st.stop()

# Call the form function
render_edit_product_form(df, model, CATALOG_PKL, CSV_LOG, VERSION_DIR)
