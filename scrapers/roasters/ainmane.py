"""
Ainmane Coffee — Magento store.

Magento follows a different URL and selector pattern from WooCommerce/Shopify.
We override the relevant selectors for Magento's markup.
"""
from scrapers.base.html_scraper import HtmlScraper


class AinmaneScraper(HtmlScraper):
    ROASTER_NAME = "Ainmane"
    START_URL    = "https://www.ainmane.com/coffee.html"
    PAGINATED    = True

    # Magento product grid selectors
    LISTING_SELECTORS = [
        ".item.product.product-item",
        "li.product-item",
    ]
    NAME_SELECTORS = [
        "h1.page-title span.base",
        "h1.product-name",
        "h1",
    ]
    PRICE_SELECTORS = [
        ".price-wrapper .price",
        ".product-info-price .price",
        ".price",
    ]
    DESC_SELECTORS = [
        ".product.attribute.description .value",
        "#description",
        ".product-description",
    ]
    IMG_SELECTORS = [
        ".gallery-placeholder img",
        ".product.media img",
        ".product img",
    ]
