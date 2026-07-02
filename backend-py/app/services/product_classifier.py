"""Product classifier — assigns products to explore categories.

The explore page shows only two sections:
  - Coffee: actual coffee beans (whole bean, ground)
  - Quick Brews: brew bags, drip bags, pour over bags, instant brews,
                 cold brew bags, liquid coffee concentrates

Everything else (tea, accessories, events, subscriptions, machines,
gift sets, equipment) is excluded from the explore view.
"""

import re
from typing import Optional

# ─── Quick Brew detection patterns ────────────────────────────────────────────
# Order matters: checked before "is it a bean?"
_QUICK_BREW_PATTERNS = [
    r"drip\s*bag",
    r"brew\s*bag",
    r"pour\s*over\s*bag",
    r"instant\s*brew",
    r"instant\s*coffee",
    r"cold\s*brew\s*bag",
    r"liquid\s*coffee",
    r"doppio",                    # Doppio liquid coffee sachets
    r"sachet",
    r"quick\s*brew",
    r"brewin['’]?-?a-?cup",
    r"single\s*pour\s*drip",
    r"ready\s*in\s*seconds",
    r"no\s*equipment\s*needed",
]

_QUICK_BREW_RE = re.compile("|".join(_QUICK_BREW_PATTERNS), re.IGNORECASE)

# ─── Exclusion patterns — items that are NOT coffee beans ─────────────────────
# These get excluded from the "Coffee" category entirely
_EQUIPMENT_PATTERNS = [
    r"\bmachine\b",
    r"\bespresso\s*machine\b",
    r"\bgrinder\b",
    r"\bgaggia\b",
    r"\bjura\b",
    r"\bbriel\b",
    r"\bwpm\b",
    r"\bcasadio\b",
    r"\bcimbali\b",
    r"\bcafelat\b",
    r"\bla\s*carimali\b",
    r"\bsaeco\b",
    r"\bbarisieur\b",
    r"\balarm\s*clock\b",
    r"\bthermometer\b",
    r"\b(digital\s*)?coffee\s*brewing\s*(digital\s*)?timer\b",
    r"\b2-?waycup\b",
    r"\brefined\s*2-?waycup\b",
    # Brewing equipment brands/items (standalone, not "for French Press")
    r"\bcafflano\b",
    r"\bhario\s*v60\b",
    r"\borigami\s*coffee\s*dripper\b",
    r"\borigami\s*.*holder\b",
    r"\bclever\s*coffee\s*dripper\b",
    r"\bcoffee\s*server\s*set\b",
    r"\bcoffee\s*maker\b",
    r"\baeropress\s*coffee\s*maker\b",
    r"\bairscape\b",
    r"\bstorage\s*container\b",
    # Mugs, cups, accessories
    r"\bcoffee\s*mug\b",
    r"\bporcelain\s*.*mug\b",
    r"\bcup\s*&\s*saucer\b",
    r"\bweighing\s*scale\b",
    # Events / workshops miscategorized as coffee
    r"\bsip\s*&\s*paint\b",
    r"\bpaint\s*bar\b",
    r"\btraining\s*program\b",
    r"\bhands-?on\s*training\b",
]

_GIFT_COMBO_PATTERNS = [
    r"\bgift\s*(box|set)\b",
    r"\bbrewing\s*gift\b",
    r"\bcombo\b",
]

_EXCLUDED_RE = re.compile(
    "|".join(_EQUIPMENT_PATTERNS + _GIFT_COMBO_PATTERNS), re.IGNORECASE
)

# ─── Explore categories ───────────────────────────────────────────────────────

EXPLORE_CATEGORIES = ["Coffee", "Quick Brews"]


def classify_product(name: str, category: Optional[str] = None) -> Optional[str]:
    """Classify a product into an explore category.

    Returns:
        "Coffee"      — actual coffee beans (whole, ground)
        "Quick Brews" — brew bags, drip bags, instant, liquid coffee
        None          — excluded from explore (tea, accessories, events, etc.)
    """
    if not name:
        return None

    # Non-coffee categories are always excluded
    if category and category not in ("Coffee", "Accessories"):
        return None

    # Check Quick Brew first (before exclusion, since brew bags are valid)
    if _QUICK_BREW_RE.search(name):
        return "Quick Brews"

    # Accessories that aren't quick brews are excluded
    if category == "Accessories":
        return None

    # Equipment/machines/gift sets masquerading as "Coffee" — exclude
    if _EXCLUDED_RE.search(name):
        return None

    # What's left in the "Coffee" category is actual beans
    if category == "Coffee":
        return "Coffee"

    return None


def get_explore_filter_sql(explore_category: str) -> tuple[str, list]:
    """Return (WHERE clause fragment, params) for filtering by explore category.

    This builds SQL conditions that replicate the classify_product logic
    at the database level for efficient querying.
    """
    if explore_category == "Quick Brews":
        # Match products whose name hits any quick-brew pattern
        # From either Coffee or Accessories original category
        like_clauses = []
        for pattern in [
            "%drip bag%", "%brew bag%", "%pour over bag%",
            "%instant brew%", "%instant coffee%", "%cold brew bag%",
            "%liquid coffee%", "%doppio%", "%sachet%",
            "%quick brew%", "%brewin%cup%", "%single pour drip%",
            "%ready in seconds%", "%no equipment needed%",
        ]:
            like_clauses.append("LOWER(p.name) LIKE ?")

        conditions = (
            f"p.category IN ('Coffee', 'Accessories') "
            f"AND ({' OR '.join(like_clauses)})"
        )
        params = [
            "%drip bag%", "%brew bag%", "%pour over bag%",
            "%instant brew%", "%instant coffee%", "%cold brew bag%",
            "%liquid coffee%", "%doppio%", "%sachet%",
            "%quick brew%", "%brewin%cup%", "%single pour drip%",
            "%ready in seconds%", "%no equipment needed%",
        ]
        return conditions, params

    elif explore_category == "Coffee":
        # Coffee category, NOT quick brews, NOT equipment/gifts
        quick_brew_excludes = []
        for pattern in [
            "%drip bag%", "%brew bag%", "%pour over bag%",
            "%instant brew%", "%instant coffee%", "%cold brew bag%",
            "%liquid coffee%", "%doppio%", "%sachet%",
            "%quick brew%", "%brewin%cup%", "%single pour drip%",
            "%ready in seconds%", "%no equipment needed%",
        ]:
            quick_brew_excludes.append(f"LOWER(p.name) NOT LIKE ?")

        equipment_excludes = []
        for pattern in [
            "%machine%", "%grinder%", "%gaggia%", "%jura%",
            "%briel%", "%wpm %", "%casadio%", "%cimbali%",
            "%carimali%", "%saeco%", "%barisieur%",
            "%alarm clock%", "%thermometer%",
            "%coffee brewing%timer%", "%digital%timer%",
            "%2-waycup%", "%2waycup%",
            "%cafflano%", "%hario v60%",
            "%origami coffee dripper%", "%origami%holder%",
            "%clever coffee dripper%", "%coffee server set%",
            "%coffee maker%", "%aeropress coffee maker%",
            "%airscape%", "%storage container%",
            "%coffee mug%", "%porcelain%mug%", "%cup & saucer%",
            "%weighing scale%",
            "%sip & paint%", "%paint bar%",
            "%training program%", "%hands%training%",
            "%gift box%", "%gift set%", "%brewing gift%", "%combo%",
        ]:
            equipment_excludes.append(f"LOWER(p.name) NOT LIKE ?")

        all_excludes = quick_brew_excludes + equipment_excludes
        conditions = f"p.category = 'Coffee' AND {' AND '.join(all_excludes)}"
        params = [
            # Quick brew exclusions
            "%drip bag%", "%brew bag%", "%pour over bag%",
            "%instant brew%", "%instant coffee%", "%cold brew bag%",
            "%liquid coffee%", "%doppio%", "%sachet%",
            "%quick brew%", "%brewin%cup%", "%single pour drip%",
            "%ready in seconds%", "%no equipment needed%",
            # Equipment/gift exclusions
            "%machine%", "%grinder%", "%gaggia%", "%jura%",
            "%briel%", "%wpm %", "%casadio%", "%cimbali%",
            "%carimali%", "%saeco%", "%barisieur%",
            "%alarm clock%", "%thermometer%",
            "%coffee brewing%timer%", "%digital%timer%",
            "%2-waycup%", "%2waycup%",
            "%cafflano%", "%hario v60%",
            "%origami coffee dripper%", "%origami%holder%",
            "%clever coffee dripper%", "%coffee server set%",
            "%coffee maker%", "%aeropress coffee maker%",
            "%airscape%", "%storage container%",
            "%coffee mug%", "%porcelain%mug%", "%cup & saucer%",
            "%weighing scale%",
            "%sip & paint%", "%paint bar%",
            "%training program%", "%hands%training%",
            "%gift box%", "%gift set%", "%brewing gift%", "%combo%",
        ]
        return conditions, params

    # Fallback — shouldn't reach here with valid explore categories
    return "1=0", []
