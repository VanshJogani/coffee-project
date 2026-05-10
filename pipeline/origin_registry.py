"""
Canonical origin/region registry for Indian specialty coffee products.

Single source of truth: maps all known spelling variants (lowercase) to their
canonical display name.  Used by the pipeline cleaner to validate extracted
origins, ensuring only real geographic locations make it into the cleaned data.
"""

import re
from typing import Optional

# ─── Canonical origins: lowercase key → display name ──────────────────────────
# Covers: Indian coffee-growing regions, well-known estates, and international
# origins that appear in the Indian specialty market.

KNOWN_ORIGINS: dict[str, str] = {
    # ── Indian Regions ────────────────────────────────────────────────────────
    "chikmagalur": "Chikmagalur",
    "chikkamagalur": "Chikmagalur",
    "chikkamagaluru": "Chikmagalur",
    "chikmaglur": "Chikmagalur",
    "chikmangalur": "Chikmagalur",
    "chickamagalur": "Chikmagalur",
    "chickmagalur": "Chikmagalur",
    "coorg": "Coorg",
    "kodagu": "Coorg",
    "kodagu (coorg)": "Coorg",
    "hassan": "Hassan",
    "sakleshpur": "Sakleshpur",
    "sakleshpura": "Sakleshpur",
    "manjarabad": "Manjarabad",
    "bababudan giri": "Bababudan Giri",
    "bababudangiri": "Bababudan Giri",
    "bababudangiris": "Bababudan Giri",
    "bababudan-giris": "Bababudan Giri",
    "baba budan giri": "Bababudan Giri",
    "bababudan giris": "Bababudan Giri",
    "br hills": "BR Hills",
    "biligiri hills": "BR Hills",
    "biligiri rangana hills": "BR Hills",
    "wayanad": "Wayanad",
    "waynad": "Wayanad",
    "nilgiris": "Nilgiris",
    "nilgiri": "Nilgiris",
    "the nilgiris": "Nilgiris",
    "araku": "Araku Valley",
    "araku valley": "Araku Valley",
    "shevaroy": "Shevaroy Hills",
    "shevaroy hills": "Shevaroy Hills",
    "shevaroys": "Shevaroy Hills",
    "pulney hills": "Pulney Hills",
    "pulneys": "Pulney Hills",
    "palani hills": "Pulney Hills",
    "yercaud": "Yercaud",
    "karnataka": "Karnataka",
    "kudremukh": "Kudremukh",
    "kudremukh biosphere": "Kudremukh",
    "malabar": "Malabar Coast",
    "malabar coast": "Malabar Coast",
    "meghalaya": "Meghalaya",
    "darjeeling": "Darjeeling",
    "assam": "Assam",
    "tripura": "Tripura",
    "uttarakhand": "Uttarakhand",
    "kashmir": "Kashmir",
    "krishnagiri": "Krishnagiri",
    "belur": "Belur",
    "kerehaklu": "Kerehaklu",
    "mokokchung": "Mokokchung",
    "koraput": "Koraput",
    "kindiriguda": "Kindiriguda",
    "pachalur": "Pachalur",
    "p achalur": "Pachalur",
    "pearl mountain": "Pearl Mountain",
    "manikyadhara hills": "Manikyadhara Hills",
    "kaimara belt": "Kaimara Belt",
    "kaimara": "Kaimara Belt",
    "mudigere": "Mudigere",
    "aldur": "Aldur",
    "somwarpet": "Somwarpet",
    "virajpet": "Virajpet",
    "madikeri": "Madikeri",
    "anamalais": "Anamalais",
    "anaimalai": "Anamalais",
    "anamalai": "Anamalais",
    "munnar": "Munnar",
    "idukki": "Idukki",
    "nagaland": "Nagaland",
    "mizoram": "Mizoram",
    "arunachal": "Arunachal Pradesh",
    "arunachal pradesh": "Arunachal Pradesh",
    "manipur": "Manipur",
    "tamil nadu": "Tamil Nadu",
    "kerala": "Kerala",
    "andhra pradesh": "Andhra Pradesh",
    "kohima": "Kohima",
    "kohima district": "Kohima",

    # ── Indian Estates ────────────────────────────────────────────────────────
    "baarbara estate": "Baarbara Estate",
    "baarbara": "Baarbara Estate",
    "bison valley estate": "Bison Valley Estate",
    "bison valley": "Bison Valley Estate",
    "dimbada estate": "Dimbada Estate",
    "kalledevarapura estate": "Kalledevarapura Estate",
    "kalledevarapura": "Kalledevarapura Estate",
    "kalyancool estate": "Kalyancool Estate",
    "kalyancool": "Kalyancool Estate",
    "kerehaklu estate": "Kerehaklu Estate",
    "kogilahalla estate": "Kogilahalla Estate",
    "kogilahalla": "Kogilahalla Estate",
    "kuttinkkhan estate": "Kuttinkkhan Estate",
    "kuttinkkhan lower estate": "Kuttinkkhan Estate",
    "kuttinkhan estate": "Kuttinkkhan Estate",
    "laks farm": "Laks Farm",
    "mooleh manay estate": "Mooleh Manay Estate",
    "mooleh manay": "Mooleh Manay Estate",
    "orchardale": "Orchardale Estate",
    "orchardale estate": "Orchardale Estate",
    "pkc kudiraipanjan estate": "PKC Kudiraipanjan Estate",
    "ratagiri estate": "Ratnagiri Estate",
    "ratnagiri estate": "Ratnagiri Estate",
    "ratnagiri": "Ratnagiri Estate",
    "riverdale estate": "Riverdale Estate",
    "riverdale": "Riverdale Estate",
    "sandalwood estate": "Sandalwood Estate",
    "swarnagiri estate": "Swarnagiri Estate",
    "unakki estate": "Unakki Estate",
    "zoya coffee estate": "Zoya Coffee Estate",
    "ammikulavi estate": "Ammikulavi Estate",
    "ammikulavi": "Ammikulavi Estate",
    "anughraha estates": "Anughraha Estates",
    "anughraha": "Anughraha Estates",
    "hulihundloo estate": "Hulihundloo Estate",
    "hulihundloo coffee estate": "Hulihundloo Estate",
    "thogarihunkal estate": "Thogarihunkal Estate",
    "thogarihunkal": "Thogarihunkal Estate",
    "attikan estate": "Attikan Estate",
    "attikan": "Attikan Estate",
    "gemblary estate": "Gemblary Estate",
    "balanoor": "Balanoor Estate",
    "balanoor estate": "Balanoor Estate",

    # ── International Origins ─────────────────────────────────────────────────
    "ethiopia": "Ethiopia",
    "yirgacheffe": "Yirgacheffe",
    "sidamo": "Sidamo",
    "guji": "Guji",
    "sumatra": "Sumatra",
    "java": "Java",
    "bali": "Bali",
    "colombia": "Colombia",
    "brazil": "Brazil",
    "guatemala": "Guatemala",
    "costa rica": "Costa Rica",
    "panama": "Panama",
    "honduras": "Honduras",
    "peru": "Peru",
    "mexico": "Mexico",
    "kenya": "Kenya",
    "rwanda": "Rwanda",
    "burundi": "Burundi",
    "tanzania": "Tanzania",
    "congo": "Congo",
    "uganda": "Uganda",
    "vietnam": "Vietnam",
    "myanmar": "Myanmar",
    "yemen": "Yemen",
    "japan": "Japan",
    "hawaii": "Hawaii",
    "jamaica": "Jamaica",
    "cooperative tarrazu": "Tarrazu",
    "tarrazu": "Tarrazu",
    "apaneca": "Apaneca",
    "isimbi": "Isimbi",
    "idido": "Idido",
    "oromia": "Oromia",
    "kiambu": "Kiambu",
    "south africa": "South Africa",
    "yunnan": "Yunnan",
}

# Pre-compile a pattern that matches any known origin as a whole word in text.
# Sorted longest-first so "Bababudan Giri" matches before "Bababudan".
_SORTED_KEYS = sorted(KNOWN_ORIGINS.keys(), key=len, reverse=True)
_ORIGIN_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in _SORTED_KEYS) + r")\b",
    re.IGNORECASE,
)


def normalize_origin(raw: str) -> Optional[str]:
    """
    Given a raw origin string, return the canonical display name if it matches
    a known origin, or None if it's not recognized.
    """
    if not raw or not isinstance(raw, str):
        return None
    key = raw.strip().lower()
    if not key:
        return None
    return KNOWN_ORIGINS.get(key)


def extract_origin(name: str, desc: str) -> str:
    """
    Extract and validate origin from product name + description.

    Strategy:
      1. Look for explicit labeled fields ("Location:", "Origin:", "Estate:")
         and validate the captured text against the registry.
      2. Scan the combined name+desc for any known origin mention.
      3. Return empty string if nothing valid is found.
    """
    combined = f"{name} {desc}" if desc else name
    if not combined.strip():
        return ""

    # 1. Try explicit labels — extract and validate
    label_match = re.search(
        r"(?:Location|Origin|Estate|Farm|Region|Grown\s+at|Sourced\s+from)\s*[:\-–]?\s*"
        r"([A-Za-z][A-Za-z,\s\-()]{2,60}?)(?=\s*(?:\n|$|\.|,\s*[A-Z]|Process|Roast|Elevation|Altitude|Variety|Varietal))",
        combined, re.IGNORECASE,
    )
    if label_match:
        candidate = label_match.group(1).strip(" ,.-")
        normalized = normalize_origin(candidate)
        if normalized:
            return normalized
        # The label captured something — check if a known origin is inside it
        sub_match = _ORIGIN_PATTERN.search(candidate)
        if sub_match:
            return KNOWN_ORIGINS[sub_match.group(1).lower()]

    # 2. Scan full text for any known origin mention
    match = _ORIGIN_PATTERN.search(combined)
    if match:
        return KNOWN_ORIGINS[match.group(1).lower()]

    return ""
