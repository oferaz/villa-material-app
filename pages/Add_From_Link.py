import streamlit as st
from link_scraper import extract_product_info_from_url
from project_manager import load_projects, update_current_cart, get_current_cart

# --- Load Current Project ---
projects = load_projects()
if "current_project" not in st.session_state:
    st.warning("⚠️ No project selected.")
    st.stop()

project = next((p for p in projects if p["name"] == st.session_state.current_project), None)
if not project:
    st.warning("⚠️ Selected project not found.")
    st.stop()

rooms = project.get("rooms", [])

st.title("🔗 Add Product from Link")

url = st.text_input("Paste product URL")

if st.button("Fetch Product"):
    data = extract_product_info_from_url(url)
    if "error" in data:
        st.error(data["error"])
    else:
        st.image(data["image"], width=300)
        name = st.text_input("Name", value=data["name"])
        description = st.text_area("Description", value=data["description"])
        price = st.number_input("Price (THB)", min_value=0, value=0)
        supplier = st.text_input("Supplier (WhatsApp phone, optional)")
        room = st.selectbox("Assign to Room", rooms)

        if st.button("✅ Add to Project"):
            product_data = {
                "product_name": name,
                "Description": description,
                "Price": price,
                "room": room,
                "ImageFile": "",  # You can auto-download later
                "CloudURL": data["image"],
                "Link": url,
                "Supplier": supplier
            }
            st.session_state.cart.append(product_data)
            update_current_cart(st.session_state.current_project, st.session_state.cart)
            st.success("✅ Product added to cart and saved.")
