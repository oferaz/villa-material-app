import streamlit as st
import pandas as pd
import numpy as np
import os
from datetime import datetime
from embedding import get_embedder

from config import CATALOG_PKL, MODEL_PATH, VERSION_DIR

st.set_page_config(page_title="🔄 Reindex Catalog", layout="centered")
st.title("🔄 Re-index Product Embeddings")

# Load catalog
if not os.path.exists(CATALOG_PKL):
    st.error("❌ Catalog file not found.")
    st.stop()

df = pd.read_pickle(CATALOG_PKL)
model = get_embedder()

# Backup before overwrite
timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
backup_path = os.path.join(VERSION_DIR, f"product_catalog_BACKUP_{timestamp}.pkl")
df.to_pickle(backup_path)

# Re-index
if st.button("🚀 Start Re-indexing"):
    st.info("Re-generating embeddings... please wait ⏳")
    progress = st.progress(0)

    updated_embeddings = []
    for i, row in df.iterrows():
        text = f"{row.get('product_name', '')} {row.get('Description', '')}"
        embedding = model.encode(text, convert_to_numpy=True)
        updated_embeddings.append(embedding)
        progress.progress((i + 1) / len(df))

    df["embedding"] = updated_embeddings

    # Optional: drop duplicates
    df.drop_duplicates(subset=["product_name", "Supplier"], keep="last", inplace=True)

    # Save new version
    df.to_pickle(CATALOG_PKL)
    version_path = os.path.join(VERSION_DIR, f"product_catalog_{timestamp}.pkl")
    df.to_pickle(version_path)

    st.success("✅ Re-indexing complete! Catalog updated.")
    st.balloons()

