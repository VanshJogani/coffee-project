import re
from pathlib import Path

import pandas as pd


TARGET_COLUMNS = [
    "Name",
    "Roaster",
    "Price",
    "Quantity",
    "Roast_Level",
    "Tasting_Notes",
    "Desc",
    "URL",
    "Image_URL",
]


def parse_price(price_raw: str | float | int) -> float | None:
    """Extract numeric price from strings like '₹ 600', 'Rs. 850', etc."""
    if pd.isna(price_raw):
        return None

    if isinstance(price_raw, (int, float)):
        return float(price_raw)

    text = str(price_raw)
    m = re.search(r"(\d+(?:\.\d+)?)", text.replace(",", ""))
    return float(m.group(1)) if m else None


def is_coffee_product(name: str, desc: str) -> bool:
    """Check if a product is likely a coffee bean product."""
    text = f"{name} {desc}".lower()
    
    # Indications that it's coffee
    coffee_keywords = ["coffee", "bean", "roast", "espresso", "filter", "brew", "caffeine", "single-origin", "blend", "notes", "arabica", "robusta", "whole bean"]
    # Indications that it's NOT coffee (equipment, merch, etc.)
    non_coffee_keywords = [
        "v60 dripper", "gooseneck kettle", "ceramic mug", "coffee cup", "tumbler", 
        "filter paper", "paper filter", "burr grinder", "hand grinder", "t-shirt", 
        "merch", "tote bag", "sticker", "pin", "gift card", "subscription box"
    ]
    
    has_coffee = any(kw in text for kw in coffee_keywords)
    has_equipment = any(kw in text for kw in non_coffee_keywords)
    
    if has_equipment:
        return False
        
    # Hard Equipment checks
    equipment_names = ["kettle", "dripper", "grinder", "machine", "press", "scale"]
    if any(f" {eq} " in f" {text} " for eq in equipment_names) and not any(kw in text for kw in ["whole bean", "roast level", "tasting notes"]):
         if any(f" {eq} " in f" {text} " for eq in equipment_names):
             return "coffee" in text or "bean" in text
    
    return has_coffee


def parse_roast_level(name: str, desc: str) -> str:
    """Look for Light/Medium/Dark roast mentions in name or description."""
    text = f"{name} {desc}".lower()
    
    # 1. Explicit full roast phrases (high confidence)
    explicit_patterns = [
        (r"light roast", "Light Roast"),
        (r"medium[- ]light roast", "Medium-Light Roast"),
        (r"medium roast", "Medium Roast"),
        (r"medium[- ]dark roast", "Medium-Dark Roast"),
        (r"dark roast", "Dark Roast"),
        (r"omni[- ]roast", "Omni-Roast"),
        (r"omni\s*roast", "Omni-Roast"),
        (r"filter roast", "Filter Roast"),
        (r"espresso roast", "Espresso Roast"),
        (r"vienna roast", "Vienna Roast"),
        (r"french roast", "French Roast"),
        (r"italian roast", "Italian Roast"),
        (r"cinnamon roast", "Cinnamon Roast"),
        (r"city roast", "City Roast"),
        (r"full city roast", "Full City Roast"),
    ]
    
    for pat, label in explicit_patterns:
        if re.search(pat, text, re.IGNORECASE):
            return label

    # 2. Roast Level: [Level] style
    m = re.search(r"roast\s*level\s*[:\-]?\s*(\b\w+\b(-\b\w+\b)?)", text, re.IGNORECASE)
    if m:
        level = m.group(1).title()
        if level in ["Light", "Medium", "Dark", "Medium-Light", "Medium-Dark"]:
            return f"{level} Roast"

    # 3. Keywords with word boundaries and context check (medium confidence)
    context_keywords = ["roast", "profile", "level", "tasting", "notes", "notes of", "acidity", "body", "process", "aftertaste"]
    has_context = any(kw in text for kw in context_keywords)
    
    keyword_patterns = [
        (r"\bmedium[\- ]light\b", "Medium-Light"),
        (r"\bmedium[\- ]dark\b", "Medium-Dark"),
        (r"\blight\b", "Light"),
        (r"\bmedium\b", "Medium"),
        (r"\bdark\b", "Dark"),
        (r"\bomni\b", "Omni"),
    ]
    
    for pat, label in keyword_patterns:
        if re.search(pat, text, re.IGNORECASE):
            if has_context:
                return f"{label} Roast"
    return ""


def parse_tasting_notes(desc: str) -> str:
    """
    Try to pull tasting notes out of a description, e.g.
    'Tastes Like - XYZ' or 'Tasting Notes: ABC'.
    """
    if not isinstance(desc, str):
        return ""

    text = " ".join(desc.split())  # normalize whitespace

    # Look for "Tastes Like - ..." or "Tasting Notes: ..."
    m = re.search(r"(Tastes?\s+Like|Tasting\s+Notes?)\s*[-:]\s*(.+)", text, re.IGNORECASE)
    if not m:
        return ""

    candidate = m.group(2)

    # Stop before common next sections like "Roasting Profile", "Process", etc.
    stops = [
        "Roasting Profile",
        "Roast Profile",
        "Process -",
        "Process:",
        "Process ",
        "Varietal",
        "Altitude",
        "Producer Name",
        "Harvest Year",
    ]
    lower = candidate.lower()
    cut_idx = None
    for stop in stops:
        pos = lower.find(stop.lower())
        if pos != -1:
            cut_idx = pos if cut_idx is None else min(cut_idx, pos)
    if cut_idx is not None:
        candidate = candidate[:cut_idx]

    return candidate.strip(" -:;,." )


def parse_quantities(variants: str) -> list[str]:
    """
    Extract weights like '250g', '250 g', '1kg', '1 kg', '500gm' etc.
    Returns a list of normalized strings like '250g', '1kg'.
    """
    if not isinstance(variants, str):
        return []

    weight_pattern = re.compile(r"(\d+(?:\.\d+)?)\s*(kg|g|gm|grams)", re.IGNORECASE)
    found: set[str] = set()

    for m in weight_pattern.finditer(variants):
        qty, unit = m.groups()
        unit_norm = unit.lower()
        if unit_norm in {"gm", "grams"}:
            unit_norm = "g"
        found.add(f"{qty}{unit_norm}")

    return sorted(found)


def clean_generic_roaster(input_file: str, output_file: str | None = None):
    """
    Clean data from *_products_generic.csv produced by generic_roasters_scraper.py
    into the common schema used by other cleaners.
    """
    df = pd.read_csv(input_file)

    cleaned_rows = []

    for _, row in df.iterrows():
        name_raw = str(row.get("name", ""))
        roaster = str(row.get("roaster", "")).strip()
        price = parse_price(row.get("price", ""))
        desc = str(row.get("description", ""))
        url = str(row.get("product_url", ""))
        image_url = "" if pd.isna(row.get("image_url", "")) else str(row.get("image_url", ""))
        variants = str(row.get("variants", "")) if not pd.isna(row.get("variants", "")) else ""

        if is_coffee_product(name_raw, desc):
            roast_level = parse_roast_level(name_raw, desc)
        else:
            roast_level = ""

        tasting_notes = parse_tasting_notes(desc)

        # extract all quantities from variants; if none, leave quantity blank
        quantities = parse_quantities(variants)
        if not quantities:
            quantities = [""]

        for qty in quantities:
            cleaned_rows.append(
                {
                    "Name": name_raw.strip(),
                    "Roaster": roaster,
                    "Price": price,
                    "Quantity": qty,
                    "Roast_Level": roast_level,
                    "Tasting_Notes": tasting_notes,
                    "Desc": desc,
                    "URL": url,
                    "Image_URL": image_url,
                }
            )

    cleaned_df = pd.DataFrame(cleaned_rows, columns=TARGET_COLUMNS)

    if not output_file:
        in_path = Path(input_file)
        out_dir = Path(__file__).with_name("clean")
        out_dir.mkdir(exist_ok=True)
        stem = in_path.stem.replace("_products_generic", "")
        output_file = out_dir / f"{stem}_clean_products.csv"
    else:
        output_file = Path(output_file)

    cleaned_df.to_csv(output_file, index=False)
    print(f"✅ Cleaned dataset saved to {output_file}")


if __name__ == "__main__":
    # Example: clean one of the generic scraper outputs
    # Adjust the filename to the roaster you want to clean.
    clean_generic_roaster("../ScraperScripts/corridor_seven_products_generic.csv")

