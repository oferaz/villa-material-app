import streamlit as st
import pandas as pd
import numpy as np
import os
from sentence_transformers import SentenceTransformer
from datetime import date, datetime
from ui_utils import render_edit_product_form

st.set_page_config(page_title="Edit Product", layout="centered")
st.title("🔧 Edit Product in Catalog")

CATALOG = "product_catalog_with_embeddings.pkl"
CSV_LOG = "submitted_products.csv"
VERSION_DIR = "catalog_versions"

@st.cache_resource
def load_model():
    return SentenceTransformer("/home/ofer/LLM/models/all-MiniLM-L6-v2", device="cpu")

@st.cache_data
def load_data():
    df = pd.read_pickle(CATALOG)
    df["embedding"] = df["embedding"].apply(np.array)
    return df

model = load_model()
df = load_data()

render_edit_product_form(df, model, CATALOG, CSV_LOG, VERSION_DIR)
