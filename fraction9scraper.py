import requests
from bs4 import BeautifulSoup
import pandas as pd

BASE_URL = "https://www.fraction9coffee.com"
COLLECTIONS_URL = BASE_URL + "/collections"

# Step A: Scrape collections list
resp = requests.get(COLLECTIONS_URL)
soup = BeautifulSoup(resp.text, "html.parser")

collection_links = {}
for a in soup.select("a[href^='/collections/']"):
    href = a.get("href")
    name = a.get_text(strip=True).replace("View collection", "").strip()
    if href and name:
        collection_links[name] = BASE_URL + href

print("Found collections:", list(collection_links.keys()))

# Step B: For each collection, scrape product names & prices
all_products = []
for col_name, col_url in collection_links.items():
    r = requests.get(col_url)
    csoup = BeautifulSoup(r.text, "html.parser")

    for prod in csoup.select("a[href*='/products/']"):
        title = prod.get_text(strip=True)
        link = prod.get("href")
        price_el = prod.find_next(string=lambda x: "Rs." in x)
        price = price_el.strip() if price_el else None

        all_products.append({
            "collection": col_name,
            "product_title": title,
            "product_url": BASE_URL + link,
            "price": price
        })

print(f"Scraped {len(all_products)} products across collections")

# Step C: Optional — save to CSV
df = pd.DataFrame(all_products)
df.to_csv("fraction9_collections_products.csv", index=False)
print("Saved to fraction9_collections_products.csv")
