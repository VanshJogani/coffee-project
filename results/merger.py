import pandas as pd
import glob
from pathlib import Path

# path to all csv files
project_root = Path(__file__).resolve().parents[1]
cleaned_dir = Path(__file__).resolve().parent / "cleaned"
files = list(cleaned_dir.glob("*_clean_products.csv"))

# read and merge
dfs = []
for f in files:
    try:
        df = pd.read_csv(f)
        if not df.empty:
            dfs.append(df)
    except Exception as e:
        print(f"Error reading {f.name}: {e}")

if dfs:
    merged = pd.concat(dfs, ignore_index=True)
    
    # Save CSV in results dir
    merged_csv_path = Path(__file__).resolve().parent / "merged_coffee.csv"
    merged.to_csv(merged_csv_path, index=False)
    
    # Save JSON in project root for seeding
    json_path = project_root / "cleaned_coffee_products.json"
    merged.to_json(json_path, orient='records', indent=2)
    
    print(f"✅ Merged {len(dfs)} files.")
    print(f"✅ Saved CSV to {merged_csv_path}")
    print(f"✅ Saved JSON to {json_path}")
else:
    print("No files found to merge.")