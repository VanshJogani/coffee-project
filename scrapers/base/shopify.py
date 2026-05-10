"""
ShopifyScraper — base class for all Shopify-based roasters.

Shopify exposes a clean JSON API at /collections/<slug>/products.json.
Subclasses only need to define class-level attributes; no method overriding
is required for most roasters.

Minimal subclass example:
    class MyRoaster(ShopifyScraper):
        ROASTER_NAME = "My Roaster"
        BASE_URL     = "https://myroaster.com"
        COLLECTION   = "coffee"   # → fetches /collections/coffee/products.json

Variant pricing
---------------
Shopify products have variants, each with its own weight/size option and price.
For example a product might have:
    variant 1: option1="250g", price="450.00"
    variant 2: option1="500g", price="800.00"
    variant 3: option1="1kg",  price="1500.00"

We store these as:
    price           = "Rs. 450.00"              (cheapest, for sorting/display)
    variant_prices  = "250g:450.00; 500g:800.00; 1kg:1500.00"  (full map)

The cleaner reads variant_prices to fan out one DB row per weight.
"""
from __future__ import annotations
from bs4 import BeautifulSoup


import re
from abc import ABC
from typing import Optional

import requests

from scrapers.base.product import Product



class ShopifyScraper(ABC):
    """
    Base class for Shopify store scrapers.

    Class attributes to override in subclasses
    ------------------------------------------
    ROASTER_NAME : str   — Display name stored in the Product.roaster field.
    BASE_URL     : str   — Domain including scheme, no trailing slash.
    COLLECTION   : str   — Shopify collection handle (default "all").
    PRICE_STRATEGY : str — "min" (lowest variant) | "first" (first variant).
    FILTER_COFFEE : bool — If True, run `is_coffee()` on each product.
    """

    # Labels we care about (used in both strong-tag and text-scan extraction)
    _PRODUCT_FIELD_LABELS = re.compile(
        r"^(Cupper[‘’]?s\s+Notes?|Tasting\s+Notes?|Flavou?r\s+Notes?|Tastes?\s+Like"
        r"|Producer|Farmer|Farm|Estate|Process(?:ing)?|Fermentation"
        r"|Roast\s+(?:Profile|Level|Type)|Roast"
        r"|Altitude|Elevation|Region|Origin|Location|Varietal|Variety|SCA(?:\s+Cup)?\s+Score)\s*[:\-–]",
        re.IGNORECASE,
    )

    # Text-scan fallback: label then value ending before the next label or noise
    _FIELD_TEXT_PATTERN = re.compile(
        r"(Cupper[‘’]?s\s+Notes?|Tasting\s+Notes?|Flavou?r\s+Notes?|Tastes?\s+Like"
        r"|Producer|Farmer|Farm|Estate|Process(?:ing)?|Fermentation"
        r"|Roast\s+(?:Profile|Level|Type)|Roast"
        r"|Altitude|Elevation|Region|Origin|Location|Varietal|Variety|SCA(?:\s+Cup)?\s+Score)"
        r"\s*[:\-–]\s*([^:\n\r]{3,100}?)(?=\s+(?:"
        r"Cupper|Tasting|Flavou?r|Tastes?|Producer|Farmer|Farm|Estate|Process|Fermentation"
        r"|Roast|Altitude|Elevation|Region|Origin|Location|Varietal|Variety|SCA|$))",
        re.IGNORECASE,
    )

    def _fetch_product_page_details(self, handle: str) -> dict:
        """
        Fetch extra details from the product HTML page.
        Extracts structured product fields (tasting notes, process, altitude, etc.)
        that live outside body_html (rendered from Shopify metafields/Liquid).
        """
        url = f"{self.BASE_URL}/products/{handle}"
        try:
            resp = requests.get(url, timeout=15)
            if resp.status_code != 200:
                print(f"    [!] Failed to fetch product page {handle}: {resp.status_code}")
                return {}
            soup = BeautifulSoup(resp.text, "html.parser")

            meta_desc = soup.find("meta", {"name": "description"})
            description = meta_desc["content"] if meta_desc else None

            # Remove clutter before parsing
            for tag in soup(["script", "style", "noscript", "nav", "footer", "header"]):
                tag.decompose()

            fields: dict[str, str] = {}

            # ── Strategy 1: <strong> / <b> tag labels ─────────────────────
            # Covers: <strong>Cupper’s Notes:</strong> Caramel...
            for bold in soup.find_all(["strong", "b"]):
                label_text = bold.get_text(strip=True)
                if not self._PRODUCT_FIELD_LABELS.match(label_text):
                    continue
                label = re.sub(r"\s*[:\-–]\s*$", "", label_text).strip()
                # Value is the text that immediately follows the bold tag
                value_parts = []
                for sibling in bold.next_siblings:
                    if hasattr(sibling, "name") and sibling.name in ("strong", "b", "br", "p", "div", "li"):
                        break
                    text = sibling.get_text(strip=True) if hasattr(sibling, "get_text") else str(sibling).strip()
                    if text:
                        value_parts.append(text)
                    if len(" ".join(value_parts)) > 120:
                        break
                value = re.sub(r"\s+", " ", " ".join(value_parts)).strip(" \t,;.-")
                key = label.lower().replace("’", "’").replace("’", "’")
                if key not in fields and len(value) >= 3:
                    fields[key] = f"{label}: {value}"

            # ── Strategy 2: text scan fallback (for dt/dd, plain-text pages) ─
            if not fields:
                page_text = re.sub(r"\s+", " ", soup.get_text(separator=" "))
                for m in self._FIELD_TEXT_PATTERN.finditer(page_text):
                    label = re.sub(r"\s+", " ", m.group(1)).strip()
                    value = m.group(2).strip(" \t,;.-")
                    key = label.lower().replace("’", "’")
                    if key not in fields and len(value) >= 3:
                        fields[key] = f"{label}: {value}"

            return {
                "meta_description": description,
                "product_fields": "\n".join(fields.values()),
            }
        except Exception as e:
            print(f"    [!] Exception fetching product page {handle}: {e}")
            return {}

    ROASTER_NAME: str = ""
    BASE_URL: str = ""
    COLLECTION: str = "all"
    FILTER_COFFEE: bool = False   # subclasses that carry non-coffee items set True
    MAX_PAGES: int = 30           # hard cap on pagination to avoid runaway scrapes

    # Tags / types that always mean non-coffee
    _NON_COFFEE_TAGS: frozenset[str] = frozenset({
        "merch", "stickers", "subscription", "gift card", "gift_card",
        "equipment", "accessory", "accessories", "apparel", "clothing",
    })
    _MERCH_TITLE_KW: tuple[str, ...] = (
        "tote bag", "sticker", "badge", "spray bottle", "brew stick",
        "storage jar", "stash box", "filter paper", "subscription",
        "gift card", "sampler box", "sampler", "kettle", "dripper",
        "grinder", "mug", "tumbler", "t-shirt", "tshirt", "hoodie",
        "sweatshirt", "apron", "cap ", "hat ", "socks",
        "aeropress", "french press", "chemex", "v60", "moka pot",
        "scale", "tamper", "portafilter", "knock box", "pitcher",
        "candle", "soap", "air freshener", "poster", "book",
        "almond butter", "peanut butter", "granola", "energy bar",
        "protein bar", "bread", "brioche", "burger bun", "banana bread",
        "brownie", "cookie", "cake", "croissant", "muffin", "sandwich",
        "gift box", "gift hamper", "vacuum tumbler",
    )

    # ------------------------------------------------------------------ #
    #  Public API                                                          #
    # ------------------------------------------------------------------ #

    def scrape(self) -> list[Product]:
        """Fetch all products from the Shopify JSON API and return Products."""
        raw = self._fetch_all_pages()
        products: list[Product] = []
        for p in raw:
            if self.FILTER_COFFEE and not self._is_coffee(p):
                print(f"    SKIP (non-coffee): {p.get('title')!r}")
                continue
            products.append(self._to_product(p))
        print(f"  -> {len(products)} products scraped for {self.ROASTER_NAME}")
        return products

    def get_variant_map(self, product_title: str) -> dict[str, float]:
        """
        Utility: fetch the variant weight→price map for a single product by title.
        Useful for debugging or quick inspection.
        """
        raw = self._fetch_all_pages()
        for p in raw:
            if p.get("title", "").strip().lower() == product_title.lower():
                return self._variant_price_map(p.get("variants", []))
        return {}

    # ------------------------------------------------------------------ #
    #  Internal helpers                                                    #
    # ------------------------------------------------------------------ #

    def _collection_url(self) -> str:
        return f"{self.BASE_URL}/collections/{self.COLLECTION}/products.json"

    def _fetch_all_pages(self) -> list[dict]:
        base = self._collection_url()
        page, all_products = 1, []
        print(f"  Fetching {self.ROASTER_NAME} via {base} …")
        while page <= self.MAX_PAGES:
            url = f"{base}?limit=250&page={page}"
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            batch = resp.json().get("products", [])
            if not batch:
                break
            all_products.extend(batch)
            print(f"    page {page}: {len(batch)} products")
            if len(batch) < 250:
                break
            page += 1
        else:
            print(f"  [!] {self.ROASTER_NAME}: MAX_PAGES ({self.MAX_PAGES}) reached, stopping pagination.")
        return all_products

    @staticmethod
    def _variant_price_map(variants: list[dict]) -> dict[str, float]:
        """
        Build an ordered mapping of weight_label → price for all variants
        that have a weight-like option (contains a digit).

        e.g. [{option1: '250g', price: '450.00'}, {option1: '500g', price: '800.00'}]
             → {'250g': 450.0, '500g': 800.0}

        Variants whose option1 is generic (e.g. 'Default Title', 'One Size')
        are captured under the key '' so callers can still access the price.
        """
        result: dict[str, float] = {}
        for v in variants:
            try:
                price_val = float(v.get("price", 0) or 0)
            except (ValueError, TypeError):
                price_val = 0.0

            # Find the option that looks like a weight (contains a digit)
            # Some sites put package type (Pouch/Tin) in Opt1 and weight in Opt2
            weight_opt = ""
            for opt_key in ["option1", "option2", "option3"]:
                val = (v.get(opt_key) or "").strip()
                if val and any(c.isdigit() for c in val):
                    weight_opt = val
                    break

            if weight_opt:
                result[weight_opt] = price_val
            else:
                # Fallback: store cheapest price under blank key for any non-weight variant
                # (e.g. "Medium / Coarse", "Medium / Whole Bean" grind-size combinations)
                if price_val > 0:
                    existing = result.get("", 0.0)
                    result[""] = min(existing, price_val) if existing > 0 else price_val
        return result

    def _format_variant_prices(self, variants: list[dict]) -> tuple[str, str]:
        """
        Returns:
            price_str         — cheapest price as "Rs. 450.00" (for display / sorting)
            variant_prices_str — full map as "250g:450.00; 500g:800.00; 1kg:1500.00"
        """
        vmap = self._variant_price_map(variants)
        if not vmap:
            return "", ""

        prices = list(vmap.values())
        cheapest = min(p for p in prices if p > 0) if any(p > 0 for p in prices) else 0.0
        price_str = f"Rs. {cheapest:.2f}" if cheapest else ""

        # Build the semicolon-separated weight:price string
        # Skip the blank key if there are real weight entries
        real_entries = {k: v for k, v in vmap.items() if k}
        if real_entries:
            variant_prices_str = "; ".join(
                f"{k}:{v:.2f}" for k, v in real_entries.items()
            )
        elif "" in vmap:
            # Only a single default variant with no weight label
            variant_prices_str = f":{vmap['']:.2f}"
        else:
            variant_prices_str = ""

        return price_str, variant_prices_str

    def _to_product(self, p: dict) -> Product:
        """Convert a raw Shopify product dict → Product, with extra details from HTML page."""
        title    = p.get("title", "").strip()
        variants = p.get("variants", [])
        images   = p.get("images", [])
        handle   = p.get("handle", "")

        price_str, variant_prices_str = self._format_variant_prices(variants)

        # Fetch extra details from product page
        extra_details = self._fetch_product_page_details(handle) if handle else {}

        # Merge extra details into description
        description = self._strip_html(p.get("body_html", ""))
        if extra_details.get("product_fields"):
            description = f"{description}\n{extra_details['product_fields']}".strip()
        if extra_details.get("meta_description"):
            description += f"\n[Meta Description]: {extra_details['meta_description']}"

        return Product(
            roaster        = self.ROASTER_NAME,
            name           = title,
            price          = price_str,
            currency       = "INR",
            description    = description,
            product_url    = f"{self.BASE_URL}/products/{handle}",
            image_url      = images[0]["src"] if images else "",
            variant_prices = variant_prices_str,
            roast_type     = self._extract_roast(p),
        )

    # Override in subclasses that encode roast info differently (e.g. Tulum)
    def _extract_roast(self, p: dict) -> str:  # noqa: ARG002
        return ""

    def _is_coffee(self, p: dict) -> bool:
        """Basic coffee-vs-merch filter. Override for store-specific logic."""
        tags = {t.lower().strip() for t in p.get("tags", [])}
        title = p.get("title", "").lower()
        product_type = p.get("product_type", "").lower()

        if tags & self._NON_COFFEE_TAGS:
            return False
        if "gift_card" in p or "gift card" in title:
            return False
        if product_type in {"coffee", "coffee beans", "specialty coffee"}:
            return True
        if any(kw in title for kw in self._MERCH_TITLE_KW):
            return False
        if "coffee" in tags or "coffee" in product_type:
            return True
        return True  # default: include

    @staticmethod
    def _strip_html(html: str) -> str:
        if not html:
            return ""
        return re.sub(r"<[^>]+>", " ", html).strip()
