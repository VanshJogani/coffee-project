import requests
from bs4 import BeautifulSoup
import json
import re
import csv

url = "https://www.savorworksroasters.com/collections/coffee"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

# Fetch page
response = requests.get(url, headers=headers)
soup = BeautifulSoup(response.text, "html.parser")

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

# Flatten product + variants into rows
rows = []
for product in products_data:
    product_id = product.get("id")
    product_vendor = product.get("vendor")
    product_type = product.get("type")
    for variant in product.get("variants", []):
        rows.append({
            "product_id": product_id,
            "product_name": variant.get("name"),
            "variant_title": variant.get("public_title"),
            "price": variant.get("price") / 100.0,  # Convert to INR
            "vendor": product_vendor,
            "type": product_type
        })

# Save to CSV
fname = "savorworks_meta_products.csv"
with open(fname, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)

print(f"✅ Extracted {len(rows)} variants and saved to {fname}")
