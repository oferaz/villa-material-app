import streamlit as st
from ui_utils import render_add_product_form
from sentence_transformers import SentenceTransformer
import os
from config import MODEL_PATH


# --- Paths ---
MAIN_CATALOG = "product_catalog_with_embeddings.pkl"
PRODUCT_CSV = "submitted_products.csv"
IMAGE_DIR = "images"
VERSION_DIR = "catalog_versions"
os.makedirs(IMAGE_DIR, exist_ok=True)
os.makedirs(VERSION_DIR, exist_ok=True)

# --- Load model ---
@st.cache_resource
def load_model():
    return SentenceTransformer(MODEL_PATH, device="cpu")

model = load_model()

# --- Render the form ---
render_add_product_form(model, IMAGE_DIR, PRODUCT_CSV, MAIN_CATALOG, VERSION_DIR)
