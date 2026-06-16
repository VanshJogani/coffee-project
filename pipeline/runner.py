import subprocess
import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

from pipeline.parser import GenericRoastersParser
from pipeline.cleaner import GenericRoastersCleaner
from pipeline.merge import merge
from pipeline.seed_turso import seed


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]

    coffeeroasters = project_root / "ScraperScripts" / "coffeeroastersupdated.txt"
    results_root = project_root / "results"
    parsed_dir = results_root / "parsed"
    cleaned_dir = results_root / "cleaned"
    scraper_scripts_dir = project_root / "ScraperScripts"

    parsed_dir.mkdir(parents=True, exist_ok=True)
    cleaned_dir.mkdir(parents=True, exist_ok=True)

    # Map roaster names to their dedicated scraper scripts
    DEDICATED_SCRAPERS = {
        "Blue Tokai": "BlueTokaiscraper.py",
        "Subko": "subkoscraper.py",
        "Bloom Coffee": "BloomCoffee.py",
        "Kappi Kottai": "KappiKottai.py",
        "Curious Life": "CuriousLife.py",
        "Fraction 9": "fraction9scraper.py",
        "Quick Brown Fox": "quickbrownfox.py",
        "Savorworks": "savorworks.py",
        "Araku": "scrapearaku.py",
        "Alchemist": "alchemistscraper.py",
        "Ainmane": "ainmanescraper.py",
        "A B Coffee": "abcoffeescraper.py",
        "Tulum": "tulumscraper.py",   # Uses Shopify JSON API for clean data + roast from vendor field
    }

    already = set(DEDICATED_SCRAPERS.keys())
    # Note: GenericRoastersParser will skip these 'already' names
    parser = GenericRoastersParser(coffeeroasters, already_scraped_names=already)
    cleaner = GenericRoastersCleaner()

    roasters_to_generic = parser.get_roasters()
    
    # We also want to process the dedicated ones
    # (name, url) where url is None or unused for dedicated
    all_roasters = roasters_to_generic + [(name, None) for name in DEDICATED_SCRAPERS.keys()]

    def worker(name: str, url: str | None) -> None:
        if name in DEDICATED_SCRAPERS:
            script_name = DEDICATED_SCRAPERS[name]
            script_path = scraper_scripts_dir / script_name
            print(f"\nRunning dedicated scraper for {name}: {script_name}")
            
            # The script outputs a CSV in its own directory
            # We standardize them to output {slug}_products_generic.csv
            slug = parser.slugify(name)
            expected_csv = scraper_scripts_dir / f"{slug}_products_generic.csv"
            
            # Use the venv python if available
            venv_python = project_root / ".venv" / "Scripts" / "python.exe"
            python_exe = str(venv_python) if venv_python.exists() else "python"
            
            try:
                subprocess.run([python_exe, str(script_path)], cwd=str(scraper_scripts_dir), check=True)
                if expected_csv.exists():
                    # Move to parsed_dir
                    parsed_path = parsed_dir / expected_csv.name
                    if parsed_path.exists():
                        os.remove(parsed_path)
                    os.rename(expected_csv, parsed_path)
                else:
                    print(f"Warning: Dedicated scraper {script_name} did not produce {expected_csv.name}")
                    return
            except Exception as e:
                print(f"Error running dedicated scraper for {name}: {e}")
                return
        else:
            parsed_path = parser.parse_single_roaster(name, url, parsed_dir)

        if parsed_path:
            print(f"Cleaning parsed data for {name}: {parsed_path}")
            cleaner.clean_file(parsed_path, cleaned_dir)

    # Run multiple roasters in parallel
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(worker, name, url): name
            for name, url in all_roasters
        }
        for fut in as_completed(futures):
            name = futures[fut]
            try:
                fut.result()
            except Exception as e:
                print(f"Error processing roaster {name}: {e}")


    # ── Post-scrape: merge cleaned CSVs and seed into Turso ──────────────────
    json_output = results_root / "cleaned_coffee_products.json"
    count = merge(cleaned_dir, json_output)

    if count > 0 and os.environ.get("TURSO_DATABASE_URL"):
        print(f"\nSeeding {count} products into Turso...")
        seed(json_output)
    elif count > 0:
        print(f"\nMerged {count} products. Skipping Turso seed (no TURSO_DATABASE_URL set).")
    else:
        print("\nNo products to seed.")


if __name__ == "__main__":
    main()

