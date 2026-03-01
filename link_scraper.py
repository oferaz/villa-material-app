import json
import re
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)


def _first_non_empty(*values):
    for v in values:
        text = str(v or "").strip()
        if text:
            return text
    return ""


def _meta_content(soup: BeautifulSoup, name: str = "", prop: str = "") -> str:
    if prop:
        tag = soup.find("meta", attrs={"property": prop})
        if tag and tag.get("content"):
            return str(tag.get("content")).strip()
    if name:
        tag = soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            return str(tag.get("content")).strip()
    return ""


def _parse_price(raw: str):
    text = str(raw or "").strip()
    if not text:
        return None

    cleaned = text.replace(",", "")
    m = re.search(r"(\d+(?:\.\d+)?)", cleaned)
    if not m:
        return None
    try:
        return float(m.group(1))
    except Exception:
        return None


def _extract_jsonld_product(soup: BeautifulSoup) -> dict:
    scripts = soup.find_all("script", attrs={"type": "application/ld+json"})
    for script in scripts:
        raw = script.string or script.get_text() or ""
        if not raw.strip():
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue

        nodes = data if isinstance(data, list) else [data]
        for node in nodes:
            if not isinstance(node, dict):
                continue
            ntype = str(node.get("@type", "")).lower()
            if ntype != "product":
                continue

            offers = node.get("offers") or {}
            if isinstance(offers, list) and offers:
                offers = offers[0]
            if not isinstance(offers, dict):
                offers = {}

            image = node.get("image")
            if isinstance(image, list):
                image = image[0] if image else ""

            brand = node.get("brand")
            if isinstance(brand, dict):
                brand = brand.get("name")

            return {
                "name": _first_non_empty(node.get("name")),
                "description": _first_non_empty(node.get("description")),
                "image_url": _first_non_empty(image),
                "price": _parse_price(_first_non_empty(offers.get("price"), node.get("price"))),
                "category": _first_non_empty(node.get("category"), brand),
            }
    return {}


def extract_material_payload_from_url(url: str) -> dict:
    """
    Parse product metadata from a web page and return a payload compatible with
    `add_private_material`.
    """
    src = str(url or "").strip()
    if not src:
        return {"error": "Please provide a URL."}
    if not (src.startswith("http://") or src.startswith("https://")):
        return {"error": "URL must start with http:// or https://"}

    try:
        response = requests.get(src, headers={"User-Agent": _UA}, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        jsonld = _extract_jsonld_product(soup)
        title = _first_non_empty(
            jsonld.get("name"),
            _meta_content(soup, prop="og:title"),
            _meta_content(soup, name="twitter:title"),
            soup.title.string.strip() if soup.title and soup.title.string else "",
        )
        description = _first_non_empty(
            jsonld.get("description"),
            _meta_content(soup, prop="og:description"),
            _meta_content(soup, name="description"),
            _meta_content(soup, name="twitter:description"),
        )
        image_url = _first_non_empty(
            jsonld.get("image_url"),
            _meta_content(soup, prop="og:image"),
            _meta_content(soup, name="twitter:image"),
        )
        category = _first_non_empty(
            jsonld.get("category"),
            _meta_content(soup, prop="product:category"),
            _meta_content(soup, name="keywords").split(",")[0].strip() if _meta_content(soup, name="keywords") else "",
            _meta_content(soup, prop="og:site_name"),
        )
        price = jsonld.get("price")
        if price is None:
            price = _parse_price(
                _first_non_empty(
                    _meta_content(soup, prop="product:price:amount"),
                    _meta_content(soup, name="price"),
                )
            )

        host = urlparse(src).netloc.lower()
        if host.startswith("www."):
            host = host[4:]

        tags = []
        if host:
            tags.append(host)
        if category:
            tags.append(category.lower())
        tags = [t for i, t in enumerate(tags) if t and t not in tags[:i]]

        return {
            "name": title or "Unnamed Product",
            "description": description or None,
            "category": category or None,
            "price": price,
            "link": src,
            "image_url": image_url or None,
            "tags": tags,
        }
    except Exception as e:
        return {"error": f"Failed to fetch product info: {e}"}


def extract_product_info_from_url(url: str) -> dict:
    """
    Backward-compatible wrapper for older pages.
    """
    data = extract_material_payload_from_url(url)
    if "error" in data:
        return data
    return {
        "name": data.get("name"),
        "description": data.get("description") or "",
        "image": data.get("image_url") or "",
        "price": data.get("price") if data.get("price") is not None else "",
        "link": data.get("link"),
    }
