import streamlit as st

from auth_ui import require_login
from link_scraper import extract_material_payload_from_url
from materials_manager import add_private_material


st.set_page_config(page_title="Add Material From Link", layout="centered")
require_login()
st.title("Add Material From Link")
access_token = st.session_state.get("sb_access_token")
user_id = st.session_state.get("user_id")

url = st.text_input(
    "Product URL",
    placeholder="https://example.com/product/123",
    key="add_link_url",
).strip()

if st.button("Fetch product details", key="add_link_fetch", disabled=not bool(url)):
    payload = extract_material_payload_from_url(url)
    if "error" in payload:
        st.error(payload["error"])
    else:
        st.session_state["add_link_payload"] = payload
        st.session_state["add_link_name"] = payload.get("name") or ""
        st.session_state["add_link_desc"] = payload.get("description") or ""
        st.session_state["add_link_cat"] = payload.get("category") or ""
        st.session_state["add_link_price"] = float(payload.get("price") or 0.0)
        st.session_state["add_link_link"] = payload.get("link") or url
        st.session_state["add_link_image"] = payload.get("image_url") or ""
        st.session_state["add_link_tags"] = ", ".join(payload.get("tags") or [])
        st.success("Fetched. Review fields and save.")

quick_add_disabled = (not bool(url)) or (not bool(access_token and user_id))
if st.button("Fetch and save directly", key="add_link_quick_save", disabled=quick_add_disabled):
    payload = extract_material_payload_from_url(url)
    if "error" in payload:
        st.error(payload["error"])
    else:
        add_private_material(
            access_token=access_token,
            user_id=user_id,
            payload=payload,
        )
        st.success("Saved to your private library.")

payload = st.session_state.get("add_link_payload")
if payload:
    image_url = (st.session_state.get("add_link_image") or "").strip()
    if image_url.startswith("http"):
        st.image(image_url, width=300)

    st.text_input("Name", key="add_link_name")
    st.text_area("Description", key="add_link_desc")
    st.text_input("Category", key="add_link_cat")
    st.number_input("Price (THB)", min_value=0.0, step=10.0, key="add_link_price")
    st.text_input("Source Link", key="add_link_link")
    st.text_input("Image URL", key="add_link_image")
    st.text_input("Tags (comma separated)", key="add_link_tags")

    can_save = bool(st.session_state.get("add_link_name", "").strip()) and bool(access_token and user_id)
    if st.button("Save to my private library", type="primary", key="add_link_save", disabled=not can_save):
        tags = [t.strip() for t in str(st.session_state.get("add_link_tags") or "").split(",") if t.strip()]
        add_private_material(
            access_token=access_token,
            user_id=user_id,
            payload={
                "name": st.session_state.get("add_link_name", "").strip(),
                "description": st.session_state.get("add_link_desc", "").strip() or None,
                "category": st.session_state.get("add_link_cat", "").strip() or None,
                "price": float(st.session_state.get("add_link_price") or 0.0)
                if st.session_state.get("add_link_price")
                else None,
                "link": st.session_state.get("add_link_link", "").strip() or None,
                "image_url": st.session_state.get("add_link_image", "").strip() or None,
                "tags": tags,
            },
        )
        st.success("Saved. Open My Materials to search or browse it.")
