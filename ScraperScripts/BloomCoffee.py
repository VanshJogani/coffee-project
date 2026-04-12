import requests
import json
import pandas as pd

def fetch_bloom_coffee():
    # Use products.json which is cleaner than parsing HTML for 'var meta'
    url = "https://bloomcoffeeroasters.in/collections/coffee/products.json?limit=250"
    resp = requests.get(url)
    resp.raise_for_status()
    products_data = resp.json().get("products", [])
    
    rows = []
    for p in products_data:
        variants = p.get("variants", [])
        first_variant = variants[0] if variants else {}
        
        row = {
            "roaster": "Bloom Coffee",
            "name": p.get("title"),
            "price": first_variant.get("price"),
            "currency": "INR",
            "description": p.get("body_html", ""),
            "product_url": f"https://bloomcoffeeroasters.in/products/{p.get('handle')}",
            "image_url": p.get("images", [{}])[0].get("src") if p.get("images") else "",
            "variants": "; ".join([v.get("title", "") for v in variants])
        }
        rows.append(row)
    
    return rows

if __name__ == "__main__":
    print("Fetching Bloom Coffee products...")
    products = fetch_bloom_coffee()
    df = pd.DataFrame(products)
    output_path = "bloom_coffee_products_generic.csv"
    df.to_csv(output_path, index=False)
    print(f"✅ Saved {len(df)} products to {output_path}")
