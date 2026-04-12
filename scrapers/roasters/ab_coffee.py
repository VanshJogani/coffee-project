"""
A B Coffee — Shopify JSON API.

The old Playwright scraper for this site was unreliable (grabbed wrong headings,
used length-based price detection). A B Coffee's site is actually Shopify,
so we use the clean JSON API instead.
"""
from scrapers.base.shopify import ShopifyScraper


class ABCoffeeScraper(ShopifyScraper):
    ROASTER_NAME   = "A B Coffee"
    BASE_URL       = "https://www.abcoffee.in"
    COLLECTION     = "all"
    PRICE_STRATEGY = "min"
