"""
Tulum Coffee scraper using Shopify's /products.json API.
Tulum stores the roast type in the 'vendor' field (e.g. "Medium Roast", "Dark Roast").
Non-coffee items are tagged with "Merch", "Samplers", etc. and filtered out.
"""

import requests
import pandas as pd
from pathlib import Path
from bs4 import BeautifulSoup


# Tags that indicate a non-coffee product
NON_COFFEE_TAGS = {"merch", "stickers", "subscription", "gift card", "gift_card"}

# Product type strings that explicitly mean coffee
COFFEE_PRODUCT_TYPES = {"coffee", "coffee beans", "specialty coffee"}

# Terms in vendor field that confirm it's a roast type
ROAST_VENDOR_KEYWORDS = {
    "light", "medium", "dark", "espresso", "blend", "roast", "filter", "omni"
}

# Known non-coffee vendor names
NON_COFFEE_VENDORS = {"tulum coffee", "subscribe & save", "subscribe and save"}


def strip_html(html_str: str) -> str:
    """Strip HTML tags from a string."""
    if not html_str:
        return ""
    return BeautifulSoup(html_str, "html.parser").get_text(separator=" ", strip=True)


def is_coffee(product: dict) -> bool:
    """Return True if the product is a coffee (not equipment/merch)."""
    tags = {t.lower().strip() for t in product.get("tags", [])}
    product_type = product.get("product_type", "").strip().lower()
    vendor = product.get("vendor", "").strip().lower()
    title = product.get("title", "").strip().lower()

    # Explicit merch tags → not coffee
    if tags & NON_COFFEE_TAGS:
        return False

    # gift card products
    if "gift_card" in product or "gift card" in title or "gift card" in (product_type or ""):
        return False

    # If product_type is explicitly 'Coffee' → definitely coffee
    if product_type in COFFEE_PRODUCT_TYPES:
        return True

    # If vendor contains roast-related keywords → coffee
    vendor_words = set(vendor.split())
    if vendor_words & ROAST_VENDOR_KEYWORDS:
        return True

    # Tags that explicitly say 'coffee'
    if "coffee" in tags:
        return True

    # If product_type is blank, check title for merch keywords
    merch_title_keywords = {
        "tote bag", "sticker", "badge", "spray bottle", "brew stick",
        "storage jar", "stash box", "filter paper", "subscription", "gift card",
        "sampler box", "sampler"
    }
    for kw in merch_title_keywords:
        if kw in title:
            return False

    # Default: if vendor is a known non-coffee vendor and no coffee signals, skip
    if vendor in NON_COFFEE_VENDORS:
        return False

    return True


def extract_roast(product: dict) -> str:
    """Extract roast type. Tulum puts it in 'vendor' e.g. 'Medium Roast'."""
    vendor = product.get("vendor", "").strip()

    roast_map = {
        "light roast": "Light",
        "light": "Light",
        "medium-light roast": "Medium-Light",
        "medium light roast": "Medium-Light",
        "medium roast": "Medium",
        "medium": "Medium",
        "medium-dark roast": "Medium-Dark",
        "medium dark roast": "Medium-Dark",
        "medium-dark": "Medium-Dark",
        "dark roast": "Dark",
        "dark": "Dark",
        "espresso roast": "Espresso",
        "filter roast": "Filter",
        "omni-roast": "Omni",
        "omni roast": "Omni",
    }

    vendor_lower = vendor.lower()
    for key, val in roast_map.items():
        if key in vendor_lower:
            return val

    return ""


def scrape_tulum() -> list[dict]:
    """Scrape all Tulum Coffee products using the Shopify JSON API."""
    base_url = "https://www.tulum.coffee"
    page_num = 1
    all_products = []

    print("Fetching Tulum products via JSON API...")

    while True:
        url = f"{base_url}/collections/all/products.json?limit=250&page={page_num}"
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()

        data = resp.json()
        products = data.get("products", [])

        if not products:
            break

        all_products.extend(products)
        print(f"  Page {page_num}: {len(products)} products fetched")

        if len(products) < 250:
            break
        page_num += 1

    print(f"Total raw products: {len(all_products)}")

    rows = []
    for p in all_products:
        if not is_coffee(p):
            print(f"  SKIP (non-coffee): {p['title']!r}")
            continue

        title = p.get("title", "").strip()
        variants = p.get("variants", [])
        images = p.get("images", [])
        handle = p.get("handle", "")

        # Price: use the lowest variant price
        prices = [float(v["price"]) for v in variants if v.get("price")]
        price_val = min(prices) if prices else 0.0
        price_str = f"Rs. {price_val:.2f}" if price_val else ""

        # Image
        img_url = images[0]["src"] if images else ""

        # Product URL
        product_url = f"{base_url}/products/{handle}"

        # Description (strip HTML)
        description = strip_html(p.get("body_html", ""))

        # Weights/variants (unique weight options from variant titles)
        weight_tokens = set()
        for v in variants:
            opt1 = v.get("option1", "") or ""
            # Only take option1 if it looks like a weight
            if opt1 and any(c.isdigit() for c in opt1):
                weight_tokens.add(opt1)
        variants_str = "; ".join(sorted(weight_tokens)) if weight_tokens else ""

        # Roast type
        roast = extract_roast(p)

        rows.append({
            "roaster": "Tulum",
            "name": title,
            "price": price_str,
            "currency": "Rs.",
            "description": description,
            "product_url": product_url,
            "image_url": img_url,
            "variants": variants_str,
            "roastType": roast,
        })
        print(f"  ADD: {title!r}  roast={roast!r}  price={price_str}")

    print(f"\n✅ Total coffee products: {len(rows)}")
    return rows


if __name__ == "__main__":
    products = scrape_tulum()

    if products:
        df = pd.DataFrame(products)
        # Output to the ScraperScripts dir so runner.py can pick it up
        out_path = Path(__file__).parent / "tulum_products_generic.csv"
        df.to_csv(out_path, index=False)
        print(f"Saved {len(df)} products to {out_path}")
    else:
        print("No products found.")
