# supabase_client.py

import os
import streamlit as st
from supabase import create_client, Client
from dotenv import load_dotenv

# Load local .env (for dev)
load_dotenv()

# Try Streamlit secrets first (Cloud)
SUPABASE_URL = None
SUPABASE_KEY = None

if hasattr(st, "secrets"):
    SUPABASE_URL = st.secrets.get("SUPABASE_URL")
    SUPABASE_KEY = st.secrets.get("SUPABASE_KEY")

# Fallback to environment variables (.env / system)
if not SUPABASE_URL:
    SUPABASE_URL = os.getenv("SUPABASE_URL")

if not SUPABASE_KEY:
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    st.error("❌ Supabase credentials are not set.")
    st.info("Set SUPABASE_URL and SUPABASE_KEY in:")
    st.info("- .streamlit/secrets.toml (for Cloud)")
    st.info("- .env file (for local dev)")
    st.stop()

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)