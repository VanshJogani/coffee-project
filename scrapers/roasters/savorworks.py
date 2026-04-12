"""Savorworks Roasters — Shopify JSON API."""
from scrapers.base.shopify import ShopifyScraper


class SavorworksScraper(ShopifyScraper):
    ROASTER_NAME = "Savorworks"
    BASE_URL     = "https://www.savorworksroasters.com"
    COLLECTION   = "coffee"
    PRICE_STRATEGY = "min"
