import requests
from bs4 import BeautifulSoup
import csv

# Target URL
url = "https://curiouslifecoffee.com/store/"

# Send request
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}
response = requests.get(url, headers=headers)
response.raise_for_status()

# Parse HTML
soup = BeautifulSoup(response.text, "html.parser")

# Find all product list items
products = soup.find_all("li", class_="isotope-item")

data = []

for product in products:
    # Product link
    link_tag = product.find("a", href=True)
    product_url = link_tag['href'] if link_tag else ''

    # Image link
    img_tag = product.find("img")
    image_url = img_tag['src'] if img_tag else ''

    # Title
    title_tag = product.find("h4")
    title = title_tag.get_text(strip=True) if title_tag else ''

    # Description
    desc_tag = product.find("div", class_="description")
    description = desc_tag.get_text(strip=True) if desc_tag else ''

    # Price
    price_tag = product.find("div", class_="prod-price")
    price = price_tag.get_text(strip=True) if price_tag else ''

    data.append([title, description, price, image_url, product_url])

# Save to CSV
with open("curiouslife_coffee.csv", "w", newline="", encoding="utf-8") as file:
    writer = csv.writer(file)
    writer.writerow(["Title", "Description", "Price", "Image URL", "Product URL"])
    writer.writerows(data)

print(f"Scraped {len(data)} products and saved to curiouslife_coffee.csv")
