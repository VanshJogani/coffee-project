"""Araku Coffee — Shopify JSON API."""
from scrapers.base.shopify import ShopifyScraper


class ArakuScraper(ShopifyScraper):
    ROASTER_NAME = "Araku"
    BASE_URL     = "https://www.arakucoffee.in"
    COLLECTION   = "coffee"
    PRICE_STRATEGY = "min"
