"""Quick Brown Fox Coffee — Shopify JSON API."""
from scrapers.base.shopify import ShopifyScraper


class QuickBrownFoxScraper(ShopifyScraper):
    ROASTER_NAME = "Quick Brown Fox"
    BASE_URL     = "https://www.qbfcoffee.com"
    COLLECTION   = "all-coffees"
    PRICE_STRATEGY = "min"
