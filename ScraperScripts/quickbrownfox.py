import requests
import json
import pandas as pd

def fetch_qbf():
    url = "https://www.qbfcoffee.com/collections/all-coffees/products.json?limit=250"
    resp = requests.get(url)
    resp.raise_for_status()
    products_data = resp.json().get("products", [])
    
    rows = []
    for p in products_data:
        variants = p.get("variants", [])
        first_variant = variants[0] if variants else {}
        
        row = {
            "roaster": "Quick Brown Fox",
            "name": p.get("title"),
            "price": first_variant.get("price"),
            "currency": "INR",
            "description": p.get("body_html", ""),
            "product_url": f"https://www.qbfcoffee.com/products/{p.get('handle')}",
            "image_url": p.get("images", [{}])[0].get("src") if p.get("images") else "",
            "variants": "; ".join([v.get("title", "") for v in variants])
        }
        rows.append(row)
    
    return rows

if __name__ == "__main__":
    print("Fetching Quick Brown Fox products...")
    products = fetch_qbf()
    df = pd.DataFrame(products)
    output_path = "quick_brown_fox_products_generic.csv"
    df.to_csv(output_path, index=False)
    print(f"✅ Saved {len(df)} products to {output_path}")
