# embedding.py
import os
import streamlit as st
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()  # <-- IMPORTANT: reads .env for local dev

@st.cache_resource
def get_embedder():
    path = os.getenv("EMBED_MODEL_PATH")

    if not path:
        try:
            from config import MODEL_PATH
            path = MODEL_PATH
        except Exception:
            path = None

    # If EMBED_MODEL_PATH exists, we will NOT hit huggingface
    if not path:
        path = "sentence-transformers/all-MiniLM-L6-v2"

    return SentenceTransformer(path, device="cpu")