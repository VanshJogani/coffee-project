import requests
import json
import pandas as pd

def fetch_araku():
    url = "https://www.arakucoffee.in/collections/coffee/products.json?limit=250"
    url = "https://www.arakucoffee.in/collections/coffee/products.json" # Removed ?limit=250 from base URL
    all_products = []
    page = 1
    while True:
        resp = requests.get(f"{url}?limit=250&page={page}") # Corrected URL concatenation for limit and page
        resp.raise_for_status()
        products_data = resp.json().get("products", [])
        if not products_data:
            break
        all_products.extend(products_data)
        page += 1
    
    rows = []
    for p in all_products:
        variants = p.get("variants", [])
        first_variant = variants[0] if variants else {}
        
        row = {
            "roaster": "Araku",
            "name": p.get("title"),
            "price": first_variant.get("price"),
            "currency": first_variant.get("currency") if first_variant.get("currency") else "INR",
            "description": p.get("body_html", ""),
            "product_url": f"https://www.arakucoffee.in/products/{p.get('handle')}",
            "image_url": p.get("images", [{}])[0].get("src") if p.get("images") else "",
            "variants": "; ".join([v.get("title", "") for v in variants])
        }
        rows.append(row)
    
    return rows

if __name__ == "__main__":
    print("Fetching Araku products...")
    products = fetch_araku()
    df = pd.DataFrame(products)
    output_path = "araku_products_generic.csv"
    df.to_csv(output_path, index=False)
    print(f"✅ Saved {len(df)} products to {output_path}")
