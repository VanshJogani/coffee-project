"""
Naivo Coffee — WooCommerce store.

Fixed issues in the old Playwright scraper:
- Missing 'roaster' field in output
- print(html) debug dump
- Using networkidle per product page (very slow)
- Replaced with lightweight requests + BeautifulSoup via HtmlScraper
"""
from scrapers.base.html_scraper import HtmlScraper


class NaivoScraper(HtmlScraper):
    ROASTER_NAME = "Naivo"
    START_URL    = "https://naivo.in/product-category/all-coffee/"
    PAGINATED    = True

    # Standard WooCommerce selectors — default NAME_SELECTORS etc. work fine
    LISTING_SELECTORS = [
        "ul.products li.product",
        ".products .product",
        ".product-type-simple",
    ]
