import requests
from bs4 import BeautifulSoup


def extract_product_info_from_url(url):
    """
    Extract basic product info from a given URL using Open Graph tags and title.
    Returns a dict with: name, description, image, link (and optionally price).
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

        # Fallback to title if og:title is missing
        title = get_meta("og:title") or (soup.title.string.strip() if soup.title else "Unnamed Product")
        description = get_meta("og:description")
        image = get_meta("og:image")

        return {
            "name": title,
            "description": description,
            "image": image,
            "price": "",  # leave empty for now
            "link": url
        }

    except Exception as e:
        return {"error": f"Failed to fetch product info: {e}"}
