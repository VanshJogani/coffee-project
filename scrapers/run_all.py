"""
scrapers/run_all.py — Pipeline entry point for all scrapers.

Usage:
    python -m scrapers.run_all                      # Run all scrapers
    python -m scrapers.run_all --only "Blue Tokai"  # Run a single scraper
    python -m scrapers.run_all --workers 6          # Control parallelism

Output:
    results/parsed/<roaster_slug>_products_generic.csv   (raw scraped data)
    results/cleaned/<roaster_slug>_clean_products.csv    (cleaned for DB)
"""
from __future__ import annotations

import argparse
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from scrapers.registry import ALL_SCRAPERS
from scrapers.base.product import save_products_csv
from pipeline.cleaner import GenericRoastersCleaner


def slugify(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    return slug.strip("_") or "roaster"


def run_scraper(scraper_cls, parsed_dir: Path, cleaned_dir: Path) -> None:
    instance = scraper_cls()
    name = instance.ROASTER_NAME
    print(f"\n{'='*60}")
    print(f"  {name}")
    print(f"{'='*60}")

    try:
        products = instance.scrape()
    except Exception as exc:
        print(f"  [x] FAILED ({name}): {exc}")
        return

    if not products:
        print(f"  [!] No products for {name} - skipping CSV.")
        return

    slug = slugify(name)
    parsed_path = parsed_dir / f"{slug}_products_generic.csv"
    save_products_csv(products, parsed_path)

    # Clean
    cleaner = GenericRoastersCleaner()
    try:
        cleaner.clean_file(parsed_path, cleaned_dir)
    except Exception as exc:
        print(f"  [x] Cleaner failed for {name}: {exc}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run coffee roaster scrapers.")
    parser.add_argument(
        "--only",
        nargs="+",
        metavar="ROASTER",
        help="Run only these roaster(s) by name (case-insensitive).",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="Number of parallel workers (default: 4).",
    )
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parents[1]
    parsed_dir  = project_root / "results" / "parsed"
    cleaned_dir = project_root / "results" / "cleaned"
    parsed_dir.mkdir(parents=True, exist_ok=True)
    cleaned_dir.mkdir(parents=True, exist_ok=True)

    scrapers_to_run = ALL_SCRAPERS
    if args.only:
        names_lower = {n.lower() for n in args.only}
        scrapers_to_run = [
            cls for cls in ALL_SCRAPERS
            if cls.ROASTER_NAME.lower() in names_lower
        ]
        if not scrapers_to_run:
            print(f"No scrapers matched: {args.only}")
            sys.exit(1)

    print(f"Running {len(scrapers_to_run)} scraper(s) with {args.workers} worker(s).\n")

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(run_scraper, cls, parsed_dir, cleaned_dir): cls.ROASTER_NAME
            for cls in scrapers_to_run
        }
        for fut in as_completed(futures):
            name = futures[fut]
            try:
                fut.result()
            except Exception as exc:
                print(f"  [x] Unhandled error for {name}: {exc}")

    print("\n[v] All scrapers complete.")


if __name__ == "__main__":
    main()
