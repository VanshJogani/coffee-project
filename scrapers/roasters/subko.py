"""Subko Coffee — Shopify JSON API (microlots collection)."""
from scrapers.base.shopify import ShopifyScraper


class SubkoScraper(ShopifyScraper):
    ROASTER_NAME = "Subko"
    BASE_URL     = "https://www.subko.coffee"
    COLLECTION   = "specialty-arabica-microlots"
    PRICE_STRATEGY = "min"
