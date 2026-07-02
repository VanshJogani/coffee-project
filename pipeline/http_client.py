"""Resilient HTTP client for the scraper pipeline.

Provides retry logic with exponential backoff, per-domain rate limiting,
and connection pooling. All pipeline HTTP calls should use this module.
"""

import time
import logging
from urllib.parse import urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

# Transient HTTP status codes worth retrying
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}

# Per-domain last-request timestamps for rate limiting
_domain_timestamps: dict[str, float] = {}


def _get_session() -> requests.Session:
    """Create a session with connection pooling and retry adapter."""
    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "CafeIndicaScraper/1.0 "
            "(+https://github.com/cafe-indica; specialty coffee index)"
        ),
        "Accept": "text/html,application/json,application/xhtml+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
    })
    # Mount retry adapter for both http and https
    adapter = HTTPAdapter(
        max_retries=0,  # We handle retries manually for better logging
        pool_connections=10,
        pool_maxsize=10,
    )
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


# Module-level shared session
_session = _get_session()


def _rate_limit(url: str, delay: float):
    """Enforce minimum delay between requests to the same domain."""
    domain = urlparse(url).netloc
    now = time.time()
    last = _domain_timestamps.get(domain, 0)
    wait = delay - (now - last)
    if wait > 0:
        time.sleep(wait)
    _domain_timestamps[domain] = time.time()


def fetch(
    url: str,
    *,
    retries: int = 3,
    timeout: tuple[int, int] = (30, 45),
    delay: float = 0.8,
    backoff_base: float = 2.0,
) -> requests.Response:
    """Fetch a URL with retries, backoff, and rate limiting.

    Args:
        url: The URL to fetch.
        retries: Max number of retry attempts (default 3).
        timeout: (connect_timeout, read_timeout) in seconds.
        delay: Minimum seconds between requests to the same domain.
        backoff_base: Base for exponential backoff (delay = base^attempt).

    Returns:
        requests.Response on success.

    Raises:
        requests.HTTPError: After all retries exhausted for HTTP errors.
        requests.ConnectionError: After all retries exhausted for network errors.
        requests.Timeout: After all retries exhausted for timeouts.
    """
    _rate_limit(url, delay)

    last_exception = None
    for attempt in range(retries + 1):
        try:
            resp = _session.get(url, timeout=timeout, allow_redirects=True)

            if resp.status_code in _RETRYABLE_STATUS:
                if attempt < retries:
                    wait = backoff_base ** attempt
                    logger.warning(
                        f"HTTP {resp.status_code} from {url} — "
                        f"retrying in {wait:.1f}s (attempt {attempt + 1}/{retries})"
                    )
                    time.sleep(wait)
                    continue
                # Final attempt — raise
                resp.raise_for_status()

            # Non-retryable errors (4xx except 429) — raise immediately
            resp.raise_for_status()
            return resp

        except (requests.ConnectionError, requests.Timeout) as e:
            last_exception = e
            if attempt < retries:
                wait = backoff_base ** attempt
                logger.warning(
                    f"Network error fetching {url}: {e.__class__.__name__} — "
                    f"retrying in {wait:.1f}s (attempt {attempt + 1}/{retries})"
                )
                time.sleep(wait)
                continue
            raise

        except requests.HTTPError:
            raise

    # Should not reach here, but just in case
    if last_exception:
        raise last_exception
    raise requests.ConnectionError(f"Failed to fetch {url} after {retries} retries")


def fetch_json(url: str, **kwargs) -> dict | list | None:
    """Fetch a URL and parse as JSON. Returns None on non-JSON response."""
    resp = fetch(url, **kwargs)
    content_type = resp.headers.get("content-type", "")
    if "json" in content_type or resp.text.strip().startswith(("{", "[")):
        return resp.json()
    return None


def is_shopify_store(base_url: str) -> bool:
    """Detect if a URL is a Shopify store by probing the products JSON API.

    Args:
        base_url: The store's base URL (e.g., https://bluetokaicoffee.com)

    Returns:
        True if the store responds to /products.json with a products array.
    """
    # Normalize URL
    base = base_url.rstrip("/")
    # Remove collection paths to get the store root
    for segment in ["/collections/all", "/collections", "/coffee", "/shop"]:
        if base.endswith(segment):
            base = base[: -len(segment)]
            break

    probe_url = f"{base}/products.json?limit=1"
    try:
        resp = fetch(probe_url, retries=1, timeout=(10, 15), delay=0.3)
        data = resp.json()
        return isinstance(data, dict) and "products" in data
    except Exception:
        return False


def fetch_shopify_products(base_url: str, limit: int = 250, max_pages: int = 20) -> list[dict]:
    """Fetch all products from a Shopify store via the JSON API.

    Args:
        base_url: Store URL (with or without /collections/all).
        limit: Products per page (max 250 for Shopify).
        max_pages: Hard cap on pagination to prevent infinite loops.

    Returns:
        List of raw Shopify product dicts.
    """
    # Get store root
    base = base_url.rstrip("/")
    for segment in ["/collections/all", "/collections", "/coffee", "/shop"]:
        if base.endswith(segment):
            base = base[: -len(segment)]
            break

    all_products = []
    page = 1

    while page <= max_pages:
        url = f"{base}/products.json?limit={limit}&page={page}"
        try:
            data = fetch_json(url, delay=0.5)
            if not data or not isinstance(data, dict):
                break

            products = data.get("products", [])
            if not products:
                break

            all_products.extend(products)
            logger.info(f"  Page {page}: {len(products)} products (total: {len(all_products)})")

            # If we got fewer than limit, we've reached the end
            if len(products) < limit:
                break

            page += 1

        except Exception as e:
            logger.warning(f"  Shopify pagination stopped at page {page}: {e}")
            break

    return all_products
