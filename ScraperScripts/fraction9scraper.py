import requests
import json
import pandas as pd

def fetch_fraction9():
    url = "https://www.fraction9coffee.com/collections/all/products.json?limit=250"
    resp = requests.get(url)
    resp.raise_for_status()
    products_data = resp.json().get("products", [])
    
    rows = []
    for p in products_data:
        variants = p.get("variants", [])
        first_variant = variants[0] if variants else {}
        
        row = {
            "roaster": "Fraction 9",
            "name": p.get("title"),
            "price": first_variant.get("price"),
            "currency": "INR",
            "description": p.get("body_html", ""),
            "product_url": f"https://www.fraction9coffee.com/products/{p.get('handle')}",
            "image_url": p.get("images", [{}])[0].get("src") if p.get("images") else "",
            "variants": "; ".join([v.get("title", "") for v in variants])
        }
        rows.append(row)
    
    return rows

if __name__ == "__main__":
    print("Fetching Fraction 9 products...")
    products = fetch_fraction9()
    df = pd.DataFrame(products)
    output_path = "fraction9_products_generic.csv"
    df.to_csv(output_path, index=False)
    print(f"✅ Saved {len(df)} products to {output_path}")
