import streamlit as st
from supabase_client import get_supabase

def require_login():
    # already logged in?
    if st.session_state.get("sb_access_token"):
        return

    st.title("Login")
    st.write("Enter your email. We'll send you a one-time code.")

    email = st.text_input("Email", placeholder="you@company.com")
    col1, col2 = st.columns(2)

    with col1:
        if st.button("Send code", type="primary", disabled=not email.strip()):
            sb = get_supabase()
            sb.auth.sign_in_with_otp({"email": email.strip(), "options": {
                                            "should_create_user": True
                                        }})
            st.session_state.pending_email = email.strip()
            st.success("Sent. Check your email.")
            st.rerun()

    otp = st.text_input("Code", placeholder="6-digit code")

    with col2:
        if st.button("Verify", type="primary", disabled=not otp.strip()):
            sb = get_supabase()
            em = st.session_state.get("pending_email") or email.strip()
            if not em:
                st.error("Enter email first.")
                st.stop()

            res = sb.auth.verify_otp({"email": em, "token": otp.strip(), "type": "email"})
            session = res.session
            user = res.user

            st.session_state.sb_access_token = session.access_token
            st.session_state.user_id = user.id
            st.session_state.user_email = user.email
            st.success("Logged in.")
            st.rerun()

    st.stop()

def sidebar_logout():
    if st.sidebar.button("Logout"):
        for k in ["sb_access_token", "user_id", "user_email", "pending_email"]:
            st.session_state.pop(k, None)
        st.rerun()