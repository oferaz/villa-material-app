# ui_utils.py

import streamlit as st
import streamlit as st
import os
import pandas as pd

def render_product_card(row, i, room_options):
    col1, col2 = st.columns([4, 2])
    image_path = row.get("ImageFile", "")
    if isinstance(image_path, str) and image_path and os.path.exists(image_path):
        with col1:
            st.image(image_path, width=300, caption=row.get("product_name", "Unnamed"))
            with st.expander("🔍 Click to view full image"):
                st.image(image_path, use_container_width=True)

    with col1:
        st.subheader(row.get("product_name", "Unnamed Product"))
        st.write(f"**Description:** {row.get('Description', '')}")
        if not pd.isna(row.get("Price")):
            st.write(f"**Price:** {int(row['Price'])} THB")
        if isinstance(row.get('Link'), str) and row['Link'].startswith("http"):
            st.write(f"[🌐 View Product]({row['Link']})")

    with col2:
        room = st.selectbox("Assign to Room", room_options, key=f"room_{i}")
        quantity = st.number_input("Quantity", min_value=1, value=1, key=f"qty_{i}")
        if st.button("Add to Cart", key=f"add_{i}"):
            product_data = {
                "name": row.get("product_name", "Unnamed Product"),
                "description": row.get("Description", ""),
                "price": int(row["Price"]) if not pd.isna(row.get("Price")) else 0,
                "room": room,
                "quantity": quantity,
                "supplier": row.get("Supplier", ""),
                "link": row.get("Link", ""),
            }
            st.session_state.cart.append(product_data)
            st.success(f"✅ Added {quantity} × '{product_data['name']}' to {room}")

def apply_custom_css():
    st.markdown("""
        <style>
            /* Rounded corners and shadows */
            .stButton>button {
                border-radius: 12px;
                box-shadow: 2px 2px 8px rgba(0,0,0,0.1);
                padding: 0.5rem 1rem;
                transition: background-color 0.3s ease;
            }

            .stButton>button:hover {
                background-color: #f0f0f0;
            }

            .card {
                background-color: #ffffff;
                border-radius: 15px;
                padding: 16px;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.07);
                margin-bottom: 20px;
                transition: transform 0.2s ease;
            }

            .card:hover {
                transform: scale(1.02);
            }

            .stImage img {
                border-radius: 10px;
                max-width: 100%;
                height: auto;
                object-fit: cover;
            }
        </style>
    """, unsafe_allow_html=True)

def inject_custom_css():
    st.markdown(
        """
        <style>
        .stApp {
            background-color: #f8f9fa;
            font-family: "Segoe UI", sans-serif;
        }

        .main > div {
            background-color: white;
            padding: 2rem;
            border-radius: 1rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            margin-bottom: 1rem;
        }

        .stTextInput, .stNumberInput, .stSelectbox, .stTextArea, .stFileUploader, .stMultiSelect {
            padding: 0.5rem;
            border-radius: 0.5rem;
        }

        .stButton > button {
            background-color: #0072C6;
            color: white;
            border-radius: 0.5rem;
            padding: 0.4rem 1rem;
            border: none;
            transition: background-color 0.3s ease;
        }

        .stButton > button:hover {
            background-color: #005A9E;
        }

        .stDownloadButton > button {
            border-radius: 0.5rem;
        }

        img {
            border-radius: 12px;
            max-height: 250px;
            object-fit: cover;
        }

        .product-card {
            border: 1px solid #ddd;
            border-radius: 10px;
            padding: 1rem;
            margin-bottom: 1rem;
            box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        }
        </style>
        """,
        unsafe_allow_html=True
    )

import uuid
from datetime import date
from PIL import Image
import numpy as np

def render_add_product_form(model, image_dir, csv_path, catalog_path, version_dir):
    st.title("📦 Add a New Product to the Catalog")

    with st.form("product_form"):
        name = st.text_input("Product Name")
        description = st.text_area("Description")
        dimensions = st.text_input("Dimensions (e.g. 100x60x5 cm)")
        rooms = st.multiselect("Relevant Rooms", [
            "Living Room", "Bedroom", "Master Bedroom",
            "Bathroom", "Kitchen", "Outdoor", "Dining Room"
        ])
        category = st.selectbox("Category", ["Tile", "Furniture", "Lighting", "Hardware", "Appliance", "Other"])
        price = st.number_input("Price (THB)", min_value=0)
        availability = st.selectbox("Availability", ["In Stock", "Out of Stock", "Limited Stock"])
        contact = st.text_input("WhatsApp / Phone Contact")
        supplier = st.text_input("Supplier Name")
        link = st.text_input("Optional: Product Link")
        photo = st.file_uploader("Upload a Product Image", type=["jpg", "jpeg", "png"])
        submit = st.form_submit_button("Submit Product")

    if submit:
        if not name or not description or not rooms:
            st.error("Please fill in all required fields: name, description, and room(s).")
            return

        filename = ""
        if photo:
            image = Image.open(photo)
            image.thumbnail((512, 512))
            filename = os.path.join(image_dir, f"{name.replace(' ', '_')}_{uuid.uuid4().hex[:6]}.jpg")
            if image.mode != "RGB":
                image = image.convert("RGB")
            image.save(filename, format="JPEG")

        new_product = {
            "product_name": name,
            "Description": description,
            "Dimensions": dimensions,
            "Rooms": ", ".join(rooms),
            "Category": category,
            "Price": price,
            "Availability": availability,
            "Contact": contact,
            "Supplier": supplier,
            "Link": link,
            "ImageFile": filename,
            "DateAdded": date.today().isoformat()
        }
                # --- Log to CSV (optional) ---
        if os.path.exists(csv_path):
            df_csv = pd.read_csv(csv_path)
        else:
            df_csv = pd.DataFrame()
        df_csv = pd.concat([df_csv, pd.DataFrame([new_product])], ignore_index=True)
        df_csv.to_csv(csv_path, index=False)

        # --- Generate Embedding ---
        embedding_input = f"{name} {description}"
        embedding = model.encode(embedding_input, convert_to_numpy=True)
        new_product["embedding"] = np.array(embedding)

        # --- Load or Init Main Catalog ---
        if os.path.exists(catalog_path):
            main_df = pd.read_pickle(catalog_path)
        else:
            main_df = pd.DataFrame()

        # --- Append New Product ---
        main_df = pd.concat([main_df, pd.DataFrame([new_product])], ignore_index=True)

        # --- Drop Duplicates Safely ---
        if "product_name" in main_df.columns and "Supplier" in main_df.columns:
            main_df.drop_duplicates(subset=["product_name", "Supplier"], keep="last", inplace=True)

        # --- Save Current Main Catalog ---
        main_df.to_pickle(catalog_path)

        # --- Save Versioned Copy ---
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        version_path = os.path.join(version_dir, f"product_catalog_{timestamp}.pkl")
        main_df.to_pickle(version_path)

        st.cache_data.clear()

        # --- Success Message ---
        st.success("✅ Product submitted successfully!")
        st.balloons()


