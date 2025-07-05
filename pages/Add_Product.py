import streamlit as st
import pandas as pd
import os
import numpy as np
from datetime import date, datetime
from sentence_transformers import SentenceTransformer
from PIL import Image
import uuid
from ui_utils import inject_custom_css


# --- Setup ---
st.set_page_config(page_title="Add New Product", layout="centered")
inject_custom_css()

st.title("📦 Add a New Product to the Catalog")

# --- Paths & Directories ---
MAIN_CATALOG = "product_catalog_with_embeddings.pkl"
PRODUCT_CSV = "submitted_products.csv"
IMAGE_DIR = "images"
VERSION_DIR = "catalog_versions"
os.makedirs(IMAGE_DIR, exist_ok=True)
os.makedirs(VERSION_DIR, exist_ok=True)

# --- Load Embedding Model ---
@st.cache_resource
def load_model():
    return SentenceTransformer("/home/ofer/LLM/models/all-MiniLM-L6-v2", device="cpu")

model = load_model()

# --- Product Entry Form ---
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

# --- Handle Form Submission ---
if submit:
    if not name or not description or not rooms:
        st.error("Please fill in all required fields: name, description, and room(s).")
    else:
        # --- Handle Image Upload ---
        filename = ""
        if photo:
            image = Image.open(photo)

            # Convert to RGB if needed
            if image.mode != "RGB":
                image = image.convert("RGB")

            # Resize image if it's too large (max 800x800)
            max_size = (800, 800)
            image.thumbnail(max_size, Image.LANCZOS)

            # Save with unique filename to avoid clashes
            safe_name = name.replace(" ", "_")
            unique_id = uuid.uuid4().hex[:8]
            filename = os.path.join(IMAGE_DIR, f"{safe_name}_{unique_id}.jpg")
            image.save(filename, format="JPEG", quality=85)

        # --- Create Product Entry ---
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
        if os.path.exists(PRODUCT_CSV):
            df_csv = pd.read_csv(PRODUCT_CSV)
        else:
            df_csv = pd.DataFrame()
        df_csv = pd.concat([df_csv, pd.DataFrame([new_product])], ignore_index=True)
        df_csv.to_csv(PRODUCT_CSV, index=False)

        # --- Generate Embedding ---
        embedding_input = f"{name} {description}"
        embedding = model.encode(embedding_input, convert_to_numpy=True)
        new_product["embedding"] = np.array(embedding)

        # --- Load or Init Main Catalog ---
        if os.path.exists(MAIN_CATALOG):
            main_df = pd.read_pickle(MAIN_CATALOG)
        else:
            main_df = pd.DataFrame()

        # --- Append New Product ---
        main_df = pd.concat([main_df, pd.DataFrame([new_product])], ignore_index=True)

        # --- Drop Duplicates Safely ---
        if "product_name" in main_df.columns and "Supplier" in main_df.columns:
            main_df.drop_duplicates(subset=["product_name", "Supplier"], keep="last", inplace=True)

        # --- Save Current Main Catalog ---
        main_df.to_pickle(MAIN_CATALOG)

        # --- Save Versioned Copy ---
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        version_path = os.path.join(VERSION_DIR, f"product_catalog_{timestamp}.pkl")
        main_df.to_pickle(version_path)

        st.cache_data.clear()


        # --- Success Feedback ---
        st.success("✅ Product submitted successfully!")
        st.balloons()
