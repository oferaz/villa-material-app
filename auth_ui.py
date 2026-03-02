import streamlit as st
import os
import re
import time
import json
import base64
from supabase_client import get_supabase
from data_utils import APP_DATA_DIR

AUTH_SESSION_FILE = os.path.join(APP_DATA_DIR, "auth_session.json")
LOGO_PNG_PATH = os.path.join("assets", "materia_logo.png")


def _jwt_exp_epoch(access_token: str | None) -> float | None:
    token = (access_token or "").strip()
    if not token:
        return None
    parts = token.split(".")
    if len(parts) < 2:
        return None
    try:
        payload = parts[1]
        payload += "=" * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(payload.encode("utf-8")).decode("utf-8")
        data = json.loads(decoded)
        exp = data.get("exp")
        if exp is None:
            return None
        return float(exp)
    except Exception:
        return None


def _session_expiry_epoch(session) -> float | None:
    expires_at = getattr(session, "expires_at", None)
    if expires_at is not None:
        try:
            return float(expires_at)
        except Exception:
            pass

    expires_in = getattr(session, "expires_in", None)
    if expires_in is not None:
        try:
            return time.time() + float(expires_in)
        except Exception:
            return None
    return None


def _set_auth_state(session, user) -> bool:
    access_token = getattr(session, "access_token", None)
    if not access_token or not user:
        return False

    st.session_state.sb_access_token = access_token
    st.session_state.user_id = getattr(user, "id", None)
    st.session_state.user_email = getattr(user, "email", None)

    refresh_token = getattr(session, "refresh_token", None)
    if refresh_token:
        st.session_state.sb_refresh_token = refresh_token
    else:
        st.session_state.pop("sb_refresh_token", None)

    expires_at = _session_expiry_epoch(session)
    if expires_at is not None:
        st.session_state.sb_access_expires_at = float(expires_at)
    else:
        st.session_state.pop("sb_access_expires_at", None)

    _save_persisted_session(session, user)
    return True


def _access_token_needs_refresh() -> bool:
    access_token = st.session_state.get("sb_access_token")
    if not access_token:
        return False

    # Refresh one minute before expiration.
    threshold = time.time() + 60
    expires_at = st.session_state.get("sb_access_expires_at")
    if expires_at is None:
        expires_at = _jwt_exp_epoch(access_token)
    if expires_at is None:
        return False
    try:
        return float(expires_at) <= threshold
    except Exception:
        return False


def _refresh_session_if_needed(force: bool = False) -> bool:
    access_token = st.session_state.get("sb_access_token")
    if not access_token:
        return False

    if not force and not _access_token_needs_refresh():
        return True

    refresh_token = st.session_state.get("sb_refresh_token")
    if not refresh_token:
        # Session is expiring/expired and cannot be refreshed.
        clear_auth_state()
        return False

    try:
        sb = get_supabase()
        res = sb.auth.refresh_session(refresh_token)
        session = res.session
        user = res.user
        if not _set_auth_state(session, user):
            clear_auth_state()
            return False
        return True
    except Exception:
        clear_auth_state()
        return False

def _auth_bypass_enabled() -> bool:
    raw = os.getenv("AUTH_BYPASS")
    if hasattr(st, "secrets"):
        raw = st.secrets.get("AUTH_BYPASS", raw)
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def _session_persistence_enabled() -> bool:
    """
    Keep disk-backed auth persistence disabled to avoid cross-user session
    leakage in multi-user deployments. Per-browser Streamlit session_state is
    used instead.
    """
    return False


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


def _normalize_email(value: str) -> str:
    return str(value or "").strip().lower()


def _looks_like_email(value: str) -> bool:
    email = _normalize_email(value)
    # Lightweight validation to catch obvious typos before hitting Supabase.
    return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]{2,}", email))


def _normalize_otp_token(value: str) -> str:
    # Users often paste codes with spaces/hyphens; Supabase expects a compact token.
    return re.sub(r"[^A-Za-z0-9]", "", str(value or "").strip())


def _friendly_send_code_error(error_text: str) -> str | None:
    text = str(error_text or "").strip().lower()
    if not text:
        return None
    if "invalid" in text and "email" in text:
        return "Please enter a valid email address."
    if "email address" in text and "is invalid" in text:
        return "Please enter a valid email address."
    return None


def _friendly_verify_error(error_text: str) -> str | None:
    text = str(error_text or "").strip().lower()
    if not text:
        return None
    if "expired" in text:
        return "This code has expired. Request a new code and try again."
    if "invalid" in text or "otp" in text or "token" in text:
        return "That code is invalid. Please use the latest code from your email."
    if "email" in text and "required" in text:
        return "Email is missing. Enter your email and request a new code."
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

        return _set_auth_state(session, user)
    except Exception:
        _clear_persisted_session()
        return False


def clear_auth_state(extra_keys: list[str] | None = None) -> None:
    keys = [
        "sb_access_token",
        "sb_refresh_token",
        "sb_access_expires_at",
        "user_id",
        "user_email",
        "pending_email",
    ]
    if extra_keys:
        keys.extend(extra_keys)
    for k in keys:
        st.session_state.pop(k, None)
    _clear_persisted_session()


def _hide_sidebar_navigation_for_auth() -> None:
    st.markdown(
        """
        <style>
        [data-testid="stSidebarNav"] {
            display: none;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def require_login():
    if _auth_bypass_enabled():
        st.session_state.setdefault("user_email", "debug@local")
        st.session_state.setdefault("user_id", None)
        return

    if st.session_state.get("sb_access_token") and _refresh_session_if_needed():
        return

    _hide_sidebar_navigation_for_auth()

    _, login_col, _ = st.columns([1, 1.4, 1])
    with login_col:
        if os.path.exists(LOGO_PNG_PATH):
            st.image(LOGO_PNG_PATH, width=190)
        st.markdown(
            """
            <div class="welcome-box">
                <h2>Welcome to Materia</h2>
                <p>Sign in with a one-time code sent to your email.</p>
            </div>
            """,
            unsafe_allow_html=True,
        )
        st.caption("How login works: enter your email, request a code, then paste the code to continue.")

        email = st.text_input("Email address", placeholder="name@company.com")
        email_clean = _normalize_email(email)

        now = time.time()
        next_allowed = float(st.session_state.get("otp_next_allowed_at", 0))
        wait_left = max(0, int(next_allowed - now))
        send_disabled = (not email_clean) or (wait_left > 0)

        if wait_left > 0:
            st.caption(f"You can request another code in {wait_left}s.")

        if st.button("Send code", type="primary", disabled=send_disabled):
            if not _looks_like_email(email_clean):
                st.error("Please enter a valid email address (for example: name@company.com).")
                st.stop()
            try:
                sb = get_supabase()
                sb.auth.sign_in_with_otp({
                    "email": email_clean,
                    "options": {"should_create_user": True}
                })
                st.session_state.pending_email = email_clean
                # Mirror server-side throttle to avoid immediate repeat requests.
                st.session_state.otp_next_allowed_at = time.time() + 30
                st.success("Code sent. Please check your inbox (and spam folder).")
                st.rerun()
            except Exception as e:
                msg = str(e)
                retry_s = _parse_retry_seconds(msg)
                if retry_s is not None:
                    st.session_state.otp_next_allowed_at = time.time() + retry_s
                    st.warning(f"Too many requests. Try again in about {retry_s} seconds.")
                    st.stop()
                friendly = _friendly_send_code_error(msg)
                if friendly:
                    st.error(friendly)
                else:
                    st.error("Could not send a login code right now. Please try again.")
                st.stop()

        pending_email = (st.session_state.get("pending_email") or "").strip()
        if pending_email:
            st.caption(f"Latest code was sent to: {pending_email}")

        otp = st.text_input("Verification code", placeholder="Enter the 6-digit code")

        if st.button("Verify and continue", type="primary", disabled=not otp.strip()):
            try:
                sb = get_supabase()
                em = _normalize_email(pending_email or email_clean)
                token = _normalize_otp_token(otp)
                if not em:
                    st.error("Enter your email and request a code first.")
                    st.stop()
                if not token:
                    st.error("Enter a valid verification code.")
                    st.stop()

                res = sb.auth.verify_otp({
                    "email": em,
                    "token": token,
                    "type": "email"
                })

                session = res.session
                user = res.user

                if not _set_auth_state(session, user):
                    st.error("Login session could not be established. Please try again.")
                    st.stop()

                # Non-blocking profile bootstrap: login should still succeed if this fails.
                try:
                    sb_authed = get_supabase(session.access_token)
                    profile_check = sb_authed.table("profiles").select("id").eq("id", user.id).execute()
                    if not profile_check.data:
                        sb_authed.table("profiles").insert({
                            "id": user.id,
                            "full_name": user.email.split("@")[0]
                        }).execute()
                except Exception:
                    pass

                st.rerun()

            except Exception as e:
                friendly = _friendly_verify_error(str(e))
                if friendly:
                    st.error(friendly)
                else:
                    st.error("Could not verify this code. Request a new code and try again.")
                st.stop()

    st.stop()

def sidebar_logout():
    if st.sidebar.button("Logout"):
        clear_auth_state()
        st.rerun()
