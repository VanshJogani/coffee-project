"""Fraction 9 Coffee — Shopify JSON API."""
from scrapers.base.shopify import ShopifyScraper


class Fraction9Scraper(ShopifyScraper):
    ROASTER_NAME = "Fraction 9"
    BASE_URL     = "https://www.fraction9coffee.com"
    COLLECTION   = "all"
    PRICE_STRATEGY = "min"
