"""Bloom Coffee Roasters — Shopify JSON API."""
from scrapers.base.shopify import ShopifyScraper


class BloomCoffeeScraper(ShopifyScraper):
    ROASTER_NAME = "Bloom Coffee"
    BASE_URL     = "https://bloomcoffeeroasters.in"
    COLLECTION   = "coffee"
    PRICE_STRATEGY = "min"
