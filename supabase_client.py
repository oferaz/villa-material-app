# supabase_client.py

import os
import streamlit as st
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()


@st.cache_resource(show_spinner=False)
def _build_supabase_client(supabase_url: str, supabase_key: str, access_token: str | None) -> Client:
    sb: Client = create_client(supabase_url, supabase_key)
    if access_token:
        sb.postgrest.auth(access_token)
    return sb


def get_supabase(access_token: str | None = None) -> Client:
    """
    Returns a Supabase client.
    If access_token is provided, attaches it so RLS auth.uid() works.
    """
    supabase_url = None
    supabase_key = None

    if hasattr(st, "secrets"):
        supabase_url = st.secrets.get("SUPABASE_URL")
        supabase_key = st.secrets.get("SUPABASE_ANON_KEY")

    if not supabase_url:
        supabase_url = os.getenv("SUPABASE_URL")

    if not supabase_key:
        supabase_key = os.getenv("SUPABASE_ANON_KEY")

    if not supabase_url or not supabase_key:
        raise RuntimeError("Supabase credentials missing")

    return _build_supabase_client(supabase_url, supabase_key, access_token)
