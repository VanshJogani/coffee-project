import requests
import json
import csv

# Endpoint for the microlot collection
COLLECTION_API_URL = "https://www.subko.coffee/collections/specialty-arabica-microlots/products.json"
CSV_FILENAME = "subko_microlots.csv"

def fetch_products(api_url):
    products = []
    page = 1
    while True:
        resp = requests.get(f"{api_url}?page={page}")
        if resp.status_code != 200:
            print(f"Failed at page {page} — status {resp.status_code}")
            break
        data = resp.json()
        batch = data.get("products", [])
        if not batch:
            break
        products.extend(batch)
        page += 1
    return products

def extract_details(products):
    for p in products:
        variants = p.get("variants", [])
        first_variant = variants[0] if variants else {}
        
        yield {
            "roaster": "Subko",
            "name": p.get("title"),
            "price": first_variant.get("price"),
            "currency": first_variant.get("currency") if first_variant.get("currency") else "INR",
            "description": p.get("body_html", "").strip(),
            "product_url": f"https://www.subko.coffee/products/{p.get('handle')}",
            "image_url": p.get("images", [{}])[0].get("src") if p.get("images") else "",
            "variants": "; ".join([v.get("title", "") for v in variants])
        }

def save_to_csv(data, filename):
    rows = list(data)
    if not rows:
        print("No products to write.")
        return
    # Standardize filename to match generic pattern
    filename = "subko_products_generic.csv"
    with open(filename, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print(f"Saved {len(rows)} products to {filename}")

if __name__ == "__main__":
    prods = fetch_products(COLLECTION_API_URL)
    print(f"Found {len(prods)} microlot products")
    details = extract_details(prods)
    save_to_csv(details, CSV_FILENAME)
