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
        return float(price_raw) if price_raw > 0 else None

    text = str(price_raw).replace(",", "")
    m = re.search(r"(\d+(?:\.\d+)?)", text)
    return float(m.group(1)) if m else None


def parse_price_from_variants(variants: str) -> float | None:
    """Fallback: try to extract price from variant text like '250g - ₹600'."""
    if not isinstance(variants, str) or not variants:
        return None
    text = variants.replace(",", "")
    m = re.search(r"[₹Rs\.]\s*(\d+(?:\.\d+)?)", text)
    if m:
        return float(m.group(1))
    return None


def is_coffee_product(name: str, desc: str) -> bool:
    """Check if a product is likely a coffee bean product."""
    text = f"{name} {desc}".lower()

    # Indications that it's coffee
    coffee_keywords = [
        "coffee", "bean", "roast", "espresso", "filter", "brew", "caffeine",
        "single-origin", "single origin", "blend", "arabica", "robusta",
        "whole bean", "ground coffee", "pour over", "aeropress",
        "microlot", "micro lot", "estate", "plantation",
    ]
    # Indications that it's NOT coffee (equipment, merch, etc.)
    non_coffee_keywords = [
        # Equipment
        "v60 dripper", "gooseneck kettle", "ceramic mug", "coffee cup",
        "tumbler", "filter paper", "paper filter", "burr grinder",
        "hand grinder", "electric grinder", "coffee machine", "portafilter",
        "tamper", "milk pitcher", "knock box", "dosing cup",
        "weighing scale", "thermometer", "timer",
        # Merch / Apparel
        "t-shirt", "tshirt", "tee shirt", "hoodie", "sweatshirt", "apron",
        "merch", "tote bag", "sticker", "pin", "gift card", "subscription box",
        "poster", "book", "cap", "hat", "socks", "jacket", "shorts",
        # Food (non-coffee)
        "almond butter", "peanut butter", "granola", "energy bar",
        "protein bar", "bread", "brioche", "burger bun", "banana bread",
        "kale chip", "chocolate bar", "cookie", "brownie", "cake",
        "croissant", "muffin", "sandwich", "pizza", "pasta",
        # Other
        "candle", "soap", "air freshener", "rice husk", "vacuum tumbler",
        "french press glass", "yoga", "pottery", "tattoo", "bike",
        "gift hamper", "gift box",
    ]

    # Hard equipment names (standalone words)
    equipment_names = [
        "kettle", "dripper", "grinder", "machine", "press", "scale",
        "aeropress", "chemex", "siphon", "moka pot",
    ]

    has_coffee = any(kw in text for kw in coffee_keywords)
    has_equipment = any(kw in text for kw in non_coffee_keywords)

    if has_equipment and not has_coffee:
        return False

    if has_equipment and has_coffee:
        # If name itself has a non-coffee keyword, likely not coffee
        name_lower = name.lower()
        if any(kw in name_lower for kw in non_coffee_keywords):
            return False

    # Check standalone equipment words in name (not description)
    name_lower = name.lower()
    for eq in equipment_names:
        if f" {eq}" in f" {name_lower}" or name_lower.startswith(eq):
            if not any(kw in name_lower for kw in ["whole bean", "roast", "blend", "coffee"]):
                return False

    # If no coffee keyword anywhere and description is empty/very short, reject
    if not has_coffee and len(desc.strip()) < 20:
        return False

    return has_coffee


def parse_roast_level(name: str, desc: str) -> str:
    """Look for Light/Medium/Dark roast mentions in name or description."""
    text = f"{name} {desc}".lower()

    # 1. Explicit full roast phrases (high confidence)
    explicit_patterns = [
        (r"medium[- ]light\s+roast", "Medium-Light Roast"),
        (r"medium[- ]dark\s+roast", "Medium-Dark Roast"),
        (r"light\s+roast", "Light Roast"),
        (r"medium\s+roast", "Medium Roast"),
        (r"dark\s+roast", "Dark Roast"),
        (r"omni[- ]?roast", "Omni-Roast"),
        (r"filter\s+roast", "Filter Roast"),
        (r"espresso\s+roast", "Espresso Roast"),
        (r"vienna\s+roast", "Vienna Roast"),
        (r"french\s+roast", "French Roast"),
        (r"italian\s+roast", "Italian Roast"),
        (r"cinnamon\s+roast", "Cinnamon Roast"),
        (r"full\s+city\s+roast", "Full City Roast"),
        (r"city\s+roast", "City Roast"),
    ]

    for pat, label in explicit_patterns:
        if re.search(pat, text, re.IGNORECASE):
            return label

    # 2. "Roast Level: X", "Roast: X", "Roast Profile: X", "Roast type - X" etc.
    roast_label_patterns = [
        r"roast\s*(?:level|type|profile)?\s*[:\-–]\s*(\b[\w]+(?:[- ]\w+)?\b)",
        r"roast\s*:\s*(\b[\w]+(?:[- ]\w+)?\b)",
        r"roast\s+profile\s*[:\-–]?\s*(\b[\w]+(?:[- ]\w+)?\b)",
    ]
    valid_levels = {
        "light": "Light Roast",
        "medium": "Medium Roast",
        "dark": "Dark Roast",
        "medium-light": "Medium-Light Roast",
        "medium light": "Medium-Light Roast",
        "medium-dark": "Medium-Dark Roast",
        "medium dark": "Medium-Dark Roast",
        "espresso": "Espresso Roast",
        "filter": "Filter Roast",
        "omni": "Omni-Roast",
    }
    for pat in roast_label_patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            level = m.group(1).strip().lower()
            if level in valid_levels:
                return valid_levels[level]

    # 3. Keywords with word boundaries and context check (medium confidence)
    context_keywords = [
        "roast", "profile", "level", "tasting", "notes", "acidity",
        "body", "process", "aftertaste", "aroma", "cupping", "brew",
    ]
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
    'Tastes Like - XYZ' or 'Tasting Notes: ABC' or 'Flavour Notes: ...'
    """
    if not isinstance(desc, str):
        return ""

    text = " ".join(desc.split())  # normalize whitespace

    # Multiple patterns for tasting notes (ordered by specificity)
    patterns = [
        r"(Tastes?\s+Like|Tasting\s+Notes?|Flavou?r\s+Notes?|Flavou?r\s+Profile|Cup\s+Profile|In\s+The\s+Cup|Cup\s+Notes?|Notes)\s*[-:–]\s*(.+)",
    ]

    candidate = ""
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            candidate = m.group(2)
            break

    if not candidate:
        return ""

    # Stop before common next sections
    stops = [
        "Roasting Profile",
        "Roast Profile",
        "Roast Level",
        "Roast:",
        "Process -",
        "Process:",
        "Process ",
        "Varietal",
        "Variety:",
        "Altitude",
        "Elevation",
        "Producer Name",
        "Harvest Year",
        "Region:",
        "Origin:",
        "Farm:",
        "Weight:",
        "Quantity:",
        "How to brew",
        "Brewing",
        "Storage",
        "Shelf life",
        "Best before",
    ]
    lower = candidate.lower()
    cut_idx = None
    for stop in stops:
        pos = lower.find(stop.lower())
        if pos != -1:
            cut_idx = pos if cut_idx is None else min(cut_idx, pos)
    if cut_idx is not None:
        candidate = candidate[:cut_idx]

    return candidate.strip(" -:;,.")


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
        if price is None:
            price = parse_price_from_variants(str(row.get("variants", "")) if not pd.isna(row.get("variants", "")) else "")
        desc = str(row.get("description", ""))
        url = str(row.get("product_url", ""))
        image_url = "" if pd.isna(row.get("image_url", "")) else str(row.get("image_url", ""))
        variants = str(row.get("variants", "")) if not pd.isna(row.get("variants", "")) else ""

        if not is_coffee_product(name_raw, desc):
            continue

        roast_level = parse_roast_level(name_raw, desc)

        tasting_notes = parse_tasting_notes(desc)

        # extract all quantities from variants; if none, try product name
        quantities = parse_quantities(variants)
        if not quantities:
            quantities = parse_quantities(name_raw)
        if not quantities:
            quantities = parse_quantities(desc)
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

