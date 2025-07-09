# ui_utils.py

import streamlit as st
import os
import pandas as pd
import uuid
from datetime import date, datetime
from PIL import Image
import numpy as np
from config import CATALOG_PKL, CSV_LOG, VERSION_DIR, IMAGE_DIR


def render_product_card(row, i, room_options):
    col1, col2 = st.columns([4, 2])
    image_url = ""
    cloud_url = row.get("CloudURL", "")
    local_path = row.get("ImageFile", "")

    if isinstance(cloud_url, str) and cloud_url.startswith("http"):
        image_url = cloud_url
    elif isinstance(local_path, str) and os.path.exists(local_path):
        image_url = local_path

    with col1:
        if image_url:
            st.image(image_url, width=300, caption=row.get("product_name", "Unnamed"))
            with st.expander("🔍 Click to view full image"):
                st.image(image_url, use_container_width=True)
        else:
            st.warning("⚠️ Image not found (cloud or local).")

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
        colA, colB = st.columns(2)
        with colA:
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

        with colB:
            if st.button("✏️ Edit", key=f"edit_{i}"):
                st.session_state.edit_product_name = row.get("product_name", "")
                st.switch_page("pages/Edit_Product.py")


def apply_custom_css():
    st.markdown("""
        <style>
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

# render_add_product_form not yet updated

from config import CATALOG_PKL, CSV_LOG, VERSION_DIR, IMAGE_DIR


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

        # Log to CSV
        if os.path.exists(csv_path):
            df_csv = pd.read_csv(csv_path)
        else:
            df_csv = pd.DataFrame()
        df_csv = pd.concat([df_csv, pd.DataFrame([new_product])], ignore_index=True)
        df_csv.to_csv(csv_path, index=False)

        # Generate embedding
        embedding_input = f"{name} {description}"
        embedding = model.encode(embedding_input, convert_to_numpy=True)
        new_product["embedding"] = np.array(embedding)

        # Load or create catalog
        if os.path.exists(catalog_path):
            main_df = pd.read_pickle(catalog_path)
        else:
            main_df = pd.DataFrame()

        main_df = pd.concat([main_df, pd.DataFrame([new_product])], ignore_index=True)
        main_df.drop_duplicates(subset=["product_name", "Supplier"], keep="last", inplace=True)

        # Save catalog and backup version
        main_df.to_pickle(catalog_path)
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        version_path = os.path.join(version_dir, f"product_catalog_{timestamp}.pkl")
        main_df.to_pickle(version_path)

        st.cache_data.clear()
        st.success("✅ Product submitted successfully!")
        st.balloons()


def render_edit_product_form(df, model, catalog_path=CATALOG_PKL, csv_path=CSV_LOG, version_dir=VERSION_DIR):
    st.subheader("✏️ Edit Existing Product")

    if "edit_product_name" in st.session_state:
        default_query = st.session_state.edit_product_name
        st.session_state.pop("edit_product_name")
    else:
        default_query = ""

    search_query = st.text_input("🔍 Search product name to edit", value=default_query)


    if search_query:
        matching_products = df[df["product_name"].str.contains(search_query, case=False, na=False)]
    else:
        matching_products = df
    matching_products = matching_products.sort_values("product_name")
    if matching_products.empty:
        st.warning("No matching products found.")
        return
    if len(matching_products) == 1:
        selected = matching_products["product_name"].iloc[0]
    else:
        selected = st.selectbox("Select from matches", matching_products["product_name"].tolist())

    
    st.caption(f"Found {len(matching_products)} matching product(s)")

    product = df[df["product_name"] == selected].iloc[0]

    with st.form("edit_product_form"):
        name = st.text_input("Product Name", product["product_name"])
        description = st.text_area("Description", product["Description"])
        dimensions = st.text_input("Dimensions", product.get("Dimensions", ""))
        room_choices = [
            "Living Room", "Bedroom", "Master Bedroom",
            "Bathroom", "Kitchen", "Outdoor", "Dining Room"
        ]

        raw_rooms = product.get("Rooms", "")
        default_rooms = [r.strip() for r in raw_rooms.split(",") if r.strip() in room_choices] if isinstance(raw_rooms, str) else []
        rooms = st.multiselect("Relevant Rooms", room_choices, default=default_rooms)

        raw_price = product.get("Price", 0)
        price = st.number_input("Price (THB)", min_value=0, value=0 if pd.isna(raw_price) else int(raw_price))

        category = st.selectbox("Category", ["Tile", "Furniture", "Lighting", "Hardware", "Appliance", "Other"], index=0)
        availability = st.selectbox("Availability", ["In Stock", "Out of Stock", "Limited Stock"], index=0)
        contact = st.text_input("Contact", product.get("Contact", ""))
        supplier = st.text_input("Supplier", product.get("Supplier", ""))
        link = st.text_input("Link", product.get("Link", ""))
        image_path = product.get("ImageFile", "")
        new_photo = st.file_uploader("Upload new image (optional)", type=["jpg", "jpeg", "png"])

        submitted = st.form_submit_button("Save Changes")

    if submitted:
        if new_photo:
            new_image_path = os.path.join(IMAGE_DIR, f"{name.replace(' ', '_')}_{new_photo.name}")
            image = Image.open(new_photo)
            image.thumbnail((512, 512))
            if image.mode != "RGB":
                image = image.convert("RGB")
            image.save(new_image_path, format="JPEG")
        else:
            new_image_path = image_path

        updated = {
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
            "ImageFile": new_image_path,
            "DateAdded": date.today().isoformat(),
        }

        embedding_input = f"{name} {description}"
        updated["embedding"] = model.encode(embedding_input, convert_to_numpy=True)

        mask = df["product_name"] == selected
        for key in updated:
            df.loc[mask, key] = None

        index = df[mask].index[0]
        for key, value in updated.items():
            df.at[index, key] = value

        df.to_pickle(catalog_path)
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        df.to_pickle(os.path.join(version_dir, f"product_catalog_{timestamp}.pkl"))

        if os.path.exists(csv_path):
            df.to_csv(csv_path, index=False)

        st.success("✅ Product updated successfully!")
        st.cache_data.clear()
