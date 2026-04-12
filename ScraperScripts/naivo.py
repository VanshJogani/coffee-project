# scrape_naivo_playwright.py
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import time
import csv
import re
import pandas as pd

START_URL = "https://naivo.in/product-category/all-coffee/"
OUTPUT_CSV = "naivo_products.csv"

def scroll_to_load(page, pause=1.0, max_iterations=60):
    """Scroll until no new product count increases or max iterations reached."""
    prev_count = 0
    for i in range(max_iterations):
        # Scroll to bottom
        page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(pause)
        # click any "load more" if site exposes a button (optional)
        # count product elements
        count = page.evaluate("""
            () => {
                const nodes = document.querySelectorAll('ul.products li.product, .products .product, .product-type-simple');
                return nodes ? nodes.length : 0;
            }
        """)
        if count == prev_count:
            # maybe there are lazy images; give one more brief wait and re-check
            time.sleep(0.5)
            count2 = page.evaluate("""
                () => {
                    const nodes = document.querySelectorAll('ul.products li.product, .products .product, .product-type-simple');
                    return nodes ? nodes.length : 0;
                }
            """)
            if count2 == prev_count:
                break
            else:
                prev_count = count2
        else:
            prev_count = count
    return prev_count

def extract_listing_links(page_content):
    soup = BeautifulSoup(page_content, "html.parser")
    links = {}

    # Case 1: main product grid (WooCommerce standard)
    for a in soup.select("ul.products li.product a.woocommerce-LoopProduct-link, ul.products li.product a"):
        href = a.get("href")
        if not href or "add-to-cart" in href:
            continue
        img = a.find("img")
        img_url = img.get("src") if img else None
        links[href] = img_url

    # Case 2: sidebar / other widgets (like your snippet)
    for wrap in soup.select(".vi-wcaio-sidebar-cart-footer-pd-desc-wrap"):
        a = wrap.select_one("a[href*='/product/']")
        if not a:
            continue
        href = a["href"]
        img = wrap.select_one("img")
        img_url = img.get("data-src") or img.get("src") if img else None
        links[href] = img_url

    return links


def parse_product_page(html, product_url, fallback_image=None):
    soup = BeautifulSoup(html, "html.parser")
    def text_or_none(sel_list):
        for sel in sel_list:
            el = soup.select_one(sel)
            if el and el.get_text(strip=True):
                return el.get_text(strip=True)
        return None

    name = text_or_none(["h1.product_title.entry-title", "h1.entry-title", "h1.product_title", "h1"])
    price = text_or_none(["p.price", ".price", ".woocommerce-Price-amount", ".product .price", ".single-product .price"])
    # try to standardize price whitespace
    if price:
        price = " ".join(price.split())

    # Many shops put custom attributes in a small table or in meta fields.
    # Try common label patterns: "Roast", "Origin", "Flavor" or "Tasting notes"
    roast = None
    origin = None
    flavor_notes = None

    # Look for attribute rows, key: value
    # Check for dl, table, ul.lists, or paragraphs
    # 1) find rows like <th>Roast</th><td>Espresso Roast</td>
    for row in soup.select("table.shop_attributes tr, table#product-attributes tr"):
        th = row.select_one("th") or row.select_one("td:first-child")
        td = row.select_one("td:last-child")
        if not th or not td:
            continue
        key = th.get_text(strip=True).lower()
        val = td.get_text(strip=True)
        if "roast" in key:
            roast = val
        elif "origin" in key:
            origin = val
        elif "flavor" in key or "tasting" in key or "notes" in key:
            flavor_notes = val

    # 2) find <p><strong>Roast:</strong> Espresso Roast</p> or <li><b>Origin:</b> India</li>
    for el in soup.select("p, li, div"):
        text = el.get_text(" ", strip=True)
        if ":" in text:
            # naive split
            parts = [p.strip() for p in text.split(":")]
            if len(parts) >= 2:
                key = parts[0].lower()
                val = ":".join(parts[1:]).strip()
                if "roast" in key and not roast:
                    roast = val
                if "origin" in key and not origin:
                    origin = val
                if ("flavor" in key or "tasting" in key or "notes" in key) and not flavor_notes:
                    flavor_notes = val

    # 3) fallback: search the whole page for "Origin - India" style or "Roast — Espresso Roast"
    full = soup.get_text(" ", strip=True)
    r = re.search(r"Roast[:\s—-]{1,3}([^,•\n\r]+)", full, re.IGNORECASE)
    if r and not roast:
        roast = r.group(1).strip()
    r = re.search(r"Origin[:\s—-]{1,3}([^,•\n\r]+)", full, re.IGNORECASE)
    if r and not origin:
        origin = r.group(1).strip()
    r = re.search(r"(Flavor(?:s)?|Tasting Notes?|Notes)[:\s—-]{1,3}([^•\n\r]+)", full, re.IGNORECASE)
    if r and not flavor_notes:
        flavor_notes = r.group(2).strip()

    # main image
    img_sel = soup.select_one(".woocommerce-product-gallery__image img, .product img, .entry-summary img")
    image_url = img_sel["src"] if img_sel and img_sel.get("src") else fallback_image

    return {
        "name": name or "",
        "price": price or "",
        "roast": roast or "",
        "origin": origin or "",
        "flavor_notes": flavor_notes or "",
        "product_url": product_url,
        "image_url": image_url or ""
    }

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent="Mozilla/5.0 (compatible; ScraperBot/1.0)")

        page = context.new_page()
        page.goto(START_URL, wait_until="domcontentloaded", timeout=60000)
        # scroll to load everything
        total = scroll_to_load(page, pause=1.0, max_iterations=80)
        print(f"Loaded approximately {total} items on listing.")

        html = page.content()
        print(html)
        links = extract_listing_links(html)
        print("Found", len(links), "product links.")
        results = []

        for idx, (prod_url, fallback_img) in enumerate(links.items(), start=1):
            print(f"[{idx}/{len(links)}] Fetching {prod_url}")
            try:
                prod_page = context.new_page()
                prod_page.goto(prod_url, wait_until="networkidle")
                time.sleep(0.6)  # polite pause
                prod_html = prod_page.content()
                #print(prod_html)
                item = parse_product_page(prod_html, prod_url, fallback_image=fallback_img)
                results.append(item)
                prod_page.close()
            except Exception as e:
                print("Error fetching", prod_url, e)

            time.sleep(0.5)  # small delay between product pages

        # Save to CSV
        df = pd.DataFrame(results, columns=["name","price","roast","origin","flavor_notes","product_url","image_url"])
        df.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
        print("Saved", OUTPUT_CSV)
        browser.close()

if __name__ == "__main__":
    main()
