"""Pipeline runner — orchestrates scraping, cleaning, merging, and seeding."""

import json
import logging
import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv

from pipeline.parser import GenericRoastersParser
from pipeline.cleaner import GenericRoastersCleaner
from pipeline.merge import merge
from pipeline.seed_turso import seed

# Load .env file (looks in project root)
_project_root = Path(__file__).resolve().parents[1]
load_dotenv(_project_root / ".env")

# ─── Logging setup ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("pipeline")

# ─── Dead roasters — skip immediately ────────────────────────────────────────
DEAD_ROASTERS = {
    "KC Roasters",
    "Fluent Beans",
    "Sapling Coffee Roasters",
    "PH Seven Coffee",
    "Zenforest Coffee Roasters",
}

# ─── Dedicated scrapers map ──────────────────────────────────────────────────
# Legacy dedicated scrapers — most are broken and their sites are Shopify anyway,
# so the generic parser's JSON API path handles them better.
# Only keep scrapers here that genuinely need special handling (e.g., Playwright).
DEDICATED_SCRAPERS = {
    # All previous dedicated scrapers removed — the generic parser with
    # Shopify JSON detection now handles these stores more reliably.
}


def main() -> None:
    start_time = time.time()

    project_root = Path(__file__).resolve().parents[1]
    coffeeroasters = project_root / "ScraperScripts" / "coffeeroastersupdated.txt"
    results_root = project_root / "results"
    parsed_dir = results_root / "parsed"
    cleaned_dir = results_root / "cleaned"
    scraper_scripts_dir = project_root / "ScraperScripts"

    parsed_dir.mkdir(parents=True, exist_ok=True)
    cleaned_dir.mkdir(parents=True, exist_ok=True)

    already = set(DEDICATED_SCRAPERS.keys()) | DEAD_ROASTERS
    parser = GenericRoastersParser(coffeeroasters, already_scraped_names=already)
    cleaner = GenericRoastersCleaner()

    roasters_to_generic = parser.get_roasters()

    # Combine generic + dedicated (exclude dead)
    all_roasters = roasters_to_generic + [
        (name, None) for name in DEDICATED_SCRAPERS.keys()
        if name not in DEAD_ROASTERS
    ]

    logger.info(f"Pipeline starting: {len(all_roasters)} roasters to process")
    logger.info(f"  Dedicated scrapers: {len(DEDICATED_SCRAPERS)}")
    logger.info(f"  Generic scrapers: {len(roasters_to_generic)}")
    logger.info(f"  Skipping dead: {DEAD_ROASTERS}")

    # ─── Tracking ─────────────────────────────────────────────────────────────
    success_list = []
    failed_list = []
    products_scraped = 0

    def worker(name: str, url: str | None) -> tuple[str, int]:
        """Process one roaster. Returns (name, product_count)."""
        if name in DEDICATED_SCRAPERS:
            script_name = DEDICATED_SCRAPERS[name]
            script_path = scraper_scripts_dir / script_name
            logger.info(f"Running dedicated scraper: {name} ({script_name})")

            slug = parser.slugify(name)
            expected_csv = scraper_scripts_dir / f"{slug}_products_generic.csv"

            venv_python = project_root / ".venv" / "Scripts" / "python.exe"
            python_exe = str(venv_python) if venv_python.exists() else "python"

            try:
                subprocess.run(
                    [python_exe, str(script_path)],
                    cwd=str(scraper_scripts_dir),
                    check=True,
                    timeout=120,  # 2 min max per dedicated scraper
                    capture_output=True,
                )
                if expected_csv.exists():
                    parsed_path = parsed_dir / expected_csv.name
                    if parsed_path.exists():
                        os.remove(parsed_path)
                    os.rename(expected_csv, parsed_path)
                else:
                    logger.warning(f"  {script_name} did not produce expected CSV")
                    return (name, 0)
            except subprocess.TimeoutExpired:
                logger.error(f"  {name}: dedicated scraper timed out (120s)")
                return (name, 0)
            except Exception as e:
                logger.error(f"  {name}: dedicated scraper failed: {e}")
                return (name, 0)
        else:
            parsed_path = parser.parse_single_roaster(name, url, parsed_dir)

        if not parsed_path or not parsed_path.exists():
            return (name, 0)

        # Count products in the parsed CSV
        try:
            with parsed_path.open(encoding="utf-8") as f:
                count = sum(1 for _ in f) - 1  # subtract header
        except Exception:
            count = 0

        # Clean
        logger.info(f"  Cleaning: {name} ({count} products)")
        try:
            cleaner.clean_file(parsed_path, cleaned_dir)
        except Exception as e:
            logger.error(f"  Cleaning failed for {name}: {e}")

        return (name, max(0, count))

    # ─── Run workers in parallel ──────────────────────────────────────────────
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(worker, name, url): name
            for name, url in all_roasters
        }
        for fut in as_completed(futures):
            name = futures[fut]
            try:
                roaster_name, count = fut.result()
                if count > 0:
                    success_list.append(roaster_name)
                    products_scraped += count
                else:
                    failed_list.append(roaster_name)
            except Exception as e:
                logger.error(f"  Worker exception for {name}: {e}")
                failed_list.append(name)

    # ─── Post-scrape: merge and seed ──────────────────────────────────────────
    json_output = results_root / "cleaned_coffee_products.json"
    merged_count = merge(cleaned_dir, json_output)

    seeded = False
    if merged_count > 0 and os.environ.get("TURSO_DATABASE_URL"):
        logger.info(f"Seeding {merged_count} products into Turso...")
        try:
            seed(json_output)
            seeded = True
        except Exception as e:
            logger.error(f"Turso seed failed: {e}")
    elif merged_count > 0:
        logger.info(f"Merged {merged_count} products. No TURSO_DATABASE_URL — skipping seed.")
    else:
        logger.warning("No products to seed.")

    # ─── Summary ──────────────────────────────────────────────────────────────
    duration = time.time() - start_time
    summary = {
        "total_roasters": len(all_roasters),
        "success": len(success_list),
        "failed": len(failed_list),
        "failed_names": sorted(failed_list),
        "products_scraped": products_scraped,
        "products_merged": merged_count,
        "seeded": seeded,
        "duration_sec": round(duration, 1),
    }

    logger.info("=" * 60)
    logger.info("PIPELINE SUMMARY")
    logger.info(f"  Roasters: {summary['success']}/{summary['total_roasters']} succeeded")
    logger.info(f"  Products scraped: {summary['products_scraped']}")
    logger.info(f"  Products merged: {summary['products_merged']}")
    logger.info(f"  Seeded to Turso: {summary['seeded']}")
    logger.info(f"  Duration: {summary['duration_sec']}s")
    if failed_list:
        logger.warning(f"  Failed: {', '.join(sorted(failed_list))}")
    logger.info("=" * 60)

    # Print as JSON for machine parsing (Render logs)
    print(json.dumps(summary, indent=2))

    # ─── Optional webhook notification ────────────────────────────────────────
    webhook_url = os.environ.get("PIPELINE_WEBHOOK_URL")
    if webhook_url:
        try:
            import requests
            requests.post(webhook_url, json=summary, timeout=10)
        except Exception as e:
            logger.warning(f"Webhook notification failed: {e}")


if __name__ == "__main__":
    main()
