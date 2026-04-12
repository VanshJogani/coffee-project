import json
import requests
from bs4 import BeautifulSoup
import pandas as pd

BASE_URL = "https://bluetokaicoffee.com"
COLLECTION_URL = f"{BASE_URL}/collections/roasted-and-ground-coffee-beans"

# Step 1: Fetch all product links
resp = requests.get(COLLECTION_URL)
soup = BeautifulSoup(resp.text, "html.parser")

product_links = {
    BASE_URL + a.get("href") for a in soup.select("a.grid-product__link") if a.get("href") and "/products" in a.get("href")
}

print(f"Found {len(product_links)} products")

# Step 2: Scrape details from each product page
products = []

for link in product_links:
    try:
        r = requests.get(link)
        psoup = BeautifulSoup(r.text, "html.parser")

        product_div = psoup.find("div", class_="product-section")
        print(product_div)
        if not product_div:
            print(f"Skipping {link}: No product-section div")
            continue

        # Extract from data attributes
        product_title = product_div.get("data-product-title", "").strip()
        product_id = product_div.get("data-product-id", "")
        product_handle = product_div.get("data-product-handle", "")
        product_url = product_div.get("data-product-url", link)

        # Extract JSON-LD for price and description
        json_script = product_div.find("script", type="application/ld+json")
        price = currency = availability = description = None

        if json_script:
            try:
                data = json.loads(json_script.string)
                price = data.get("offers", [{}])[0].get("price")
                currency = data.get("offers", [{}])[0].get("priceCurrency")
                availability = data.get("offers", [{}])[0].get("availability")
                description = data.get("description")
            except Exception as e:
                print(f"JSON parse error on {link}: {e}")

        # Fallback for name
        if not product_title:
            name_tag = psoup.select_one("h1.product__title")
            product_title = name_tag.get_text(strip=True) if name_tag else "Unknown"

        # Extract tasting notes, roast, process from description block
        tasting_notes = roast_level = process = None
        desc_tag = psoup.select_one("div.product__description")
        if desc_tag:
            desc_text = desc_tag.get_text(" ", strip=True).lower()
            if "tasting notes" in desc_text:
                tasting_notes = desc_text.split("tasting notes")[1].split(".")[0].strip(": ")
            if "roast" in desc_text:
                roast_level = desc_text.split("roast")[1].split(".")[0].strip(": ")
            if "process" in desc_text:
                process = desc_text.split("process")[1].split(".")[0].strip(": ")

        roast_tag = psoup.select_one("p.coffee-roast-lavel-item span")
        roast_level = roast_tag.get_text(strip=True) if roast_tag else None

        products.append({
            "name": product_title,
            "price": price,
            "currency": currency,
            "availability": availability,
            "roast_level": roast_level,
            "process": process,
            "tasting_notes": tasting_notes,
            "description": description,
            "product_id": product_id,
            "product_handle": product_handle,
            "url": product_url
        })

        print(f"✔ Scraped: {product_title}")

    except Exception as e:
        print(f"Error scraping {link}: {e}")

# Step 3: Save the data to CSV
df = pd.DataFrame(products)
df.to_csv("blue_tokai_products.csv", index=False)
print("✅ Saved blue_tokai_products.csv with", len(df), "records")
