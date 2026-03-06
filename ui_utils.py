# ui_utils.py

import streamlit as st
import os
import pandas as pd
import uuid
from datetime import date, datetime
from PIL import Image
import numpy as np
from config import CATALOG_PKL, CSV_LOG, VERSION_DIR, IMAGE_DIR
import base64
import requests
from project_manager import update_current_cart

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
        room_choices = room_options if room_options else ["Unassigned"]
        room = st.selectbox("Assign to Room", room_choices, key=f"room_{i}")
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
                update_current_cart(st.session_state.current_project, st.session_state.cart)  # <-- Add this line
                st.success(f"✅ Added {quantity} × '{product_data['name']}' to {room}")

        with colB:
            if st.button("✏️ Edit", key=f"edit_{i}"):
                st.session_state.edit_product_name = row.get("product_name", "")
                st.switch_page("pages/Edit_Product.py")

def set_background_image():
    # Intentionally no-op. Theme styling is centralized in inject_custom_css().
    return

def apply_custom_css():
    # Backward-compatible hook for existing imports/calls.
    inject_custom_css()

def inject_custom_css():
    st.markdown(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap');

        :root {
            --stone-50: #f7f4ef;
            --stone-100: #efe7dc;
            --stone-200: #dfd3c3;
            --sand-50: #f8f3e9;
            --sand-100: #efe4d2;
            --forest-700: #2d4a3e;
            --forest-800: #243c33;
            --accent: #c46e45;
            --accent-soft: #f2ddcf;
            --text: #1f312a;
            --muted: #617267;
            --surface: #fffdf9;
            --surface-2: #faf5ee;
            --line: #d8cdbd;
            --shadow: 0 12px 30px rgba(28, 38, 31, 0.09);
            --radius-xl: 20px;
            --radius-lg: 16px;
            --radius-md: 12px;
            --radius-sm: 10px;
        }

        .stApp {
            background:
                radial-gradient(920px 420px at 100% 0%, #ebe4d8 0%, transparent 58%),
                radial-gradient(760px 340px at 0% 20%, #e6efe8 0%, transparent 58%),
                linear-gradient(180deg, var(--stone-50) 0%, #f1ece4 100%);
            color: var(--text);
            font-family: "Manrope", "Segoe UI", sans-serif;
        }

        h1, h2, h3, h4, h5, h6 {
            font-family: "Cormorant Garamond", serif;
            letter-spacing: 0.2px;
            font-weight: 600;
            color: var(--forest-800);
        }

        [data-testid="stCaptionContainer"],
        .stCaption,
        small {
            color: var(--muted) !important;
        }

        [data-testid="stAppViewContainer"] .main .block-container {
            max-width: 1280px;
            padding-top: 1.2rem;
            padding-bottom: 2.2rem;
        }

        .main > div {
            background: rgba(255, 253, 249, 0.95);
            border: 1px solid var(--line);
            border-radius: var(--radius-xl);
            box-shadow: var(--shadow);
            padding: 1.3rem;
        }

        section[data-testid="stSidebar"] {
            background: linear-gradient(180deg, #f8f4ec 0%, #efe7dc 100%) !important;
            border-right: 1px solid var(--line);
            box-shadow: 6px 0 18px rgba(36, 44, 37, 0.05);
            color: var(--text) !important;
        }

        section[data-testid="stSidebar"] > div {
            padding-top: 0.8rem;
        }

        section[data-testid="stSidebar"] label,
        section[data-testid="stSidebar"] p,
        section[data-testid="stSidebar"] span,
        section[data-testid="stSidebar"] div {
            color: var(--text) !important;
            -webkit-text-fill-color: var(--text) !important;
        }

        [data-testid="stSidebarNav"],
        [data-testid="stSidebarNavSeparator"] {
            display: none;
        }

        .welcome-box {
            background: linear-gradient(125deg, var(--surface) 0%, var(--surface-2) 100%);
            border: 1px solid var(--line);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow);
            padding: 16px 18px;
            margin-bottom: 14px;
        }

        .welcome-box h2 {
            margin: 0 0 4px 0;
            font-weight: 700;
            font-size: 2rem;
        }

        .welcome-box p {
            margin: 0;
            color: var(--muted) !important;
        }

        .stButton > button,
        .stDownloadButton > button {
            border-radius: 999px;
            border: 1px solid var(--line);
            background: var(--surface);
            color: var(--text) !important;
            min-height: 2.4rem;
            padding: 0.42rem 1rem;
            font-weight: 600;
            transition: all 0.18s ease;
            box-shadow: 0 1px 0 rgba(0, 0, 0, 0.03);
        }

        .stButton > button *,
        .stDownloadButton > button * {
            color: inherit !important;
        }

        section[data-testid="stSidebar"] .stButton > button,
        section[data-testid="stSidebar"] .stDownloadButton > button {
            width: 100%;
            justify-content: center;
            background: var(--surface) !important;
            color: var(--text) !important;
        }

        section[data-testid="stSidebar"] .stButton > button *,
        section[data-testid="stSidebar"] .stDownloadButton > button *,
        section[data-testid="stSidebar"] .stButton > button p,
        section[data-testid="stSidebar"] .stDownloadButton > button p,
        section[data-testid="stSidebar"] .stButton > button span,
        section[data-testid="stSidebar"] .stDownloadButton > button span,
        section[data-testid="stSidebar"] .stButton > button div,
        section[data-testid="stSidebar"] .stDownloadButton > button div {
            color: inherit !important;
            -webkit-text-fill-color: currentColor !important;
        }

        .stButton > button:hover,
        .stDownloadButton > button:hover {
            border-color: #c7b9a2;
            background: #f5eee3;
            transform: translateY(-1px);
        }

        .stButton > button[kind="primary"] {
            background: linear-gradient(135deg, var(--accent) 0%, #ad5e39 100%);
            border-color: #ad5e39;
            color: #fff8f3 !important;
            box-shadow: 0 8px 18px rgba(196, 110, 69, 0.25);
        }

        .stButton > button[kind="primary"] *,
        .stDownloadButton > button[kind="primary"] * {
            color: #fff8f3 !important;
            fill: #fff8f3 !important;
            -webkit-text-fill-color: #fff8f3 !important;
        }

        .stButton > button[kind="primary"]:hover {
            background: #a35a37;
            border-color: #a35a37;
        }

        .stButton > button:disabled,
        .stDownloadButton > button:disabled {
            background: #f1ebe1 !important;
            border-color: #d8cdbd !important;
            color: #8a978f !important;
            box-shadow: none;
            cursor: not-allowed;
            opacity: 1;
        }

        .stButton > button:disabled *,
        .stDownloadButton > button:disabled * {
            color: #8a978f !important;
            fill: #8a978f !important;
        }

        .stButton > button:disabled:hover,
        .stDownloadButton > button:disabled:hover {
            background: #f1ebe1 !important;
            border-color: #d8cdbd !important;
            transform: none;
        }

        [data-baseweb="input"],
        [data-baseweb="base-input"],
        [data-baseweb="select"] > div,
        [data-testid="stTextArea"] textarea {
            background: #fffdf9 !important;
            border: 1px solid var(--line) !important;
            border-radius: var(--radius-sm) !important;
        }

        [data-baseweb="input"] input,
        [data-baseweb="base-input"] input,
        [data-baseweb="select"] input,
        [data-testid="stTextArea"] textarea {
            color: var(--text) !important;
            -webkit-text-fill-color: var(--text) !important;
            caret-color: var(--text) !important;
        }

        [data-baseweb="menu"] *,
        [data-baseweb="popover"] * {
            color: var(--text) !important;
        }

        [data-testid="stRadio"] label,
        [data-testid="stRadio"] p,
        [data-testid="stRadio"] span,
        [data-testid="stRadio"] div,
        [data-testid="stCheckbox"] label,
        [data-testid="stCheckbox"] p,
        [data-testid="stCheckbox"] span,
        [data-testid="stCheckbox"] div {
            color: var(--text) !important;
            -webkit-text-fill-color: var(--text) !important;
        }

        [data-baseweb="radio"] *,
        [data-baseweb="checkbox"] * {
            color: var(--text) !important;
            -webkit-text-fill-color: var(--text) !important;
        }

        [data-baseweb="radio"] > div,
        [data-baseweb="checkbox"] > div {
            background-color: var(--surface) !important;
            border-color: var(--forest-700) !important;
        }

        [data-baseweb="radio"] svg,
        [data-baseweb="checkbox"] svg {
            fill: var(--forest-700) !important;
        }

        div[data-testid="stMetric"] {
            border: 1px solid var(--line);
            background: var(--surface);
            border-radius: var(--radius-md);
            padding: 10px 12px;
            animation: cardFadeIn 240ms ease-out;
        }

        div[data-testid="stMetric"] label {
            color: var(--muted) !important;
            font-weight: 500;
        }

        [data-testid="stMetricValue"],
        [data-testid="stMetricValue"] *,
        [data-testid="stMetricDelta"],
        [data-testid="stMetricDelta"] * {
            color: var(--forest-800) !important;
            -webkit-text-fill-color: var(--forest-800) !important;
        }

        [data-testid="stExpander"] {
            border: 1px solid var(--line);
            border-radius: var(--radius-md);
            background: var(--surface);
        }

        [data-testid="stVerticalBlockBorderWrapper"] {
            border-radius: var(--radius-md);
            border: 1px solid var(--line);
            background: var(--surface) !important;
            animation: cardFadeIn 220ms ease-out;
        }

        hr {
            border: none;
            border-top: 1px solid var(--line);
        }

        .editorial-title {
            font-family: "Cormorant Garamond", serif;
            font-size: 2rem;
            font-weight: 700;
            color: var(--forest-800);
            margin: 0.25rem 0 0.7rem 0;
            letter-spacing: 0.4px;
        }

        .editorial-kicker {
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: var(--muted);
            font-size: 0.73rem;
            margin-bottom: 0.15rem;
        }

        .mood-strip-wrap {
            margin: 0.6rem 0 1rem 0;
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 8px;
        }

        .mood-strip-item {
            border-radius: var(--radius-sm);
            min-height: 92px;
            background: linear-gradient(135deg, #ece1d3 0%, #dce6dd 100%);
            border: 1px solid var(--line);
            overflow: hidden;
        }

        .mood-strip-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .quick-actions {
            position: sticky;
            top: 0.6rem;
            z-index: 9;
            border: 1px solid var(--line);
            border-radius: 999px;
            padding: 0.45rem 0.9rem;
            margin-bottom: 0.8rem;
            background: rgba(255, 251, 244, 0.92);
            backdrop-filter: blur(6px);
            box-shadow: 0 8px 18px rgba(28, 38, 31, 0.08);
            font-size: 0.84rem;
            color: var(--muted);
        }

        .material-sheet {
            border: 1px solid var(--line);
            border-radius: var(--radius-md);
            background: linear-gradient(180deg, #fffdf9 0%, #faf4eb 100%);
            padding: 0.75rem;
        }

        .material-sheet h4 {
            margin: 0.45rem 0 0.35rem 0;
            font-size: 1.35rem;
        }

        .tag-line {
            display: inline-block;
            background: #f2e7d8;
            color: var(--forest-700);
            border-radius: 999px;
            border: 1px solid #e3d3bf;
            font-size: 0.74rem;
            margin: 0 0.3rem 0.28rem 0;
            padding: 0.12rem 0.56rem;
        }

        .inspire-empty {
            border: 1px dashed var(--line);
            border-radius: var(--radius-md);
            background: linear-gradient(135deg, #fbf6ef 0%, #f0f5ef 100%);
            padding: 0.9rem 1rem;
            color: var(--muted);
            margin: 0.4rem 0 0.8rem 0;
        }

        @keyframes cardFadeIn {
            0% {
                opacity: 0;
                transform: translateY(5px);
            }
            100% {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @media (max-width: 980px) {
            .mood-strip-wrap {
                grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .editorial-title {
                font-size: 1.72rem;
            }
        }
        </style>
        """,
        unsafe_allow_html=True
    )



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
            # Upload to Cloudinary


            CLOUD_NAME = "dxl0cslit"
            UPLOAD_PRESET = "ml_default"
            CLOUDINARY_URL = f"https://api.cloudinary.com/v1_1/{CLOUD_NAME}/image/upload"

            # Upload to Cloudinary
            with open(filename, "rb") as f:
                file_data = base64.b64encode(f.read()).decode("utf-8")

            data = {
                "file": f"data:image/jpeg;base64,{file_data}",
                "upload_preset": UPLOAD_PRESET,
            }

            try:
                response = requests.post(CLOUDINARY_URL, data=data, verify=False)
                response.raise_for_status()
                cloud_url = response.json()["secure_url"]
            except Exception as e:
                st.warning(f"⚠️ Failed to upload image to Cloudinary: {e}")
                cloud_url = ""



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
            "CloudURL": cloud_url, 
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

    # Prefer CloudURL for display
    cloud_url = product.get("CloudURL", "")
    image_path = product.get("ImageFile", "")

    display_image = cloud_url if cloud_url else image_path

    if display_image:
        if isinstance(display_image, str) and display_image.startswith("http"):
            st.image(display_image, width=300, caption="Current Cloud Image")
        elif isinstance(display_image, str) and os.path.exists(display_image):
            st.image(display_image, width=300, caption="Current Local Image")
        else:
            st.info("⚠️ Image path is set but file not found.")

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
        cloud_url_input = st.text_input("Cloud Image URL (optional)", cloud_url)
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
            "CloudURL": cloud_url_input,
            "DateAdded": date.today().isoformat(),
        }

        # Re-generate embedding
        embedding_input = f"{name} {description}"
        updated["embedding"] = model.encode(embedding_input, convert_to_numpy=True)

        # Safely update row
        mask = df["product_name"] == selected
        index = df[mask].index[0]
        for key in updated:
            df.at[index, key] = updated[key]

        df.to_pickle(catalog_path)
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        df.to_pickle(os.path.join(version_dir, f"product_catalog_{timestamp}.pkl"))

        if os.path.exists(csv_path):
            df.to_csv(csv_path, index=False)

        st.success("✅ Product updated successfully!")
        st.cache_data.clear()

