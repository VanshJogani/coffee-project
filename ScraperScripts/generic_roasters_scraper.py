import re
import time
import csv
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Dict, Set, Tuple

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse


COFFEE_ROASTERS_FILE = Path(__file__).with_name("coffeeroasters.txt")


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0 Safari/537.36"
    )
}


# Sites that already have dedicated scrapers in this repo
ALREADY_SCRAPED_NAMES: Set[str] = {
    "Blue Tokai",
    "Fraction 9",
    "Kappi Kottai",
    "Bloom Coffee",
    "Savorworks",
    "Araku",
    "Naivo",
    "Quick Brown Fox",
    "Curios Life",
    "Subko",
}


@dataclass
class Product:
    roaster: str
    name: str
    price: str
    currency: str
    description: str
    product_url: str
    image_url: str
    variants: str  # e.g. "250g; 500g"


def slugify(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    slug = slug.strip("_")
    return slug or "roaster"


def parse_roaster_file(path: Path) -> List[Tuple[str, str]]:
    """Return list of (name, url) pairs for roasters that don't yet have scripts."""
    roasters: List[Tuple[str, str]] = []
    with path.open(encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or " - " not in line:
                continue
            name, url = line.split(" - ", 1)
            name = name.strip()
            url = url.strip()

            # Skip comments / notes
            if "not there" in url.lower():
                continue

            if not url.startswith("http"):
                continue

            if name in ALREADY_SCRAPED_NAMES:
                continue

            roasters.append((name, url))

    return roasters


def fetch_html(url: str, *, timeout: int = 30) -> str:
    resp = requests.get(url, headers=HEADERS, timeout=timeout)
    resp.raise_for_status()
    return resp.text


def extract_listing_links(soup: BeautifulSoup, base_url: str) -> Dict[str, str | None]:
    """
    Try to extract individual product links from a generic listing / homepage.

    Works for many Shopify / WooCommerce style sites by looking for /product/ or /products/.
    """
    links: Dict[str, str | None] = {}

    # WooCommerce / Shopify style product grid
    for li in soup.select("ul.products li.product, .products .product"):
        a = li.find("a", href=True)
        if not a:
            continue
        href = a["href"]
        if "/product" not in href and "/products" not in href:
            continue
        product_url = urljoin(base_url, href)

        # Try to capture a product image from the listing card
        img = li.find("img")
        img_src = None
        if img:
            img_src = img.get("data-src") or img.get("src") or img.get("data-srcset")

        links[product_url] = img_src

    # Fallback: any anchor that looks like a product detail page
    for a in soup.select("a[href*='/product'], a[href*='/products']"):
        href = a.get("href")
        if not href:
            continue
        # Ignore cart / add-to-cart etc.
        if "cart" in href or "checkout" in href:
            continue

        product_url = urljoin(base_url, href)
        if product_url not in links:
            img = a.find("img")
            img_src = None
            if img:
                img_src = img.get("data-src") or img.get("src") or img.get("data-srcset")
            links[product_url] = img_src

    return links


def extract_text(el) -> str:
    if not el:
        return ""
    return el.get_text(" ", strip=True)


def parse_product_page(html: str, product_url: str, roaster_name: str, fallback_image: str | None = None) -> Product:
    soup = BeautifulSoup(html, "html.parser")

    # Product name
    name = ""
    for sel in [
        "h1.product_title.entry-title",
        "h1.product_title",
        "h1.product-single__title",
        "h1.entry-title",
        "h1",
    ]:
        el = soup.select_one(sel)
        if el and el.get_text(strip=True):
            name = el.get_text(strip=True)
            break

    # Price
    price = ""
    currency = ""
    price_el = soup.select_one(
        ".price .woocommerce-Price-amount, "
        ".price .amount, "
        ".product__price, "
        ".product-single__price, "
        ".price"
    )
    if price_el:
        price_text = extract_text(price_el)
        price = price_text
        m = re.search(r"(₹|Rs\.?)", price_text)
        if m:
            currency = m.group(1)

    # Description
    description = ""
    for sel in [
        ".woocommerce-product-details__short-description",
        "div.product__description",
        "div.product-single__description",
        "#tab-description",
        ".product-short-description",
    ]:
        el = soup.select_one(sel)
        if el and el.get_text(strip=True):
            description = extract_text(el)
            break

    # Fallback to meta description tags
    if not description:
        meta = soup.find("meta", attrs={"name": "description"}) or soup.find(
            "meta", attrs={"property": "og:description"}
        )
        if meta and meta.get("content"):
            description = meta["content"].strip()

    # Image
    img_url = ""
    img_el = soup.select_one(
        ".woocommerce-product-gallery__image img, "
        ".product-single__photo img, "
        ".product__image img, "
        ".product img"
    )
    if img_el and (img_el.get("src") or img_el.get("data-src")):
        img_url = img_el.get("data-src") or img_el.get("src")

    # Fallback to meta image tags (common on many themes)
    if not img_url:
        meta_img = soup.find("meta", attrs={"property": "og:image"}) or soup.find(
            "meta", attrs={"name": "twitter:image"}
        )
        if meta_img and meta_img.get("content"):
            img_url = meta_img["content"].strip()

    # Last resort: use listing image passed in
    if not img_url and fallback_image:
        img_url = fallback_image

    # Variants / weights such as 250g, 1kg etc.
    weight_pattern = re.compile(r"\b(\d+(?:\.\d+)?)\s*(kg|g|gm|grams)\b", re.IGNORECASE)
    weights = set()

    # Common places where variant text shows up
    candidate_elements = []
    candidate_elements.extend(soup.select("select option"))
    candidate_elements.extend(soup.select("label"))
    candidate_elements.extend(soup.select(".product-form__input, .variant, .swatch__option"))

    for el in candidate_elements:
        text = extract_text(el)
        for m in weight_pattern.finditer(text):
            qty, unit = m.groups()
            unit_norm = unit.lower()
            if unit_norm in {"gm", "grams"}:
                unit_norm = "g"
            weight_str = f"{qty}{unit_norm}"
            weights.add(weight_str)

    variants_str = "; ".join(sorted(weights)) if weights else ""

    return Product(
        roaster=roaster_name,
        name=name,
        price=price,
        currency=currency,
        description=description,
        product_url=product_url,
        image_url=img_url,
        variants=variants_str,
    )


def scrape_roaster(roaster_name: str, start_url: str, delay: float = 0.8) -> List[Product]:
    print(f"\n=== {roaster_name} ===")
    print(f"Fetching listing: {start_url}")
    base_url = f"{urlparse(start_url).scheme}://{urlparse(start_url).netloc}"
    parsed = urlparse(start_url)

    # Collect links (and optional listing images) across possible paginated listing pages
    all_links: Dict[str, str | None] = {}

    # Many roasters use Shopify collection pages like /collections/... with ?page=2,3,...
    if "collections/" in parsed.path:
        page = 1
        while True:
            if page == 1:
                page_url = start_url
            else:
                sep = "&" if "?" in start_url else "?"
                page_url = f"{start_url}{sep}page={page}"

            print(f"  Loading listing page {page}: {page_url}")
            try:
                html = fetch_html(page_url)
            except Exception as e:
                print(f"  Stopping pagination at page {page} due to error: {e}")
                break

            soup = BeautifulSoup(html, "html.parser")
            links = extract_listing_links(soup, base_url)

            # If no links or no new links, stop paginating
            new_items = {u: img for u, img in links.items() if u not in all_links}
            if not new_items:
                break

            all_links.update(new_items)
            page += 1
    else:
        # Non-collection URLs: just scrape a single page
        try:
            html = fetch_html(start_url)
        except Exception as e:
            print(f"Failed to fetch listing for {roaster_name}: {e}")
            return []
        soup = BeautifulSoup(html, "html.parser")
        all_links = extract_listing_links(soup, base_url)

    if not all_links:
        print(f"No obvious product links found for {roaster_name} on {start_url}")
        return []

    print(f"Found {len(all_links)} candidate product URLs for {roaster_name}")

    products: List[Product] = []
    for idx, product_url in enumerate(sorted(all_links), start=1):
        print(f"  [{idx}/{len(all_links)}] {product_url}")
        try:
            prod_html = fetch_html(product_url)
            product = parse_product_page(
                prod_html,
                product_url,
                roaster_name,
                fallback_image=all_links.get(product_url),
            )
            products.append(product)
        except Exception as e:
            print(f"    Error scraping {product_url}: {e}")
        time.sleep(delay)

    return products


def save_roaster_csv(roaster_name: str, products: List[Product]) -> str:
    if not products:
        print(f"No products scraped for {roaster_name}, skipping CSV.")
        return ""

    slug = slugify(roaster_name)
    filename = f"{slug}_products_generic.csv"
    fieldnames = list(asdict(products[0]).keys())

    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for p in products:
            writer.writerow(asdict(p))

    print(f"Saved {len(products)} products for {roaster_name} -> {filename}")
    return filename


def main():
    roasters = parse_roaster_file(COFFEE_ROASTERS_FILE)
    print(f"Total roasters in file (excluding ones with dedicated scripts): {len(roasters)}")

    for name, url in roasters:
        products = scrape_roaster(name, url)
        save_roaster_csv(name, products)


if __name__ == "__main__":
    main()

