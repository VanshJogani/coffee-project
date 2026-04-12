import requests
import json
import csv

# Shopify collection JSON endpoint
COLLECTION_URL = "https://www.arakucoffee.in/collections/coffee/products.json"
CSV_FILENAME = "araku_products.csv"


def fetch_shopify_products(url):
    products = []
    page = 1

    while True:
        paged_url = f"{url}?page={page}"
        print(f"Fetching page {page}...")
        response = requests.get(paged_url)

        if response.status_code != 200:
            print(f"Failed to fetch page {page}, status code: {response.status_code}")
            break

        data = response.json()
        if "products" not in data or not data["products"]:
            print("No more products found.")
            break

        products.extend(data["products"])
        page += 1

    return products


def extract_product_details(products):
    extracted = []
    for p in products:
        product_info = {
            "title": p.get("title"),
            "handle": p.get("handle"),
            "description": p.get("body_html", "").replace("\n", " ").strip(),
            "price": None,
            "currency": None,
            "tags": ", ".join(p.get("tags", [])),
            "variants": []
        }

        if p.get("variants"):
            product_info["price"] = p["variants"][0].get("price")
            product_info["currency"] = p["variants"][0].get("currency")

            product_info["variants"] = [
                f"{v.get('title')} (₹{v.get('price')})"
                for v in p["variants"]
            ]

        extracted.append(product_info)
    return extracted


def save_to_csv(data, filename):
    if not data:
        print("No data to save.")
        return

    # CSV headers
    keys = ["title", "handle", "description", "price", "currency", "tags", "variants"]

    with open(filename, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        for row in data:
            row["variants"] = "; ".join(row["variants"])  # convert list to string
            writer.writerow(row)

    print(f"Data saved to {filename}")


if __name__ == "__main__":
    all_products = fetch_shopify_products(COLLECTION_URL)
    print(f"Total products found: {len(all_products)}")

    extracted_data = extract_product_details(all_products)
    save_to_csv(extracted_data, CSV_FILENAME)
