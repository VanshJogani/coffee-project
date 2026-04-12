"""
Tulum Coffee — Shopify JSON API.

Tulum stores the roast type in the Shopify 'vendor' field
(e.g. "Medium Roast", "Dark Roast") rather than tags or description.
Non-coffee products (merch, samplers) are filtered out.
"""
from scrapers.base.shopify import ShopifyScraper


class TulumScraper(ShopifyScraper):
    ROASTER_NAME   = "Tulum"
    BASE_URL       = "https://www.tulum.coffee"
    COLLECTION     = "all"
    PRICE_STRATEGY = "min"
    FILTER_COFFEE  = True   # Tulum sells merch alongside coffee

    # Roast keywords found in the Shopify vendor field
    _ROAST_MAP = {
        "light roast":        "Light",
        "light":              "Light",
        "medium-light roast": "Medium-Light",
        "medium light roast": "Medium-Light",
        "medium roast":       "Medium",
        "medium":             "Medium",
        "medium-dark roast":  "Medium-Dark",
        "medium dark roast":  "Medium-Dark",
        "medium-dark":        "Medium-Dark",
        "dark roast":         "Dark",
        "dark":               "Dark",
        "espresso roast":     "Espresso",
        "filter roast":       "Filter",
        "omni-roast":         "Omni",
        "omni roast":         "Omni",
    }
    _ROAST_VENDOR_KEYWORDS = {
        "light", "medium", "dark", "espresso", "blend",
        "roast", "filter", "omni",
    }
    _NON_COFFEE_VENDORS = {"tulum coffee", "subscribe & save", "subscribe and save"}

    # ------------------------------------------------------------------ #

    def _extract_roast(self, p: dict) -> str:
        vendor_lower = p.get("vendor", "").strip().lower()
        for key, val in self._ROAST_MAP.items():
            if key in vendor_lower:
                return val
        return ""

    def _is_coffee(self, p: dict) -> bool:
        tags         = {t.lower().strip() for t in p.get("tags", [])}
        product_type = p.get("product_type", "").strip().lower()
        vendor       = p.get("vendor", "").strip().lower()
        title        = p.get("title", "").strip().lower()

        # Explicit non-coffee tags
        if tags & (self._NON_COFFEE_TAGS | {"merch", "stickers", "subscription"}):
            return False
        if "gift_card" in p or "gift card" in title or "gift card" in product_type:
            return False

        # Explicit coffee product type
        if product_type in {"coffee", "coffee beans", "specialty coffee"}:
            return True

        # Vendor encodes roast type → it's a coffee
        if set(vendor.split()) & self._ROAST_VENDOR_KEYWORDS:
            return True

        if "coffee" in tags:
            return True

        # Merch title keywords
        for kw in self._MERCH_TITLE_KW:
            if kw in title:
                return False

        if vendor in self._NON_COFFEE_VENDORS:
            return False

        return True
