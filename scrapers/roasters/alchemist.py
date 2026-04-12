"""
Alchemist Roastery — GoDaddy Online Store (Squarespace-like).

The site uses data-aid attributes that are brittle.  We use the
/products.json API endpoint instead (GoDaddy stores expose this).
Falls back to HTML scraping if the JSON API is unavailable.
"""
import requests
from scrapers.base.html_scraper import HtmlScraper
from scrapers.base.shopify import ShopifyScraper
from scrapers.base.product import Product


class AlchemistScraper(HtmlScraper):
    """
    Alchemist uses GoDaddy which partly mimics Shopify's products.json.
    We attempt the JSON endpoint first; fall back to HTML scraping.
    """
    ROASTER_NAME = "Alchemist"
    START_URL    = "https://alchemistroastery.com/shop"
    PAGINATED    = False

    _JSON_URL = "https://alchemistroastery.com/api/2/categories/all/products?page=1&per_page=100&storefront=true"

    NAME_SELECTORS = [
        "[data-aid='PRODUCT_NAME']",
        "h1.product-name",
        "h1",
    ]
    PRICE_SELECTORS = [
        "[data-aid='PRODUCT_PRICE']",
        ".product-price",
        ".price",
    ]
    DESC_SELECTORS = [
        "[data-aid='PRODUCT_DESCRIPTION']",
        ".product-description",
        ".product__description",
    ]
    IMG_SELECTORS = [
        "[data-aid='PRODUCT_IMAGE_RENDERED'] img",
        ".product-image img",
        ".product img",
    ]
    LISTING_SELECTORS = [
        "[data-aid='GRID_ITEM_RENDERED']",
        "a[href*='/shop/ols/products/']",
    ]
