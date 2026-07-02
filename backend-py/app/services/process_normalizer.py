"""Coffee processing taxonomy and normalizer — port of processNormalizer.js."""

COFFEE_PROCESSING_TAXONOMY: dict = {
    "Wet Processes": {
        "description": "Processes where coffee cherries are depulped and fermented/washed before drying.",
        "methods": {
            "Washed": {"aliases": ["Wet Process", "Fully Washed"], "parent": None},
            "Semi-Washed": {"aliases": ["Semi Wet"], "parent": "Washed"},
            "Double Fermented": {"aliases": [], "parent": "Washed"},
            "Wet Hulled": {"aliases": ["Giling Basah"], "parent": "Washed"},
            "Nitro Washed": {"aliases": [], "parent": "Washed"},
        },
    },
    "Dry Processes": {
        "description": "Processes where cherries are dried with fruit intact.",
        "methods": {
            "Natural": {"aliases": ["Dry Process", "Sun Dried Natural"], "parent": None},
            "Sun Dried": {"aliases": [], "parent": "Natural"},
            "Tree Dried": {"aliases": [], "parent": "Natural"},
            "Raisin Process": {"aliases": [], "parent": "Natural"},
            "Monsooned": {"aliases": [], "parent": "Natural"},
        },
    },
    "Honey & Mucilage Retained Processes": {
        "description": "Processes retaining varying levels of mucilage during drying.",
        "methods": {
            "Honey": {"aliases": ["Miel Process"], "parent": None},
            "White Honey": {"aliases": [], "parent": "Honey"},
            "Yellow Honey": {"aliases": [], "parent": "Honey"},
            "Red Honey": {"aliases": [], "parent": "Honey"},
            "Black Honey": {"aliases": [], "parent": "Honey"},
            "Gold Honey": {"aliases": [], "parent": "Honey"},
            "Pink Honey": {"aliases": [], "parent": "Honey"},
            "Partial Honey": {"aliases": [], "parent": "Honey"},
        },
    },
    "Hybrid Processes": {
        "description": "Processes combining washed and natural characteristics.",
        "methods": {
            "Pulped Natural": {"aliases": ["Semi-Dry", "Honey Pulped"], "parent": None},
            "Mixed Process": {"aliases": ["Hybrid Process"], "parent": None},
        },
    },
    "Anaerobic & Controlled Fermentation": {
        "description": "Processes involving oxygen-controlled or precision fermentation.",
        "methods": {
            "Anaerobic": {"aliases": ["Anaerobic Fermentation"], "parent": None},
            "Carbonic Maceration": {"aliases": ["CM"], "parent": "Anaerobic"},
            "Lactic Fermentation": {"aliases": [], "parent": "Anaerobic"},
            "Acetic Fermentation": {"aliases": [], "parent": "Anaerobic"},
            "Yeast Inoculated": {"aliases": ["Cultured Fermentation"], "parent": "Anaerobic"},
            "Nitrogen Maceration": {"aliases": [], "parent": "Anaerobic"},
            "Vacuum Fermentation": {"aliases": [], "parent": "Anaerobic"},
            "Pressure Fermentation": {"aliases": [], "parent": "Anaerobic"},
            "Thermal Shock": {"aliases": [], "parent": "Anaerobic"},
            "Cold Fermentation": {"aliases": [], "parent": "Anaerobic"},
            "Ice Fermentation": {"aliases": [], "parent": "Anaerobic"},
        },
    },
    "Co-Fermented & Flavor-Infused Processes": {
        "description": "Processes involving added fruits, spices, yeasts, or external flavor agents.",
        "methods": {
            "Co-Fermented": {"aliases": [], "parent": None},
            "Fruit Maceration": {"aliases": [], "parent": "Co-Fermented"},
            "Spice Fermentation": {"aliases": [], "parent": "Co-Fermented"},
            "Barrel Aged": {"aliases": [], "parent": "Co-Fermented"},
            "Whisky Barrel": {"aliases": [], "parent": "Barrel Aged"},
            "Rum Barrel": {"aliases": [], "parent": "Barrel Aged"},
            "Wine Process": {"aliases": [], "parent": "Co-Fermented"},
        },
    },
    "Drying & Post-Processing Methods": {
        "description": "Methods primarily differentiated by drying or post-processing techniques.",
        "methods": {
            "Freeze Dried": {"aliases": [], "parent": None},
            "Shade Dried": {"aliases": [], "parent": None},
            "Solar Dried": {"aliases": [], "parent": None},
            "Slow Dried": {"aliases": [], "parent": None},
            "Mechanical Dried": {"aliases": [], "parent": None},
            "African Bed Dried": {"aliases": [], "parent": None},
        },
    },
    "Experimental & Emerging Processes": {
        "description": "Novel and competition-level experimental methods.",
        "methods": {
            "Controlled Microbial Fermentation": {"aliases": [], "parent": None},
            "Sequential Fermentation": {"aliases": [], "parent": None},
            "Multi-Stage Fermentation": {"aliases": [], "parent": None},
            "Enzyme Assisted Fermentation": {"aliases": [], "parent": None},
            "Mosto Fermentation": {"aliases": [], "parent": None},
            "Osmotic Dehydration": {"aliases": [], "parent": None},
            "Ultrasonic Fermentation": {"aliases": [], "parent": None},
            "Cascade Fermentation": {"aliases": [], "parent": None},
            "Bioinnovation Processing": {"aliases": [], "parent": None},
        },
    },
}


def _build_process_lookup() -> dict[str, str]:
    """Build alias → canonical name lookup table."""
    lookup = {}
    for category in COFFEE_PROCESSING_TAXONOMY.values():
        methods = category["methods"]
        for method_name, method_data in methods.items():
            lookup[method_name.lower()] = method_name
            for alias in method_data.get("aliases", []):
                lookup[alias.lower()] = method_name
    return lookup


PROCESS_LOOKUP = _build_process_lookup()
STANDARD_PROCESSES = sorted(set(PROCESS_LOOKUP.values()))


def normalize_process(process: str | None) -> str | None:
    """Normalize a raw process string to its canonical name."""
    if not process or not isinstance(process, str):
        return None
    trimmed = process.strip().lower()
    if not trimmed:
        return None
    return PROCESS_LOOKUP.get(trimmed)


def get_standard_processes() -> list[str]:
    """Get all unique standard process names."""
    return list(STANDARD_PROCESSES)


def get_process_details(process: str) -> dict | None:
    """Get category and details for a process."""
    normalized = normalize_process(process)
    if not normalized:
        return None
    for cat_name, cat_data in COFFEE_PROCESSING_TAXONOMY.items():
        if normalized in cat_data["methods"]:
            method = cat_data["methods"][normalized]
            return {
                "name": normalized,
                "category": cat_name,
                "description": cat_data["description"],
                "aliases": method["aliases"],
                "parent": method["parent"],
            }
    return None


def get_child_processes(process: str) -> list[str]:
    """Get all child processes of a parent."""
    normalized = normalize_process(process)
    if not normalized:
        return []
    children = []
    for cat_data in COFFEE_PROCESSING_TAXONOMY.values():
        for method_name, method_data in cat_data["methods"].items():
            if method_data["parent"] == normalized:
                children.append(method_name)
    return children
