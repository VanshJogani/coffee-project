import requests
from bs4 import BeautifulSoup
import time

SHOPIFY_STORE_URL = "https://examplestore.myshopify.com"  # Change this to the target store
PRODUCTS_PER_PAGE = 50  # Shopify's max per page is usually 50


def fetch_all_products(store_url):
    """
    Fetch all products from Shopify store using /products.json with pagination.
    Returns a list of product dicts.
    """
    all_products = []
    page = 1
    while True:
        url = f"{store_url}/products.json?limit={PRODUCTS_PER_PAGE}&page={page}"
        resp = requests.get(url)
        if resp.status_code != 200:
            print(f"Failed to fetch page {page}: {resp.status_code}")
            break
        data = resp.json()
        products = data.get("products", [])
        if not products:
            break
        all_products.extend(products)
        print(f"Fetched {len(products)} products from page {page}")
        if len(products) < PRODUCTS_PER_PAGE:
            break  # Last page
        page += 1
        time.sleep(0.5)  # Be polite to the server
    return all_products


def fetch_product_page_details(store_url, handle):
    """
    Fetch extra details from the product HTML page (if needed).
    Returns a dict of extra details.
    """
    url = f"{store_url}/products/{handle}"
    resp = requests.get(url)
    if resp.status_code != 200:
        print(f"Failed to fetch product page {handle}: {resp.status_code}")
        return {}
    soup = BeautifulSoup(resp.text, "html.parser")
    # Example: Extract meta description
    meta_desc = soup.find("meta", {"name": "description"})
    description = meta_desc["content"] if meta_desc else None
    # Add more parsing as needed
    return {
        "meta_description": description,
        # Add more fields here
    }


def main():
    store_url = SHOPIFY_STORE_URL.rstrip("/")
    print(f"Fetching all products from {store_url}")
    products = fetch_all_products(store_url)
    print(f"Total products fetched: {len(products)}")

    # Fetch extra details for each product
    for product in products:
        handle = product.get("handle")
        if not handle:
            continue
        extra = fetch_product_page_details(store_url, handle)
        product["extra_details"] = extra
        time.sleep(0.5)  # Be polite

    # Save or process products as needed
    print(products[0] if products else "No products found.")

if __name__ == "__main__":
    main()
