import re
from pathlib import Path
from typing import List

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


class GenericRoastersCleaner:
    """
    Class-based version of the generic roasters cleaner.

    Usage:
        cleaner = GenericRoastersCleaner()
        cleaner.clean_file(parsed_csv_path, cleaned_output_dir)
    """

    @staticmethod
    def parse_price(price_raw):
        if pd.isna(price_raw):
            return None
        if isinstance(price_raw, (int, float)):
            return float(price_raw)
        text = str(price_raw)
        m = re.search(r"(\d+(?:\.\d+)?)", text.replace(",", ""))
        return float(m.group(1)) if m else None

    @staticmethod
    def is_coffee_product(name: str, desc: str) -> bool:
        """Check if a product is likely a coffee bean product."""
        text = f"{name} {desc}".lower()
        
        # Indications that it's coffee
        coffee_keywords = ["coffee", "bean", "roast", "espresso", "filter", "brew", "caffeine", "single-origin", "blend", "notes", "arabica", "robusta", "whole bean"]
        # Indications that it's NOT coffee (equipment, merch, etc.)
        # Use more specific phrases to avoid false negatives for coffee meant for certain equipment
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
        # If it's JUST the equipment name or has many equipment words
        if any(f" {eq} " in f" {text} " for eq in equipment_names) and not any(kw in text for kw in ["whole bean", "roast level", "tasting notes"]):
            # If it has "press" but also "roast level", it might be coffee recommended for press
             if any(f" {eq} " in f" {text} " for eq in equipment_names):
                 # Be conservative
                 return "coffee" in text or "bean" in text
        
        return has_coffee

    @staticmethod
    def parse_roast_level(name: str, desc: str) -> str:
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
        # Context words that increase confidence it's about roast level
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

    @staticmethod
    def parse_tasting_notes(desc: str) -> str:
        if not desc or not isinstance(desc, str):
            return ""

        text = " ".join(desc.split())

        # ── 1. Explicit labeled sections ─────────────────────────────────────
        # e.g. "Tasting Notes: chocolate, caramel"  /  "Flavour Notes Hazelnut • Grape"
        m = re.search(
            r"(?:Tasting\s+Notes?|Flavour\s+Notes?|Flavor\s+Notes?|Tastes?\s+Like|Tastes?:)\s*[-:]?\s*(.+?)"
            r"(?=\s*(?:Roast(?:\s+Level)?|Process|Varietal|Altitude|Origin|Producer|Region|Elevation|\Z))",
            text, re.IGNORECASE | re.DOTALL
        )
        if m:
            candidate = m.group(1).strip(" -:;.,")
            candidate = re.split(r"\.\s+[A-Z]", candidate)[0]   # cut at next sentence
            if 5 < len(candidate) < 220:
                return candidate

        # ── 2. "Notes of X, Y" / "Hints of..." / "Flavours of..." ────────────
        m = re.search(r"(?:Notes|Hints|Flavours|Flavors)\s+of\s+([^.!?\n]{5,120})", text, re.IGNORECASE)
        if m:
            return m.group(1).strip(" ,.")

        # ── 3. "you'll taste / notice / find X, Y, Z" (Blue Tokai prose) ────
        m = re.search(
            r"(?:you.ll\s+(?:be able to\s+)?(?:taste|notice|find)|taste[sd]?\s+of|reminds?(?:\s+you)?\s+of)"
            r"\s+([^.!?\n]{5,180})",
            text, re.IGNORECASE
        )
        if m:
            return m.group(1).strip(" ,.")

        # ── 4. Bullet / separator lists: "Hazelnut • Grape • Cocoa" ──────────
        m = re.search(
            r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*[•|/]\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*[•|/]\s*[A-Z][a-z]+[^.\n]{0,100})",
            text
        )
        if m:
            return m.group(1).strip()

        # ── 5. Best-scoring sentence fallback ────────────────────────────────
        FLAVORS = {
            "chocolate", "caramel", "berry", "berries", "citrus", "fruity", "nutty",
            "honey", "floral", "vanilla", "orange", "lemon", "lime", "currant", "apple",
            "cocoa", "toffee", "molasses", "jasmine", "peach", "plum", "cherry",
            "jaggery", "mango", "cardamom", "cinnamon", "clove", "rose", "hazelnut",
            "cashew", "walnut", "almond", "coconut", "guava", "pineapple", "malt",
            "blackberry", "raspberry", "blueberry", "strawberry", "raisin", "prune",
            "pomegranate", "grape", "pear", "grapefruit", "dark chocolate", "brown sugar",
            "black tea", "chamomile", "fig", "apricot", "tamarind", "sugarcane",
            "spice", "tobacco", "pepper", "anise", "butter", "cream", "toffee",
        }
        TASTE_TRIGGERS = {
            "notes", "flavor", "flavour", "tasting", "taste", "aroma",
            "finish", "aftertaste", "palate", "cup", "acidity", "body",
        }
        best_sent, best_score = "", 0
        for sent in re.split(r"(?<=[.!?])\s+", text):
            sl = sent.lower()
            flavor_count = sum(1 for f in FLAVORS if f in sl)
            has_trigger = any(t in sl for t in TASTE_TRIGGERS)
            score = flavor_count * 2 + (1 if has_trigger else 0)
            if score > best_score and 10 < len(sent) < 300:
                best_score, best_sent = score, sent

        return best_sent.strip() if best_score >= 3 else ""

    @staticmethod
    def parse_variant_prices(variant_prices_str: str, base_price: float | None) -> list[tuple[str, float | None]]:
        """
        Parse the variant_prices field into a list of (weight_label, price) tuples.

        Handles two formats produced by scrapers:
          Shopify: "250g:450.00; 500g:800.00; 1kg:1500.00"  → each weight gets its own price
          HTML:    "250g; 500g"                              → each weight falls back to base_price
          Single:  ":450.00"                                 → no weight label, single price
          Empty:   ""                                        → [("", base_price)]

        Returns list of (weight_label, price_float_or_None).
        An empty weight_label means the product has no size variants.
        """
        if not isinstance(variant_prices_str, str) or not variant_prices_str.strip():
            return [("", base_price)]

        results: list[tuple[str, float | None]] = []
        for token in variant_prices_str.split(";"):
            token = token.strip()
            if not token:
                continue
            if ":" in token:
                # Shopify format: "250g:450.00" or ":450.00"
                weight_part, price_part = token.split(":", 1)
                weight_label = weight_part.strip()
                try:
                    price_val: float | None = float(price_part.strip())
                    if price_val == 0.0:
                        price_val = base_price  # Some variants have 0 price (e.g. unavailable)
                except (ValueError, TypeError):
                    price_val = base_price
            else:
                # HTML format: weight only, no per-variant price
                weight_label = token.strip()
                price_val = base_price

            # Normalise weight units  (e.g. "250gm" → "250g")
            m = re.match(r"(\d+(?:\.\d+)?)\s*(kg|kilo|g|gm|grams)", weight_label, re.IGNORECASE)
            if m:
                qty, unit = m.groups()
                unit = "g" if unit.lower() in {"gm", "grams"} else unit.lower()
                unit = "kg" if unit.lower() == "kilo" else unit
                weight_label = f"{qty}{unit}"

            results.append((weight_label, price_val))

        return results if results else [("", base_price)]

    def clean_file(self, input_file: Path, output_dir: Path) -> Path:
        input_file = Path(input_file)
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        df = pd.read_csv(input_file)
        cleaned_rows = []

        for _, row in df.iterrows():
            name_raw = str(row.get("name", ""))
            roaster = str(row.get("roaster", "")).strip()
            desc = str(row.get("description", ""))
            url = str(row.get("product_url", ""))
            image_url = "" if pd.isna(row.get("image_url", "")) else str(row.get("image_url", ""))

            # The base price (cheapest variant or page price) is the fallback for HTML scrapers
            base_price = self.parse_price(row.get("price", ""))

            # Read the variant_prices field (new format) or fall back to old 'variants' column
            vp_raw = row.get("variant_prices", row.get("variants", ""))
            variant_prices_str = str(vp_raw) if not pd.isna(vp_raw) else ""

            if self.is_coffee_product(name_raw, desc):
                roast_level = self.parse_roast_level(name_raw, desc)
            else:
                roast_level = ""

            tasting_notes = self.parse_tasting_notes(desc)

            # Fan out one cleaned row per (weight, price) pair
            weight_price_pairs = self.parse_variant_prices(variant_prices_str, base_price)

            for weight_label, price_val in weight_price_pairs:
                cleaned_rows.append(
                    {
                        "Name": name_raw.strip(),
                        "Roaster": roaster,
                        "Price": price_val,
                        "Quantity": weight_label,
                        "Roast_Level": roast_level,
                        "Tasting_Notes": tasting_notes,
                        "Desc": desc,
                        "URL": url,
                        "Image_URL": image_url,
                    }
                )

        cleaned_df = pd.DataFrame(cleaned_rows, columns=TARGET_COLUMNS)
        stem = input_file.stem.replace("_products_generic", "")
        out_path = output_dir / f"{stem}_clean_products.csv"
        cleaned_df.to_csv(out_path, index=False)
        print(f"✅ Cleaned dataset saved to {out_path}")
        return out_path


if __name__ == "__main__":
    # Example manual run
    project_root = Path(__file__).resolve().parents[1]
    parsed_dir = project_root / "results" / "parsed"
    cleaned_dir = project_root / "results" / "cleaned"

    example_file = parsed_dir / "corridor_seven_products_generic.csv"
    if example_file.exists():
        cleaner = GenericRoastersCleaner()
        cleaner.clean_file(example_file, cleaned_dir)

