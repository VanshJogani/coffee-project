import requests
import pandas as pd
import json

def fetch_blue_tokai():
    # Blue Tokai has multiple collections, but the main one is roasted-and-ground-coffee-beans
    # We use the products.json Shopify endpoint which is more reliable
    url = "https://bluetokaicoffee.com/collections/roasted-and-ground-coffee-beans/products.json?limit=250"
    resp = requests.get(url)
    resp.raise_for_status()
    products_data = resp.json().get("products", [])
    
    rows = []
    for p in products_data:
        # Standardize fields for the pipeline
        variants = p.get("variants", [])
        # We'll take the first variant price as the default price
        first_variant = variants[0] if variants else {}
        
        row = {
            "roaster": "Blue Tokai",
            "name": p.get("title"),
            "price": first_variant.get("price"),
            "currency": "INR",
            "description": p.get("body_html", ""),
            "product_url": f"https://bluetokaicoffee.com/products/{p.get('handle')}",
            "image_url": p.get("images", [{}])[0].get("src") if p.get("images") else "",
            "variants": "; ".join([v.get("title", "") for v in variants])
        }
        rows.append(row)
    
    return rows

if __name__ == "__main__":
    print("Fetching Blue Tokai products via JSON API...")
    products = fetch_blue_tokai()
    df = pd.DataFrame(products)
    
    # Save to the standard parsed location
    output_path = "blue_tokai_products_generic.csv"
    df.to_csv(output_path, index=False)
    print(f"✅ Saved {len(df)} products to {output_path}")
