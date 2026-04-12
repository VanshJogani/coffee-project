"""
Curious Life Coffee — custom WooCommerce-style listing page.
Uses isotope-item cards in the listing (not a standard WooCommerce grid).
"""
from bs4 import BeautifulSoup

from scrapers.base.html_scraper import HtmlScraper
from scrapers.base.product import Product
from typing import Optional


class CuriousLifeScraper(HtmlScraper):
    ROASTER_NAME = "Curious Life"
    START_URL    = "https://curiouslifecoffee.com/store/"
    PAGINATED    = False   # Single listing page

    # Override listing selectors for this non-standard theme
    LISTING_SELECTORS = ["li.isotope-item"]

    def _get_product_links(
        self, soup: BeautifulSoup, base_url: str
    ) -> dict[str, Optional[str]]:
        """
        Curious Life's listing already contains name/price/image in the card,
        so we extract everything here and skip individual product pages.
        We still delegate to the base class but also try to pre-fill data.
        """
        links: dict[str, Optional[str]] = {}
        for item in soup.select("li.isotope-item"):
            a = item.find("a", href=True)
            if not a:
                continue
            href = a["href"]
            if not href.startswith("http"):
                href = base_url.rstrip("/") + "/" + href.lstrip("/")
            img = item.find("img")
            img_src = img["src"] if img else None
            links[href] = img_src
        return links
