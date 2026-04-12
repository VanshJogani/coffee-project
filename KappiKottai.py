import requests
import re
import json
import csv

# Target URL
url = "https://kapikottai.coffee/collections/all"

# Fetch page content
response = requests.get(url)
html = response.text

# Extract the meta JSON from the script tag
match = re.search(r'var meta = ({.*?});', html, re.DOTALL)
if not match:
    raise ValueError("Could not find 'meta' JSON on the page")

meta = json.loads(match.group(1))

# Extract products and variants
products = []
for product in meta['products']:
    product_title = product.get('title', '')
    product_type = product.get('type', '')
    product_vendor = product.get('vendor', '')

    for variant in product['variants']:
        products.append({
            'product_id': product['id'],
            'product_title': product_title,
            'product_type': product_type,
            'vendor': product_vendor,
            'variant_id': variant['id'],
            'variant_name': variant['name'],
            'variant_title': variant.get('public_title', ''),
            'price_inr': variant['price'] / 100,  # convert cents to INR
            'sku': variant['sku'] if variant['sku'] else None
        })

# Save to CSV
filename = 'kapikottai_products.csv'
with open(filename, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=products[0].keys())
    writer.writeheader()
    writer.writerows(products)

print(f"✅ Saved {len(products)} variants to {filename}")
