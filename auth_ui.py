import streamlit as st
import os
import re
import time
import json
from supabase_client import get_supabase
from data_utils import APP_DATA_DIR

AUTH_SESSION_FILE = os.path.join(APP_DATA_DIR, "auth_session.json")

def _auth_bypass_enabled() -> bool:
    raw = os.getenv("AUTH_BYPASS")
    if hasattr(st, "secrets"):
        raw = st.secrets.get("AUTH_BYPASS", raw)
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def _session_persistence_enabled() -> bool:
    """
    Disk-backed auth session persistence is unsafe in multi-user deployments
    (for example Streamlit Cloud), because one server-side file is shared by
    all visitors. Keep it off by default.
    """
    raw = os.getenv("AUTH_PERSIST_SESSION", "0")
    if hasattr(st, "secrets"):
        raw = st.secrets.get("AUTH_PERSIST_SESSION", raw)
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def _parse_retry_seconds(error_text: str) -> int | None:
    if not error_text:
        return None
    m = re.search(r"after\s+(\d+)\s+seconds", error_text, re.IGNORECASE)
    if not m:
        return None
    try:
        return int(m.group(1))
    except Exception:
        return None


def _save_persisted_session(session, user) -> None:
    if not _session_persistence_enabled():
        return

    refresh_token = getattr(session, "refresh_token", None)
    if not refresh_token:
        return

    payload = {
        "refresh_token": refresh_token,
        "user_id": getattr(user, "id", None),
        "user_email": getattr(user, "email", None),
    }
    try:
        with open(AUTH_SESSION_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f)
    except Exception:
        pass


def _load_persisted_session() -> dict | None:
    if not _session_persistence_enabled():
        # Ensure stale shared credentials from older versions are removed.
        _clear_persisted_session()
        return None

    if not os.path.exists(AUTH_SESSION_FILE):
        return None
    try:
        with open(AUTH_SESSION_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return None
        if not data.get("refresh_token"):
            return None
        return data
    except Exception:
        return None


def _clear_persisted_session() -> None:
    try:
        if os.path.exists(AUTH_SESSION_FILE):
            os.remove(AUTH_SESSION_FILE)
    except Exception:
        pass


def _try_restore_login_from_disk() -> bool:
    saved = _load_persisted_session()
    if not saved:
        return False

    try:
        sb = get_supabase()
        res = sb.auth.refresh_session(saved["refresh_token"])
        session = res.session
        user = res.user

        if not session or not user:
            _clear_persisted_session()
            return False

        st.session_state.sb_access_token = session.access_token
        st.session_state.user_id = user.id
        st.session_state.user_email = user.email
        _save_persisted_session(session, user)
        return True
    except Exception:
        _clear_persisted_session()
        return False


def clear_auth_state(extra_keys: list[str] | None = None) -> None:
    keys = ["sb_access_token", "user_id", "user_email", "pending_email"]
    if extra_keys:
        keys.extend(extra_keys)
    for k in keys:
        st.session_state.pop(k, None)
    _clear_persisted_session()

def require_login():
    if _auth_bypass_enabled():
        st.session_state.setdefault("user_email", "debug@local")
        st.session_state.setdefault("user_id", None)
        return

    if st.session_state.get("sb_access_token"):
        return

    if _try_restore_login_from_disk():
        return

    st.title("Login")

    email = st.text_input("Email")

    now = time.time()
    next_allowed = float(st.session_state.get("otp_next_allowed_at", 0))
    wait_left = max(0, int(next_allowed - now))
    send_disabled = (not email.strip()) or (wait_left > 0)

    if wait_left > 0:
        st.caption(f"You can request another code in {wait_left}s.")

    if st.button("Send code", type="primary", disabled=send_disabled):
        try:
            sb = get_supabase()
            sb.auth.sign_in_with_otp({
                "email": email.strip(),
                "options": {"should_create_user": True}
            })
            st.session_state.pending_email = email.strip()
            # Mirror server-side throttle to avoid immediate repeat requests.
            st.session_state.otp_next_allowed_at = time.time() + 30
            st.success("Sent. Check your email.")
            st.rerun()
        except Exception as e:
            msg = str(e)
            retry_s = _parse_retry_seconds(msg)
            if retry_s is not None:
                st.session_state.otp_next_allowed_at = time.time() + retry_s
                st.warning(f"Too many requests. Try again in about {retry_s} seconds.")
                st.stop()
            st.exception(e)
            st.stop()

    otp = st.text_input("Code")

    if st.button("Verify", type="primary", disabled=not otp.strip()):
        try:
            sb = get_supabase()
            em = st.session_state.get("pending_email") or email.strip()

            res = sb.auth.verify_otp({
                "email": em,
                "token": otp.strip(),
                "type": "email"
            })

            session = res.session
            user = res.user

            st.session_state.sb_access_token = session.access_token
            st.session_state.user_id = user.id
            st.session_state.user_email = user.email
            _save_persisted_session(session, user)

            # create profile if needed
            sb_authed = get_supabase(session.access_token)
            profile_check = sb_authed.table("profiles").select("id").eq("id", user.id).execute()
            if not profile_check.data:
                sb_authed.table("profiles").insert({
                    "id": user.id,
                    "full_name": user.email.split("@")[0]
                }).execute()

            st.rerun()

        except Exception as e:
            st.exception(e)
            st.stop()

    st.stop()

def sidebar_logout():
    if st.sidebar.button("Logout"):
        clear_auth_state()
        st.rerun()
