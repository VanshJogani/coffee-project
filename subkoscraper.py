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
        yield {
            "title": p.get("title"),
            "handle": p.get("handle"),
            "url": f"https://www.subko.coffee/products/{p.get('handle')}",
            "description": p.get("body_html", "").strip(),
            "price": p["variants"][0].get("price") if p.get("variants") else None,
            "currency": p["variants"][0].get("currency") if p.get("variants") else None,
            "tags": ", ".join(p.get("tags", [])),
            "variants": "; ".join([
                f"{v.get('title')} (₹{v.get('price')})" for v in p.get("variants", [])
            ])
        }

def save_to_csv(data, filename):
    rows = list(data)
    if not rows:
        print("No products to write.")
        return
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
