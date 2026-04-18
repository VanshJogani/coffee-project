"""
HtmlScraper — base class for roasters whose sites require HTML parsing
(WooCommerce, custom themes, simple static shops).

Subclasses override:
  - ROASTER_NAME, START_URL
  - Optionally: _get_product_links(), _parse_product_page()
    for site-specific selectors.

The default implementation works well for standard WooCommerce shops.
"""
from __future__ import annotations

import json
import re
import time
from abc import ABC, abstractmethod
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from scrapers.base.product import Product


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0 Safari/537.36"
    )
}


class HtmlScraper(ABC):
    """
    Base class for HTML-scraped roasters.

    Class attributes to override
    ----------------------------
    ROASTER_NAME : str  — Display name.
    START_URL    : str  — The listing/shop page to scrape from.
    DELAY        : float — Seconds to wait between product page requests.
    PAGINATED    : bool  — True if the listing uses ?page=N pagination.

    Selector overrides (change only what differs for your site)
    -----------------------------------------------------------
    NAME_SELECTORS     : list[str]
    PRICE_SELECTORS    : list[str]
    DESC_SELECTORS     : list[str]
    IMG_SELECTORS      : list[str]
    LISTING_SELECTORS  : list[str]  — CSS selectors to find product cards.
    PRODUCT_LINK_ATTR  : str        — Attribute on the found anchor ("href").
    """

    ROASTER_NAME: str = ""
    START_URL: str = ""
    DELAY: float = 0.8
    PAGINATED: bool = True
    MAX_PAGES: int = 30  # hard cap on pagination to avoid runaway scrapes

    # --- Selectors (override per-site as needed) ---
    NAME_SELECTORS: list[str] = [
        "h1.product__title",
        "h1.product_title.entry-title",
        "h1.product_title",
        "h1.product-single__title",
        "h1.entry-title",
        "h1.page-title span.base",
        "h1",
    ]
    PRICE_SELECTORS: list[str] = [
        ".price .woocommerce-Price-amount",
        ".price .amount",
        ".product__price",
        ".product-single__price",
        ".price-wrapper .price",
        ".price-item--regular",
        ".price-item--sale",
        "[data-product-price]",
        ".product-price",
        "span.money",
        ".price--regular .money",
        ".price",
    ]
    DESC_SELECTORS: list[str] = [
        ".woocommerce-product-details__short-description",
        "div.product__description",
        ".product__description",
        "div.product-single__description",
        "#tab-description",
        ".product-short-description",
        ".product.attribute.description .value",
        ".product-description",
        ".product__content .rte",
        ".product-single__content .rte",
        ".rte",
        "[data-product-description]",
        ".woocommerce-Tabs-panel--description",
    ]
    IMG_SELECTORS: list[str] = [
        ".woocommerce-product-gallery__image img",
        ".product-single__photo img",
        ".product__image img",
        ".gallery-placeholder img",
        ".product img",
    ]
    LISTING_SELECTORS: list[str] = [
        "ul.products li.product",
        ".products .product",
        ".grid__item",
        ".item.product.product-item",
    ]

    # ------------------------------------------------------------------ #
    #  Public API                                                          #
    # ------------------------------------------------------------------ #

    def scrape(self) -> list[Product]:
        links = self._collect_all_links()
        if not links:
            print(f"  ⚠  No product links found for {self.ROASTER_NAME}")
            return []

        print(f"  Found {len(links)} product URLs for {self.ROASTER_NAME}")
        products: list[Product] = []
        for idx, (url, fallback_img) in enumerate(links.items(), 1):
            print(f"    [{idx}/{len(links)}] {url}")
            try:
                html = self._fetch(url)
                products.append(self._parse_product_page(html, url, fallback_img))
            except Exception as exc:
                print(f"      ✗ Error: {exc}")
            time.sleep(self.DELAY)

        print(f"  → {len(products)} products scraped for {self.ROASTER_NAME}")
        return products

    # ------------------------------------------------------------------ #
    #  Link collection                                                     #
    # ------------------------------------------------------------------ #

    def _collect_all_links(self) -> dict[str, Optional[str]]:
        """Collect product URL → optional listing image across all pages."""
        parsed = urlparse(self.START_URL)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        all_links: dict[str, Optional[str]] = {}

        if self.PAGINATED:
            page = 1
            while page <= self.MAX_PAGES:
                sep = "&" if "?" in self.START_URL else "?"
                page_url = self.START_URL if page == 1 else f"{self.START_URL}{sep}page={page}"
                print(f"    listing page {page}: {page_url}")
                try:
                    html = self._fetch(page_url)
                except Exception as exc:
                    print(f"    Stopping at page {page}: {exc}")
                    break
                soup = BeautifulSoup(html, "html.parser")
                new = {
                    u: img
                    for u, img in self._get_product_links(soup, base_url).items()
                    if u not in all_links
                }
                if not new:
                    break
                all_links.update(new)
                page += 1
            else:
                print(f"  ⚠  {self.ROASTER_NAME}: MAX_PAGES ({self.MAX_PAGES}) reached, stopping pagination.")
        else:
            html = self._fetch(self.START_URL)
            soup = BeautifulSoup(html, "html.parser")
            all_links = self._get_product_links(soup, base_url)

        return all_links

    def _get_product_links(
        self, soup: BeautifulSoup, base_url: str
    ) -> dict[str, Optional[str]]:
        """
        Extract product URLs from a listing page soup.
        Override for non-standard listing layouts.
        """
        links: dict[str, Optional[str]] = {}

        for card in soup.select(", ".join(self.LISTING_SELECTORS)):
            a = card.find("a", href=True) or (card if card.name == "a" else None)
            if not a:
                continue
            href = a.get("href", "")
            if not any(kw in href for kw in ("/product", "/products", "/ols/")):
                continue
            if any(kw in href for kw in ("cart", "checkout")):
                continue
            url = urljoin(base_url, href)
            img = card.find("img")
            img_src = (
                img.get("data-src") or img.get("src") or img.get("data-srcset")
            ) if img else None
            links[url] = img_src

        # Fallback anchor scan
        for a in soup.select("a[href*='/product'], a[href*='/products']"):
            href = a.get("href", "")
            if any(kw in href for kw in ("cart", "checkout")):
                continue
            url = urljoin(base_url, href)
            if url not in links:
                img = a.find("img")
                img_src = (
                    img.get("data-src") or img.get("src")
                ) if img else None
                links[url] = img_src

        return links

    # ------------------------------------------------------------------ #
    #  Product page parsing                                                #
    # ------------------------------------------------------------------ #

    def _parse_product_page(
        self, html: str, product_url: str, fallback_image: Optional[str] = None
    ) -> Product:
        soup = BeautifulSoup(html, "html.parser")

        name = self._first_text(soup, self.NAME_SELECTORS)
        price, currency = self._extract_price(soup)
        description = self._extract_description(soup)
        image_url = self._extract_image(soup, fallback_image)
        variant_prices = self._extract_variants(soup)

        return Product(
            roaster=self.ROASTER_NAME,
            name=name,
            price=price,
            currency=currency,
            description=description,
            product_url=product_url,
            image_url=image_url,
            variant_prices=variant_prices,
        )

    def _extract_price(self, soup: BeautifulSoup) -> tuple[str, str]:
        el = soup.select_one(", ".join(self.PRICE_SELECTORS))
        if el:
            text = el.get_text(" ", strip=True)
            if re.search(r"\d", text):
                m = re.search(r"(₹|Rs\.?)", text)
                return text, m.group(1) if m else ""
        # Fallback: meta tag
        meta = soup.find("meta", attrs={"property": "product:price:amount"})
        if not meta:
            meta = soup.find("meta", attrs={"property": "og:price:amount"})
        if meta and meta.get("content"):
            return meta["content"], "₹"
        # Fallback: JSON-LD structured data
        for script in soup.select('script[type="application/ld+json"]'):
            try:
                ld = json.loads(script.string)
                offers = ld.get("offers") if isinstance(ld, dict) else None
                if isinstance(offers, dict) and offers.get("price"):
                    return str(offers["price"]), offers.get("priceCurrency", "₹")
                if isinstance(offers, list) and offers:
                    return str(offers[0].get("price", "")), offers[0].get("priceCurrency", "₹")
            except (json.JSONDecodeError, AttributeError):
                continue
        return "", ""

    def _extract_description(self, soup: BeautifulSoup) -> str:
        desc = self._first_text(soup, self.DESC_SELECTORS)
        if not desc:
            meta = soup.find("meta", attrs={"name": "description"}) or soup.find(
                "meta", attrs={"property": "og:description"}
            )
            if meta and meta.get("content"):
                desc = meta["content"].strip()
        return desc

    def _extract_image(self, soup: BeautifulSoup, fallback: Optional[str]) -> str:
        el = soup.select_one(", ".join(self.IMG_SELECTORS))
        if el:
            src = el.get("data-src") or el.get("src")
            if src:
                return src
        # og:image fallback
        meta = soup.find("meta", attrs={"property": "og:image"}) or soup.find(
            "meta", attrs={"name": "twitter:image"}
        )
        if meta and meta.get("content"):
            return meta["content"].strip()
        return fallback or ""

    def _extract_variants(self, soup: BeautifulSoup) -> str:
        """
        Extract weight options from a product page.
        HTML scrapers return weights only (e.g. '250g; 500g') — no per-weight
        price, since that would need a separate variant API call. The cleaner
        uses the base page price as a fallback for all resulting rows.
        """
        weight_pat = re.compile(r"\b(\d+(?:\.\d+)?)\s*(kg|g|gm|grams|gram|ml)\b", re.IGNORECASE)
        weights: set[str] = set()
        candidates = (
            soup.select("select option")
            + soup.select("label")
            + soup.select(".product-form__input, .variant, .swatch__option")
            + soup.select("[data-variant-title], .variant-title")
            + soup.select("input[type='radio']")
        )
        for el in candidates:
            text = el.get_text(" ", strip=True)
            if not text:
                text = el.get("value", "") or el.get("data-value", "")
            for m in weight_pat.finditer(text):
                qty, unit = m.groups()
                unit = "g" if unit.lower() in {"gm", "grams", "gram"} else unit.lower()
                weights.add(f"{qty}{unit}")
        # Fallback: extract weight from product name
        if not weights:
            name_el = soup.select_one(", ".join(self.NAME_SELECTORS))
            if name_el:
                for m in weight_pat.finditer(name_el.get_text(" ", strip=True)):
                    qty, unit = m.groups()
                    unit = "g" if unit.lower() in {"gm", "grams", "gram"} else unit.lower()
                    weights.add(f"{qty}{unit}")
        return "; ".join(sorted(weights))

    # ------------------------------------------------------------------ #
    #  Utilities                                                           #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _first_text(soup: BeautifulSoup, selectors: list[str]) -> str:
        for sel in selectors:
            el = soup.select_one(sel)
            if el:
                text = el.get_text(strip=True)
                if text:
                    return text
        return ""

    @staticmethod
    def _fetch(url: str, timeout: int = 30) -> str:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        resp.raise_for_status()
        return resp.text
