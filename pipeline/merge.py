"""
Merge all cleaned CSVs from results/cleaned/ into a single JSON array.
Output: results/cleaned_coffee_products.json
"""
import json
from pathlib import Path

import pandas as pd


TARGET_COLUMNS = [
    "Name", "Roaster", "Price", "Quantity", "Roast_Level",
    "Tasting_Notes", "Origin", "Process", "Desc", "URL", "Image_URL", "Category",
]


def merge(cleaned_dir: Path, output_path: Path) -> int:
    """Read all *_clean_products.csv files, merge into one JSON array. Returns product count."""
    all_products = []

    csv_files = sorted(cleaned_dir.glob("*_clean_products.csv"))
    if not csv_files:
        print(f"No cleaned CSVs found in {cleaned_dir}")
        return 0

    for csv_path in csv_files:
        try:
            df = pd.read_csv(csv_path, dtype=str).fillna("")
            # Ensure we only keep known columns (extras are dropped)
            cols = [c for c in TARGET_COLUMNS if c in df.columns]
            df = df[cols]
            records = df.to_dict(orient="records")
            all_products.extend(records)
        except Exception as e:
            print(f"Warning: failed to read {csv_path.name}: {e}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_products, f, indent=2, ensure_ascii=False)

    print(f"Merged {len(csv_files)} CSVs -> {len(all_products)} products -> {output_path.name}")
    return len(all_products)


def main():
    project_root = Path(__file__).resolve().parents[1]
    cleaned_dir = project_root / "results" / "cleaned"
    output_path = project_root / "results" / "cleaned_coffee_products.json"
    merge(cleaned_dir, output_path)


if __name__ == "__main__":
    main()
