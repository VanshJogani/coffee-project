import re
from pathlib import Path
from typing import List

import pandas as pd

from pipeline.origin_registry import extract_origin as _extract_origin


TARGET_COLUMNS = [
    "Name",
    "Roaster",
    "Price",
    "Quantity",
    "Roast_Level",
    "Tasting_Notes",
    "Origin",
    "Process",
    "Desc",
    "URL",
    "Image_URL",
    "Category",
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
        """Check if a product is likely a coffee bean product (not tea, equipment, or merch)."""
        name_lower = name.lower()
        text = f"{name} {desc}".lower()

        # ── Tea guard: if the *name* is clearly tea, it's not coffee ────────
        tea_indicators = [
            "green tea", "black tea", "white tea", "oolong", "rooibos",
            "herbal tea", "tisane", "earl grey", "matcha", "cascara",
            "blossom tea", "masala tea", "masala chai",
        ]
        # Broader single-word tea signals (checked in name only)
        tea_words = [" tea ", " tea,", " tea)", " chai ", " chai,", "(tea)"]
        has_tea_name = (
            any(kw in name_lower for kw in tea_indicators)
            or any(kw in f" {name_lower} " for kw in tea_words)
            or name_lower.endswith(" tea") or name_lower.endswith(" chai")
        )
        # Only override if the name is NOT also clearly about coffee beans/roast
        strong_coffee_in_name = any(
            kw in name_lower
            for kw in ["coffee bean", "coffee roast", "roasted coffee", "whole bean"]
        )
        if has_tea_name and not strong_coffee_in_name:
            return False

        # ── Equipment / merch guard ─────────────────────────────────────────
        # Check against name only — short keywords like "hat", "cap", "pin" are
        # too common as substrings in description text ("what", "capsule", "pineapple").
        non_coffee_keywords = [
            "v60 dripper", "gooseneck kettle", "ceramic mug", "coffee cup", "tumbler",
            "filter paper", "paper filter", "burr grinder", "hand grinder",
            "electric grinder", "portafilter", "tamper", "milk pitcher",
            "knock box", "dosing cup", "weighing scale",
            "t-shirt", "tshirt", "tee shirt", "hoodie", "sweatshirt", "apron",
            "merch", "tote bag", "sticker", "gift card", "subscription box",
            "poster", "book", "cap", "hat", "socks", "jacket",
            "almond butter", "peanut butter", "granola", "energy bar",
            "protein bar", "bread", "brioche", "burger bun", "banana bread",
            "kale chip", "chocolate bar", "cookie", "brownie", "cake",
            "croissant", "muffin", "sandwich", "pizza", "pasta",
            "candle", "soap", "air freshener", "rice husk", "vacuum tumbler",
        ]
        if any(kw in name_lower for kw in non_coffee_keywords):
            return False

        equipment_names = ["kettle", "dripper", "grinder", "machine", "press", "scale"]
        if any(f" {eq} " in f" {text} " for eq in equipment_names) and not any(kw in text for kw in ["whole bean", "roast level", "tasting notes"]):
            if any(f" {eq} " in f" {text} " for eq in equipment_names):
                return "coffee" in text or "bean" in text

        # ── Positive coffee signal ──────────────────────────────────────────
        coffee_keywords = [
            "coffee", "bean", "roast", "espresso", "filter", "brew", "caffeine",
            "single-origin", "blend", "notes", "arabica", "robusta", "whole bean"
        ]
        return any(kw in text for kw in coffee_keywords)

    @staticmethod
    def parse_roast_level(name: str, desc: str) -> str:
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

        # 2. "Roast Level: X", "Roast: X", "Roast Profile: X", "Roast type - X"
        valid_levels = {
            "light": "Light Roast",
            "medium": "Medium Roast",
            "dark": "Dark Roast",
            "medium-light": "Medium-Light Roast",
            "medium light": "Medium-Light Roast",
            "medium-dark": "Medium-Dark Roast",
            "medium dark": "Medium-Dark Roast",
            "light - medium": "Medium-Light Roast",
            "light-medium": "Medium-Light Roast",
            "light to medium": "Medium-Light Roast",
            "espresso": "Espresso Roast",
            "filter": "Filter Roast",
            "omni": "Omni-Roast",
        }
        roast_label_patterns = [
            r"roast\s*(?:level|type|profile)?\s*[:\-–]\s*([\w]+(?:[- ]+[\w]+){0,2})",
            r"roast\s*:\s*([\w]+(?:[- ]+[\w]+){0,2})",
            r"roast\s+profile\s*[:\-–]?\s*([\w]+(?:[- ]+[\w]+){0,2})",
        ]
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
            (r"\blight[\- ]+medium\b", "Medium-Light"),
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

        import html

        text = html.unescape(desc)
        text = " ".join(text.split())

        # Strip [Meta Description]: ... and everything after it
        text = re.split(r"\[Meta\s+Description\]", text, flags=re.IGNORECASE)[0].strip()

        def _clean(s: str, max_len: int = 120) -> str:
            s = html.unescape(s)
            for pat in [
                r"\s*\[Meta\s+Description\].*",
                r"\s*Recommended\s+[Bb]rewing.*",
                r"\s*Best\s+Brewed\s+With.*",
                r"\s*Brewing\s+Style[s]?.*",
                r"\s*Roast\s*(?:Profile|Level|Type)?\s*[:\-–].*",
                r"\s*Varietal\s*[:\-–].*",
                r"\s*SCA\s+Cup\s+Score.*",
            ]:
                s = re.split(pat, s, flags=re.IGNORECASE)[0]
            s = re.sub(r"\s*[·|]\s*", ", ", s)
            s = s.strip(" -:;.,")
            if len(s) <= max_len:
                return s
            cut = s[:max_len]
            comma = cut.rfind(",")
            space = cut.rfind(" ")
            idx = comma if comma > max_len * 0.6 else space
            return cut[:idx].strip(" ,") if idx > 0 else cut.rstrip()

        # ── 1. Explicit labeled sections — checked BEFORE any noise stripping ─
        # "Cupper's Notes:", "Tasting Notes:", "Flavour Notes:", "Tastes Like:" etc.
        # Also catches the scraped product_fields block appended by the scraper.
        STOP = (
            r"(?=\s*(?:"
            r"Roast(?:\s+Level)?|Process(?:ing)?|Varietal|Altitude|Origin|Producer"
            r"|Region|Elevation|Location|Variety|SCA|Recommended\s+[Bb]rewing"
            r"|Brewing\s+[Mm]ethod|Brewing\s+Style|Pour\s+Over|French\s+Press|Aeropress"
            r"|Moka\s+[Pp]ot|Espresso\s+Machine|Cold\s+Brew|Drip|Grind"
            r"|\Z"
            r"))"
        )
        m = re.search(
            r"(?:Cupper['']?s\s+Notes?|Tasting\s+Notes?|Flavou?r\s+Notes?|Flavor\s+Notes?|Tastes?\s+Like|Tastes?:)\s*[-:]?\s*(.+?)" + STOP,
            text, re.IGNORECASE | re.DOTALL
        )
        if m:
            candidate = m.group(1).strip(" -:;.,")
            candidate = re.split(r"\.\s+[A-Z]", candidate)[0]
            candidate = _clean(candidate)
            if 5 < len(candidate) < 220:
                return candidate

        # ── Pre-process further for remaining strategies ──────────────────────
        # Now safe to strip trailing metadata (only needed when no labeled section found)
        TRAILING_NOISE = (
            r"\s*(?:Varietal|Variety|SCA\s+Cup\s+Score|Cup\s+Score|Roast\s*(?:Profile|Level|Type)?|"
            r"Process(?:ing)?|Origin|Region|Location|Elevation|Altitude|Producer|Farm|Estate|"
            r"Brewing\s+Style[s]?|Best\s+Brewed\s+With|Recommended\s+Brewing|"
            r"Brew\s+Methods?|Brew\s+Guide|Grind\s+Size|Brewing\s+Methods?|"
            r"M\.?R\.?P|MRP|Rs\.|₹)\s*[:\-–]?.*$"
        )
        text = re.sub(TRAILING_NOISE, "", text, flags=re.IGNORECASE).strip()

        # Strip note prefixes
        text = re.sub(
            r"^(?:Coffee\s+Notes?\s*(?:\([^)]*\))?\s*[:\-–]|Taste\s+Profile\s*[:\-–]?)\s*",
            "", text, flags=re.IGNORECASE
        ).strip()

        if not text:
            return ""

        # ── 2. "Notes of X, Y" / "Hints of..." / "Flavours of..." ────────────
        m = re.search(r"(?:Notes|Hints|Flavours|Flavors)\s+of\s+([^.!?\n]{5,120})", text, re.IGNORECASE)
        if m:
            return _clean(m.group(1))

        # ── 3. "you'll taste / notice / find X, Y, Z" ────────────────────────
        m = re.search(
            r"(?:you.ll\s+(?:be able to\s+)?(?:taste|notice|find)|taste[sd]?\s+of|reminds?(?:\s+you)?\s+of)"
            r"\s+([^.!?\n]{5,180})",
            text, re.IGNORECASE
        )
        if m:
            return _clean(m.group(1))

        # ── 4. Bullet / separator lists: "Hazelnut • Grape • Cocoa" ──────────
        m = re.search(
            r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*[•·|/]\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*[•·|/]\s*[A-Z][a-z]+[^.\n]{0,100})",
            text
        )
        if m:
            return _clean(m.group(1))

        # ── 5. Best-scoring sentence fallback ────────────────────────────────
        FLAVORS = {
            "chocolate", "caramel", "berry", "berries", "citrus", "fruity", "nutty",
            "honey", "floral", "vanilla", "orange", "lemon", "lime", "currant", "apple",
            "cocoa", "toffee", "molasses", "jasmine", "peach", "plum", "cherry",
            "jaggery", "mango", "banana", "cardamom", "cinnamon", "clove", "rose",
            "hazelnut", "cashew", "walnut", "almond", "coconut", "guava", "pineapple",
            "malt", "blackberry", "raspberry", "blueberry", "strawberry", "raisin",
            "prune", "pomegranate", "grape", "pear", "grapefruit", "dark chocolate",
            "brown sugar", "black tea", "chamomile", "fig", "apricot", "tamarind",
            "sugarcane", "spice", "tobacco", "pepper", "anise", "butter", "cream",
        }
        TASTE_TRIGGERS = {
            "notes", "flavor", "flavour", "tasting", "taste", "aroma",
            "finish", "aftertaste", "palate", "cup", "acidity", "body",
        }

        # Short clean result with no residual metadata noise → return directly
        if len(text) <= 80 and not re.search(
            r"\b(?:origin|process|varietal|elevation|altitude|roast|brewing)\b",
            text, re.IGNORECASE
        ):
            candidate = _clean(text)
            if 5 < len(candidate):
                return candidate

        best_sent, best_score = "", 0
        for sent in re.split(r"(?<=[.!?])\s+", text):
            sl = sent.lower()
            if re.search(r"recommended\s+brewing|pour\s+over|french\s+press|brewing\s+method", sl):
                continue
            flavor_count = sum(1 for f in FLAVORS if f in sl)
            has_trigger = any(t in sl for t in TASTE_TRIGGERS)
            score = flavor_count * 2 + (1 if has_trigger else 0)
            if score > best_score and 10 < len(sent) < 300:
                best_score, best_sent = score, sent

        return _clean(best_sent) if best_score >= 3 else ""


    @staticmethod
    def parse_variant_prices(variant_prices_str: str, base_price: float | None) -> list[tuple[str, float | None]]:
        """
        Parse the variant_prices field into a list of (weight_label, price) tuples.

        Handles two formats produced by scrapers:
          Shopify: "250g:450.00; 500g:800.00; 1kg:1500.00"  → each weight gets its own price
          HTML:    "250g; 500g"                              → each weight falls back to base_price
          Single:  ":450.00"                                 → no weight label, single price
          Empty:   ""                                        → [("", base_price)]

        Non-weight variant labels (brewing methods like "Pour Over-V60", "Espresso",
        "French Press", "AeroPress") are stored as empty-string weights so they
        don't show up as product quantities.

        Returns list of (weight_label, price_float_or_None).
        An empty weight_label means the product has no size variants.
        """
        BREWING_METHOD_KEYWORDS = [
            "pour over", "pourover", "v60", "espresso", "french press",
            "aeropress", "moka pot", "cold brew", "drip", "filter",
            "chemex", "siphon", "whole bean", "ground", "beans",
            "fine grind", "medium grind", "coarse grind",
        ]

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

            # Normalise weight units  (e.g. "250gm" → "250g", "250 Grams" → "250g", "1 KG" → "1kg")
            m = re.match(r"(\d+(?:\.\d+)?)\s*(kg|kilo|kilos|g|gm|grams|gram|ml)", weight_label, re.IGNORECASE)
            if m:
                qty, unit = m.groups()
                unit_lower = unit.lower()
                if unit_lower in {"gm", "grams", "gram"}:
                    unit_lower = "g"
                elif unit_lower in {"kilo", "kilos"}:
                    unit_lower = "kg"
                weight_label = f"{qty}{unit_lower}"
            else:
                # Not a recognizable weight — check if it's a brewing method label
                label_lower = weight_label.lower()
                if any(kw in label_lower for kw in BREWING_METHOD_KEYWORDS):
                    weight_label = ""

            results.append((weight_label, price_val))

        return results if results else [("", base_price)]

    @staticmethod
    def parse_origin(name: str, desc: str) -> str:
        return _extract_origin(name, desc)

    @staticmethod
    def parse_process(desc: str) -> str:
        if not desc:
            return ""
        text = " ".join(desc.split())

        # 1. Explicit labeled field
        m = re.search(
            r"(?:Processed?(?:ing)?|Process)\s*[:\-]?\s*([A-Za-z][A-Za-z,\s\-/]{2,60}?)"
            r"(?=\s*(?:\n|$|\.|Roast|Variety|Varietal|Altitude|Origin|Location|Elevation|Flavour|Flavor|Tasting))",
            text, re.IGNORECASE
        )
        if m:
            raw = m.group(1).strip(" ,.-")
            if len(raw) < 60:
                return raw

        # 2. Keyword match (ordered: most specific first)
        PROCESSES = [
            ("Carbonic Maceration", ["carbonic maceration", "carbonic mac", r"\bCM\b"]),
            ("Lactic Fermentation", ["lactic fermentation", "lactic process", "lactic washed"]),
            ("Double Fermented", ["double ferment"]),
            ("Wine Process", ["wine process", "wine barrel"]),
            ("Barrel Aged", ["barrel.aged", "barrel aged", "whisky barrel", "whiskey barrel", "rum barrel"]),
            ("Anaerobic Natural", ["anaerobic natural"]),
            ("Anaerobic Washed", ["anaerobic washed"]),
            ("Anaerobic", ["anaerobic"]),
            ("Natural", ["natural", "sun.dried", "sundried", "dry process", "naturals"]),
            ("Washed", ["washed", "wet process", "fully washed"]),
            ("Honey", ["honey process", "honey.processed", "pulped natural"]),
            ("Monsooned", ["monsooned", "monsoon malabar"]),
            ("Semi-Washed", ["semi.washed", "semi washed"]),
        ]
        tl = text.lower()
        for label, patterns in PROCESSES:
            if any(re.search(p, tl) for p in patterns):
                return label

        return ""

    @staticmethod
    def classify_product(name: str, desc: str) -> str:
        """Classify a product as Coffee, Tea, Accessories, Events, or Subscriptions."""
        name_lower = name.lower()
        desc_lower = desc.lower() if desc else ""

        # Subscription
        if "subscription" in name_lower or "subscribe" in name_lower or "membership" in name_lower:
            return "Subscriptions"

        # Events — tasting sessions, workshops, throwdowns, etc.
        event_keywords = [
            "tasting session", "cupping session", "latte art",
            "throwdown", "workshop", "masterclass", "master class",
            "event", "meetup", "meet up", "coffee walk", "brew class",
            "competition", "championship", "gully tour", "coffee tour",
            "coffee chronicles",
        ]
        if any(kw in name_lower for kw in event_keywords):
            return "Events"

        # Tea — strong indicators in name
        tea_strong = [
            "green tea", "black tea", "white tea", "oolong", "rooibos",
            "herbal tea", "tisane", "earl grey", "matcha", "cascara",
            "blossom tea", "masala tea", "masala chai",
        ]
        tea_words = [" tea ", " tea,", " tea)", "(tea)"]
        is_tea = (
            any(kw in name_lower for kw in tea_strong)
            or any(kw in f" {name_lower} " for kw in tea_words)
            or name_lower.endswith(" tea") or name_lower.endswith(" chai")
        )
        # Only treat as tea if name isn't clearly about coffee beans/roast
        strong_coffee = any(
            kw in name_lower
            for kw in ["coffee bean", "coffee roast", "roasted coffee", "whole bean"]
        )
        if is_tea and not strong_coffee:
            return "Tea"

        # Quick Brews — drip bags, brew bags, instant coffee, pour over bags, liquid coffee
        # Must be checked BEFORE accessories since "pour over bag" would match "pour over"
        quick_brew_patterns = [
            r"drip\s*bag", r"brew\s*bag", r"pour\s*over\s*bag",
            r"instant\s*brew", r"instant\s*coffee", r"cold\s*brew\s*bag",
            r"liquid\s*coffee", r"\bdoppio\b", r"\bsachet",
            r"quick\s*brew", r"brewin['’]?-?a-?cup",
            r"single\s*pour\s*drip", r"no\s*equipment\s*needed",
        ]
        if any(re.search(p, name_lower) for p in quick_brew_patterns):
            return "Quick Brews"

        # Accessories — equipment, drinkware, merch
        accessory_keywords = [
            "grinder", "kettle", "v60", "chemex", "aeropress", "french press",
            "moka pot", "dripper", "pour over", "mug", "tumbler", "scale",
            "frother", "filter paper", "t-shirt", "tote bag", "sticker",
            "gift box", "gift card", "hamper", "coaster", "candle",
            "saucer", "server", "pitcher", "carafe", "tamper", "portafilter",
            "knock box", "cup", "cups", "glass ", "sipper", "flask",
            "hoodie", "cap ", "tote", "merch", "badge",
            "espresso machine", "coffee machine", "coffee maker",
            "semi automatic machine", "weighing scale",
            "totebag", "tote bag", "drip kit",
        ]
        definitely_not_coffee = [
            "bike", "rental", "yoga", "meditation", "pottery", "workshop",
            "tour", "spa", "massage", "meal", "parking", "voucher",
            "puzzle", "game", "cushion", "pillow", "blanket", "backpack",
            "umbrella", "keychain", "magnet", "perfume", "soap",
        ]
        if any(kw in name_lower for kw in definitely_not_coffee):
            return "Accessories"
        if any(kw in name_lower for kw in accessory_keywords):
            coffee_in_name = any(
                kw in name_lower
                for kw in ["coffee", "bean", "roast", "espresso blend", "arabica", "robusta"]
            )
            if not coffee_in_name:
                return "Accessories"
            # Has both accessory + coffee words — strong coffee indicators win
            strong_coffee_indicators = [
                "arabica", "robusta", "whole bean", "ground coffee",
                "pure coffee", "premium coffee", "single origin",
                "100% pure", "blend ", " blend", "peaberry",
            ]
            if any(kw in name_lower for kw in strong_coffee_indicators):
                pass  # It's coffee — fall through to return Coffee
            else:
                # Strong accessory keywords win when coffee signal is weak
                strong_acc = [
                    "grinder", "kettle", "v60", "chemex", "aeropress", "french press",
                    "moka pot", "tumbler", "mug", "machine", "saucer", "server",
                    "pitcher", "frother", "tamper", "brewer", "pour over",
                    "semi automatic", "weighing scale", "tote bag", "totebag",
                ]
                if any(kw in name_lower for kw in strong_acc):
                    return "Accessories"

        # High-price equipment detection — coffee machines, commercial gear
        # (things priced way above any coffee bag, usually >Rs.10000 with equipment keywords in desc)
        try:
            from pipeline.cleaner import GenericRoastersCleaner
        except ImportError:
            pass

        return "Coffee"

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

            # Prefer scraper-extracted fields; fall back to description parsing
            raw_tasting = row.get("tasting_notes", "")
            raw_tasting = "" if pd.isna(raw_tasting) else str(raw_tasting).strip()
            tasting_notes = raw_tasting if raw_tasting else self.parse_tasting_notes(desc)

            raw_origin = row.get("origin", "")
            raw_origin = "" if pd.isna(raw_origin) else str(raw_origin).strip()
            origin = raw_origin if raw_origin else self.parse_origin(name_raw, desc)

            raw_process = row.get("process", "")
            raw_process = "" if pd.isna(raw_process) else str(raw_process).strip()
            process = raw_process if raw_process else self.parse_process(desc)

            category = self.classify_product(name_raw, desc)

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
                        "Origin": origin,
                        "Process": process,
                        "Desc": desc,
                        "URL": url,
                        "Image_URL": image_url,
                        "Category": category,
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

