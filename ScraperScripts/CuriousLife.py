import requests
from bs4 import BeautifulSoup
import pandas as pd

def fetch_curious_life():
    url = "https://curiouslifecoffee.com/store/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    products = soup.find_all("li", class_="isotope-item")
    
    rows = []
    for product in products:
        link_tag = product.find("a", href=True)
        product_url = link_tag['href'] if link_tag else ''
        img_tag = product.find("img")
        image_url = img_tag['src'] if img_tag else ''
        title_tag = product.find("h4")
        name = title_tag.get_text(strip=True) if title_tag else ''
        desc_tag = product.find("div", class_="description")
        description = desc_tag.get_text(strip=True) if desc_tag else ''
        price_tag = product.find("div", class_="prod-price")
        price = price_tag.get_text(strip=True) if price_tag else ''
        
        rows.append({
            "roaster": "Curious Life",
            "name": name,
            "price": price,
            "currency": "INR",
            "description": description,
            "product_url": product_url,
            "image_url": image_url,
            "variants": "" # Generic listing doesn't show variants
        })
    return rows

if __name__ == "__main__":
    print("Fetching Curious Life products...")
    products = fetch_curious_life()
    df = pd.DataFrame(products)
    output_path = "curious_life_products_generic.csv"
    df.to_csv(output_path, index=False)
    print(f"✅ Saved {len(df)} products to {output_path}")
