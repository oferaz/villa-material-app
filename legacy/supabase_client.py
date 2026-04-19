# supabase_client.py

import os
import streamlit as st
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()


def _resolve_auth_flow_type() -> str:
    flow = None
    if hasattr(st, "secrets"):
        flow = st.secrets.get("SUPABASE_AUTH_FLOW")
    if not flow:
        flow = os.getenv("SUPABASE_AUTH_FLOW")
    flow_text = str(flow or "").strip().lower()
    if flow_text in {"pkce", "implicit"}:
        return flow_text
    return "pkce"


def _build_client_options():
    flow_type = _resolve_auth_flow_type()
    try:
        from supabase.lib.client_options import SyncClientOptions

        return SyncClientOptions(flow_type=flow_type)
    except Exception:
        return None


def _build_supabase_client(supabase_url: str, supabase_key: str, access_token: str | None) -> Client:
    # Do not cache client objects globally; shared clients can leak auth state across users.
    options = _build_client_options()
    if options is not None:
        try:
            sb: Client = create_client(supabase_url, supabase_key, options=options)
        except TypeError:
            # Test stubs and older clients may only accept (url, key).
            sb = create_client(supabase_url, supabase_key)
    else:
        sb = create_client(supabase_url, supabase_key)
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
