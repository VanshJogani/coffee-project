"""Kappi Kottai — Shopify JSON API."""
from scrapers.base.shopify import ShopifyScraper


class KappiKottaiScraper(ShopifyScraper):
    ROASTER_NAME = "Kappi Kottai"
    BASE_URL     = "https://kapikottai.coffee"
    COLLECTION   = "all"
    PRICE_STRATEGY = "min"
