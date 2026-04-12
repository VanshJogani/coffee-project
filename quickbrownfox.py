import requests
from bs4 import BeautifulSoup
import json
import re
import csv

url = "https://www.qbfcoffee.com/collections/all-coffees"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

# Fetch page
response = requests.get(url, headers=headers)
soup = BeautifulSoup(response.text, "html.parser")
print(soup)

# Find the <script> tag that contains 'var meta ='
script_tag = soup.find("script", text=re.compile(r"var meta ="))
if not script_tag:
    raise ValueError("Couldn't find 'meta' script on the page")

# Extract JSON inside var meta = {...};
match = re.search(r"var meta = ({.*});", script_tag.string)
if not match:
    raise ValueError("Couldn't extract JSON from script")

meta_json = json.loads(match.group(1))

# Extract products
products_data = meta_json.get("products", [])

# Build a map for descriptions by scraping <a> links to product pages
description_map = {}
product_cards = soup.select("a.full-unstyled-link")  # All product links
for card in product_cards:
    product_url = "https://www.qbfcoffee.com" + card.get("href")
    product_page = requests.get(product_url, headers=headers)
    psoup = BeautifulSoup(product_page.text, "html.parser")

    # Try meta description first
    meta_desc = psoup.find("meta", attrs={"property": "og:description"})
    if meta_desc:
        description = meta_desc.get("content", "").strip()
    else:
        # Fallback to product description div
        desc_div = psoup.select_one(".product__description")
        description = desc_div.get_text(strip=True) if desc_div else ""

    description_map[card.get("href").split("/")[-1]] = description

# Flatten product + variants into rows
rows = []
for product in products_data:
    product_id = product.get("id")
    product_vendor = product.get("vendor")
    product_type = product.get("type")

    # Extract description using handle
    handle = product.get("handle")
    description = description_map.get(handle, "")

    for variant in product.get("variants", []):
        rows.append({
            "product_id": product_id,
            "product_name": variant.get("name"),
            "variant_title": variant.get("public_title"),
            "price": variant.get("price") / 100.0,  # Convert to INR
            "vendor": product_vendor,
            "type": product_type,
            "description": description
        })

# Save to CSV
fname = "quickbrown_meta_products_with_desc.csv"
with open(fname, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)

print(f"✅ Extracted {len(rows)} variants with descriptions and saved to {fname}")
