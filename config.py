# config.py

import os

# Base paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE_DIR = os.path.join(BASE_DIR, "images")
VERSION_DIR = os.path.join(BASE_DIR, "catalog_versions")
MODEL_PATH = "/home/ofer/LLM/models/all-MiniLM-L6-v2"

# Use environment variable or default to HuggingFace path
# MODEL_PATH = os.getenv("MATERIA_MODEL_PATH", "sentence-transformers/all-MiniLM-L6-v2")

# Catalog files
CATALOG_PKL = os.path.join(BASE_DIR, "product_catalog_with_embeddings.pkl")
CSV_LOG = os.path.join(BASE_DIR, "submitted_products.csv")

# Other constants
ROOM_OPTIONS = [
    "Living Room", "Bedroom", "Master Bedroom",
    "Bathroom", "Kitchen", "Outdoor", "Dining Room"
]

CATEGORY_OPTIONS = [
    "Tile", "Furniture", "Lighting", "Hardware", "Appliance", "Other"
]

AVAILABILITY_OPTIONS = [
    "In Stock", "Out of Stock", "Limited Stock"
]
