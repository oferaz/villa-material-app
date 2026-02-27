import streamlit as st
from supabase_client import get_supabase

import streamlit as st
from supabase_client import get_supabase

def require_login():
    if st.session_state.get("sb_access_token"):
        return

    st.title("Login")

    email = st.text_input("Email")
    if st.button("Send code", type="primary", disabled=not email.strip()):
        try:
            sb = get_supabase()
            sb.auth.sign_in_with_otp({
                "email": email.strip(),
                "options": {"should_create_user": True}
            })
            st.session_state.pending_email = email.strip()
            st.success("Sent. Check your email.")
            st.rerun()
        except Exception as e:
            # This prints the real exception details into Streamlit logs/UI
            st.exception(e)
            st.stop()

    otp = st.text_input("Code")
    if st.button("Verify", type="primary", disabled=not otp.strip()):
        try:
            sb = get_supabase()
            em = st.session_state.get("pending_email") or email.strip()
            res = sb.auth.verify_otp({"email": em, "token": otp.strip(), "type": "email"})
            session = res.session
            user = res.user
            st.session_state.sb_access_token = session.access_token
            st.session_state.user_id = user.id
            st.session_state.user_email = user.email
            st.rerun()
        except Exception as e:
            st.exception(e)
            st.stop()

    st.stop()

def sidebar_logout():
    if st.sidebar.button("Logout"):
        for k in ["sb_access_token", "user_id", "user_email", "pending_email"]:
            st.session_state.pop(k, None)
        st.rerun()