import requests
from bs4 import BeautifulSoup
import pandas as pd
import os

CATALOG_PKL = "data/catalog.pkl"


def extract_product_info_from_url(url):
    """
    Extract product info from a given URL using Open Graph tags and, if applicable, site-specific logic.
    Supports Lazada, Shopee, and HomePro scraping. Automatically saves result to catalog.pkl.
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        def get_meta(prop):
            tag = soup.find("meta", property=prop)
            return tag["content"] if tag and "content" in tag.attrs else ""

        # Default fields from Open Graph
        title = get_meta("og:title") or (soup.title.string.strip() if soup.title else "Unnamed Product")
        description = get_meta("og:description")
        image = get_meta("og:image")
        price = ""

        # --- Lazada-specific scraper ---
        if "lazada" in url:
            price_tag = soup.find("span", class_="pdp-price")
            if not price_tag:
                price_tag = soup.find("span", class_="pdp-price_type")
            if price_tag:
                price = price_tag.get_text(strip=True).replace(",", "")

        # --- Shopee-specific scraper ---
        elif "shopee" in url:
            price_tag = soup.find("div", class_="pdp-product-price")
            if not price_tag:
                price_tag = soup.find("div", class_="_3n5NQx")  # fallback for some layouts
            if price_tag:
                price = price_tag.get_text(strip=True).replace(",", "")

        # --- HomePro-specific scraper ---
        elif "homepro" in url:
            price_tag = soup.find("span", class_="price")
            if not price_tag:
                price_tag = soup.find("div", class_="product-price")
            if price_tag:
                price = price_tag.get_text(strip=True).replace(",", "")

        # --- Save to catalog.pkl ---
        product_data = {
            "product_name": title,
            "Description": description,
            "CloudURL": image if image.startswith("http") else "",
            "Price": float(price) if price.replace('.', '', 1).isdigit() else 0,
            "Link": url,
            "Supplier": "",
            "Category": "",
            "ImageFile": ""
        }

        if os.path.exists(CATALOG_PKL):
            df = pd.read_pickle(CATALOG_PKL)
        else:
            df = pd.DataFrame()

        df = pd.concat([df, pd.DataFrame([product_data])], ignore_index=True)
        df.to_pickle(CATALOG_PKL)

        return {
            "name": title,
            "description": description,
            "image": product_data["CloudURL"],
            "price": price,
            "link": url
        }

    except Exception as e:
        return {"error": f"Failed to fetch product info: {e}"}
