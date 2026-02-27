# supabase_client.py

import os
import streamlit as st
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def get_supabase(access_token: str | None = None) -> Client:
    """
    Returns a Supabase client.
    If access_token is provided, attaches it so RLS auth.uid() works.
    """

    # 1️⃣ Load credentials
    SUPABASE_URL = None
    SUPABASE_KEY = None

    if hasattr(st, "secrets"):
        SUPABASE_URL = st.secrets.get("SUPABASE_URL")
        SUPABASE_KEY = st.secrets.get("SUPABASE_ANON_KEY")  # use ANON key

    if not SUPABASE_URL:
        SUPABASE_URL = os.getenv("SUPABASE_URL")

    if not SUPABASE_KEY:
        SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("Supabase credentials missing")

    # 2️⃣ Create client
    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 3️⃣ Attach user session if available
    if access_token:
        sb.postgrest.auth(access_token)

    return sb