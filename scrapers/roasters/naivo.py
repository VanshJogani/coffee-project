"""
Naivo Coffee — WooCommerce store with dynamic/lazy loading.

Naivo's product listing page requires JavaScript to render and uses infinite
scroll to load products. A plain requests-based scraper misses most content.
This scraper uses Playwright to scroll the listing page, then fetches
individual product pages with requests (they render fine server-side).
"""
import re
import time
from typing import Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from scrapers.base.product import Product

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0 Safari/537.36"
    )
}


class NaivoScraper:
    ROASTER_NAME = "Naivo"
    START_URL = "https://naivo.in/product-category/all-coffee/"
    DELAY = 0.8

    def scrape(self) -> list[Product]:
        if sync_playwright is None:
            print("  ✗ Playwright not installed — run: pip install playwright && playwright install chromium")
            return []

        links = self._collect_links_playwright()
        if not links:
            print(f"  ⚠  No product links found for {self.ROASTER_NAME}")
            return []

        print(f"  Found {len(links)} product URLs for {self.ROASTER_NAME}")
        products: list[Product] = []

        import requests
        for idx, (url, fallback_img) in enumerate(links.items(), 1):
            print(f"    [{idx}/{len(links)}] {url}")
            try:
                resp = requests.get(url, headers=HEADERS, timeout=30)
                resp.raise_for_status()
                products.append(self._parse_product_page(resp.text, url, fallback_img))
            except Exception as exc:
                print(f"      ✗ Error: {exc}")
            time.sleep(self.DELAY)

        print(f"  → {len(products)} products scraped for {self.ROASTER_NAME}")
        return products

    def _collect_links_playwright(self) -> dict[str, Optional[str]]:
        """Use Playwright to scroll the listing page and collect all product links."""
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=HEADERS["User-Agent"]
            )
            page = context.new_page()
            page.goto(self.START_URL, wait_until="domcontentloaded", timeout=60000)

            # Scroll to load all lazy-loaded products
            prev_count = 0
            for _ in range(80):
                page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
                time.sleep(1.0)
                count = page.evaluate("""
                    () => {
                        const nodes = document.querySelectorAll(
                            'ul.products li.product, .products .product, .product-type-simple'
                        );
                        return nodes ? nodes.length : 0;
                    }
                """)
                if count == prev_count:
                    time.sleep(0.5)
                    count = page.evaluate("""
                        () => document.querySelectorAll(
                            'ul.products li.product, .products .product, .product-type-simple'
                        ).length
                    """)
                    if count == prev_count:
                        break
                prev_count = count

            print(f"  Loaded {prev_count} items on listing page via scroll")
            html = page.content()
            browser.close()

        return self._extract_listing_links(html)

    def _extract_listing_links(self, html: str) -> dict[str, Optional[str]]:
        soup = BeautifulSoup(html, "html.parser")
        links: dict[str, Optional[str]] = {}

        for card in soup.select("ul.products li.product, .products .product"):
            a = card.find("a", href=True)
            if not a:
                continue
            href = a.get("href", "")
            if "add-to-cart" in href or "cart" in href:
                continue
            if "/product/" not in href and "/products/" not in href:
                continue
            url = urljoin(self.START_URL, href)
            img = card.find("img")
            img_src = (img.get("data-src") or img.get("src")) if img else None
            links[url] = img_src

        return links

    def _parse_product_page(
        self, html: str, product_url: str, fallback_image: Optional[str] = None
    ) -> Product:
        soup = BeautifulSoup(html, "html.parser")

        name = self._first_text(soup, [
            "h1.product_title.entry-title",
            "h1.product_title",
            "h1.entry-title",
            "h1",
        ])

        # Price
        price_text = ""
        currency = ""
        for sel in [
            ".price .woocommerce-Price-amount",
            ".price .amount",
            "p.price",
            ".price",
        ]:
            el = soup.select_one(sel)
            if el and re.search(r"\d", el.get_text()):
                price_text = el.get_text(" ", strip=True)
                m = re.search(r"(₹|Rs\.?)", price_text)
                currency = m.group(1) if m else "₹"
                break

        # Description
        description = self._first_text(soup, [
            ".woocommerce-product-details__short-description",
            "#tab-description",
            ".product-short-description",
            ".product-description",
        ])
        if not description:
            meta = soup.find("meta", attrs={"name": "description"})
            if meta and meta.get("content"):
                description = meta["content"].strip()

        # Extract structured attributes (roast, origin, tasting notes)
        roast = ""
        full_text = soup.get_text(" ", strip=True)

        # Check attribute table
        for row in soup.select("table.shop_attributes tr, table tr"):
            th = row.select_one("th")
            td = row.select_one("td:last-child")
            if not th or not td:
                continue
            key = th.get_text(strip=True).lower()
            val = td.get_text(strip=True)
            if "roast" in key:
                roast = val

        # Fallback: regex in full text
        if not roast:
            m = re.search(r"Roast[:\s—\-]{1,3}([^,•\n\r]{3,40})", full_text, re.IGNORECASE)
            if m:
                roast = m.group(1).strip()

        # Image
        img_url = ""
        for sel in [
            ".woocommerce-product-gallery__image img",
            ".product img",
            ".entry-summary img",
        ]:
            el = soup.select_one(sel)
            if el and (el.get("src") or el.get("data-src")):
                img_url = el.get("data-src") or el.get("src")
                break
        if not img_url:
            meta_img = soup.find("meta", attrs={"property": "og:image"})
            if meta_img and meta_img.get("content"):
                img_url = meta_img["content"]
        if not img_url and fallback_image:
            img_url = fallback_image

        # Weight variants
        weight_pat = re.compile(r"\b(\d+(?:\.\d+)?)\s*(kg|g|gm|grams)\b", re.IGNORECASE)
        weights: set[str] = set()
        for el in soup.select("select option") + soup.select("label") + soup.select(".variation"):
            for m in weight_pat.finditer(el.get_text(" ", strip=True)):
                qty, unit = m.groups()
                unit = "g" if unit.lower() in {"gm", "grams"} else unit.lower()
                weights.add(f"{qty}{unit}")
        # Also check product name
        if not weights:
            for m in weight_pat.finditer(name):
                qty, unit = m.groups()
                unit = "g" if unit.lower() in {"gm", "grams"} else unit.lower()
                weights.add(f"{qty}{unit}")

        variant_prices = "; ".join(sorted(weights))

        return Product(
            roaster=self.ROASTER_NAME,
            name=name,
            price=price_text,
            currency=currency,
            description=description,
            product_url=product_url,
            image_url=img_url,
            variant_prices=variant_prices,
            roast_type=roast,
        )

    @staticmethod
    def _first_text(soup: BeautifulSoup, selectors: list[str]) -> str:
        for sel in selectors:
            el = soup.select_one(sel)
            if el:
                text = el.get_text(" ", strip=True)
                if text:
                    return text
        return ""
