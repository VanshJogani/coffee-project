import re
import time
import csv
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Dict, Set, Tuple, Optional

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0 Safari/537.36"
    )
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


class GenericRoastersParser:
    """
    Class-based version of the generic roasters scraper.

    Usage:
        parser = GenericRoastersParser(coffeeroasters_file, already_scraped_names)
        parsed_files = parser.parse_all(parsed_output_dir)
    """

    def __init__(
        self,
        coffeeroasters_file: Path,
        already_scraped_names: Optional[Set[str]] = None,
    ) -> None:
        self.coffeeroasters_file = Path(coffeeroasters_file)
        self.already_scraped_names: Set[str] = already_scraped_names or set()

    @staticmethod
    def slugify(name: str) -> str:
        slug = name.lower()
        slug = re.sub(r"[^a-z0-9]+", "_", slug)
        slug = slug.strip("_")
        return slug or "roaster"

    def _parse_roaster_file(self) -> List[Tuple[str, str]]:
        roasters: List[Tuple[str, str]] = []
        with self.coffeeroasters_file.open(encoding="utf-8") as f:
            for raw in f:
                line = raw.strip()
                if not line or " - " not in line:
                    continue
                name, url = line.split(" - ", 1)
                name = name.strip()
                url = url.strip()

                if "not there" in url.lower():
                    continue
                if not url.startswith("http"):
                    continue
                if name in self.already_scraped_names:
                    continue

                roasters.append((name, url))
        return roasters

    def get_roasters(self) -> List[Tuple[str, str]]:
        """
        Public accessor for the list of (name, url) pairs to be scraped.
        """
        return self._parse_roaster_file()

    @staticmethod
    def _fetch_html(url: str, *, timeout: int = 30) -> str:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        resp.raise_for_status()
        return resp.text

    @staticmethod
    def _extract_listing_links(soup: BeautifulSoup, base_url: str) -> Dict[str, Optional[str]]:
        """
        Return mapping product_url -> optional listing image URL.
        """
        links: Dict[str, Optional[str]] = {}

        # WooCommerce / Shopify style product grid (added .grid__item for modern Shopify themes)
        for li in soup.select("ul.products li.product, .products .product, [data-aid='GRID_ITEM_RENDERED'], .item.product.product-item, .grid__item"):
            a = li.find("a", href=True)
            if not a:
                # Alchemist GoDaddy might have anchor wrapping the whole card
                if li.name == "a" and li.get("href"):
                    a = li
                else:
                    a = li.select_one("a[href]")
            
            if not a:
                continue
            
            href = a["href"]
            # Filter out irrelevant links but be less restrictive for GoDaddy /ols/ links
            if "/product" not in href and "/products" not in href and "/ols/" not in href:
                continue
            
            product_url = urljoin(base_url, href)

            img = li.find("img")
            img_src = None
            if img:
                img_src = img.get("data-src") or img.get("src") or img.get("data-srcset")
            
            # Alchemist fallback: role="img"
            if not img_src:
                role_img = li.select_one("[role='img']")
                if role_img and role_img.get("style"):
                    # Extract url from background-image
                    match = re.search(r"url\(['\"]?(.*?)['\"]?\)", role_img["style"])
                    if match:
                        img_src = match.group(1)

            links[product_url] = img_src

        # Fallback: any anchor that looks like a product detail page
        for a in soup.select("a[href*='/product'], a[href*='/products']"):
            href = a.get("href")
            if not href:
                continue
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

    @staticmethod
    def _extract_text(el) -> str:
        if not el:
            return ""
        return el.get_text(" ", strip=True)

    @classmethod
    def _parse_product_page(
        cls,
        html: str,
        product_url: str,
        roaster_name: str,
        fallback_image: Optional[str] = None,
    ) -> Product:
        soup = BeautifulSoup(html, "html.parser")

        # Product name
        name = ""
        for sel in [
            "h1.product__title",
            "h1.product_title.entry-title",
            "h1.product_title",
            "h1.product-single__title",
            "h1.entry-title",
            "[data-aid='PRODUCT_NAME']",
            "h1.page-title span.base",
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
            "[data-aid='PRODUCT_PRICE'], "
            ".price-wrapper .price, "
            ".price-item--regular, "
            ".price-item--sale, "
            ".price"
        )
        if price_el:
            price_text = cls._extract_text(price_el)
            price = price_text
            m = re.search(r"(₹|Rs\.?)", price_text)
            if m:
                currency = m.group(1)

        # Description
        description = ""
        for sel in [
            ".woocommerce-product-details__short-description",
            "div.product__description",
            ".product__description",
            "div.product-single__description",
            "#tab-description",
            ".product-short-description",
            "[data-aid='PRODUCT_DESCRIPTION']",
            ".product.attribute.description .value",
        ]:
            el = soup.select_one(sel)
            if el and el.get_text(strip=True):
                description = cls._extract_text(el)
                break

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
            "[data-aid='PRODUCT_IMAGE_RENDERED'] img, "
            ".gallery-placeholder img, "
            ".product img"
        )
        if img_el and (img_el.get("src") or img_el.get("data-src")):
            img_url = img_el.get("data-src") or img_el.get("src")

        # Fallback to meta image tags
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

        candidate_elements = []
        candidate_elements.extend(soup.select("select option"))
        candidate_elements.extend(soup.select("label"))
        candidate_elements.extend(soup.select(".product-form__input, .variant, .swatch__option"))

        for el in candidate_elements:
            text = cls._extract_text(el)
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

    def parse_single_roaster(
        self,
        roaster_name: str,
        start_url: str,
        output_dir: Path,
        delay: float = 0.8,
    ) -> Path | None:
        """
        Scrape a single roaster and write its parsed CSV under output_dir.
        Returns the path to the parsed CSV, or None if nothing was scraped.
        """
        print(f"\n=== {roaster_name} ===")
        print(f"Fetching listing: {start_url}")

        base_url = f"{urlparse(start_url).scheme}://{urlparse(start_url).netloc}"
        parsed = urlparse(start_url)

        all_links: Dict[str, Optional[str]] = {}

        # Paginated Shopify-style collections
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
                    html = self._fetch_html(page_url)
                except Exception as e:
                    print(f"  Stopping pagination at page {page} due to error: {e}")
                    break

                soup = BeautifulSoup(html, "html.parser")
                links = self._extract_listing_links(soup, base_url)

                new_items = {u: img for u, img in links.items() if u not in all_links}
                if not new_items:
                    break

                all_links.update(new_items)
                page += 1
        else:
            # Single-page listing
            try:
                html = self._fetch_html(start_url)
            except Exception as e:
                print(f"Failed to fetch listing for {roaster_name}: {e}")
                return None
            soup = BeautifulSoup(html, "html.parser")
            all_links = self._extract_listing_links(soup, base_url)

        if not all_links:
            print(f"No obvious product links found for {roaster_name} on {start_url}")
            return None

        print(f"Found {len(all_links)} candidate product URLs for {roaster_name}")

        products: List[Product] = []
        for idx, product_url in enumerate(sorted(all_links), start=1):
            print(f"  [{idx}/{len(all_links)}] {product_url}")
            try:
                prod_html = self._fetch_html(product_url)
                product = self._parse_product_page(
                    prod_html,
                    product_url,
                    roaster_name,
                    fallback_image=all_links.get(product_url),
                )
                products.append(product)
            except Exception as e:
                print(f"    Error scraping {product_url}: {e}")
            time.sleep(delay)

        if not products:
            print(f"No products scraped for {roaster_name}")
            return None

        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        slug = self.slugify(roaster_name)
        out_path = output_dir / f"{slug}_products_generic.csv"
        fieldnames = list(asdict(products[0]).keys())

        with out_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for p in products:
                writer.writerow(asdict(p))

        print(f"Saved {len(products)} products for {roaster_name} -> {out_path}")
        return out_path

    def parse_all(self, output_dir: Path, delay: float = 0.8) -> List[Tuple[str, Path]]:
        """
        Parse all roasters from coffeeroasters.txt and write their parsed CSVs
        under output_dir. Returns list of (roaster_name, parsed_csv_path).
        """
        results: List[Tuple[str, Path]] = []
        for name, url in self._parse_roaster_file():
            out_path = self.parse_single_roaster(name, url, output_dir, delay=delay)
            if out_path:
                results.append((name, out_path))
        return results


if __name__ == "__main__":
    # Example manual run (adjust paths as needed)
    project_root = Path(__file__).resolve().parents[1]
    coffeeroasters = project_root / "ScraperScripts" / "coffeeroastersupdated.txt"
    parsed_dir = project_root / "results" / "parsed"

    # Names that already have dedicated scrapers
    already = {
    }

    parser = GenericRoastersParser(coffeeroasters, already_scraped_names=already)
    parser.parse_all(parsed_dir)

