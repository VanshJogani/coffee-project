"""
Shared Product dataclass used across all scrapers.
This is the canonical schema every scraper must output.
"""
from dataclasses import dataclass, asdict, field
import csv
from pathlib import Path


@dataclass
class Product:
    roaster: str
    name: str
    price: str           # Cheapest variant price, e.g. "Rs. 450.00" (for display/sorting)
    currency: str        # "INR" or "Rs." etc.
    description: str     # Plain text (HTML already stripped by scraper)
    product_url: str
    image_url: str
    variant_prices: str  # Full per-variant weight→price map.
                         # Format: "250g:450.00; 500g:800.00; 1kg:1500.00"
                         # Each token is  <weight_label>:<price_float>.
                         # Products with a single default size use ":price" (no weight label).
                         # HTML scrapers that can't determine per-weight price store weights only:
                         # "250g; 500g"  (no colon = no price for that weight, cleaner uses base price)
    roast_type: str = field(default="")   # Optional, not all scrapers populate this
    origin: str = field(default="")        # Geographic origin (e.g. "Chikmagalur", "Araku Valley")
    tasting_notes: str = field(default="") # Flavour notes (e.g. "Chocolate, Caramel, Berry")
    process: str = field(default="")       # Processing method (e.g. "Natural", "Washed", "Honey")


def save_products_csv(products: list[Product], out_path: Path) -> None:
    """Write a list of Product objects to a CSV file."""
    if not products:
        print(f"  ⚠  No products to save for {out_path.name}")
        return
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(asdict(products[0]).keys())
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for p in products:
            writer.writerow(asdict(p))
    print(f"  ✅ Saved {len(products)} products → {out_path}")
