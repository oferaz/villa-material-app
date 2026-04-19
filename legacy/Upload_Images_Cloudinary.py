import os
import pickle
import base64
import requests
import pandas as pd
from tqdm import tqdm
from config import IMAGE_DIR, CATALOG_PKL

# Cloudinary credentials
CLOUD_NAME = "dxl0cslit"
UPLOAD_PRESET = "ml_default"
CLOUDINARY_URL = f"https://api.cloudinary.com/v1_1/{CLOUD_NAME}/image/upload"

def upload_images_and_update_catalog():
    if not os.path.exists(CATALOG_PKL):
        print("❌ Catalog not found.")
        return

    with open(CATALOG_PKL, "rb") as f:
        catalog = pickle.load(f)

    uploaded_count = 0
    for i, row in tqdm(catalog.iterrows(), total=len(catalog)):
        local_path = row.get("ImageFile", "")

        if not isinstance(local_path, str) or not os.path.exists(local_path):
            continue
        if isinstance(row.get("CloudURL"), str) and row["CloudURL"].startswith("http"):
            print(f"Skipping already uploaded: {row.get('CloudURL')}")

            continue  # Already uploaded

        try:
            with open(local_path, "rb") as f:
                file_data = base64.b64encode(f.read()).decode("utf-8")

            data = {
                "file": f"data:image/jpeg;base64,{file_data}",
                "upload_preset": UPLOAD_PRESET,
            }

            print(f"📤 Uploading {os.path.basename(local_path)}...")
            response = requests.post(CLOUDINARY_URL, data=data, verify=False)
            response.raise_for_status()
            result = response.json()
            cloud_url = result["secure_url"]

            catalog.at[i, "CloudURL"] = cloud_url
            print(f"✅ Uploaded → {cloud_url}")
            uploaded_count += 1

        except Exception as e:
            print(f"❌ Failed to upload {local_path}: {e}")

    catalog.to_pickle(CATALOG_PKL)
    print(f"\n🎉 Done. Uploaded {uploaded_count} images to Cloudinary.")

if __name__ == "__main__":
    upload_images_and_update_catalog()
