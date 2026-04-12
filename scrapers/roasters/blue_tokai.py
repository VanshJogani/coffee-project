"""Blue Tokai Coffee Roasters — Shopify JSON API."""
from scrapers.base.shopify import ShopifyScraper


class BlueTokaiScraper(ShopifyScraper):
    ROASTER_NAME = "Blue Tokai"
    BASE_URL     = "https://bluetokaicoffee.com"
    COLLECTION   = "roasted-and-ground-coffee-beans"
    PRICE_STRATEGY = "min"
