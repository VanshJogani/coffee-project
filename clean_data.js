/**
 * Pre-seed data cleaner for cleaned_coffee_products.json
 *
 * Fixes and enriches:
 *   Origin        — scraper fragments → canonical location or null
 *   Tasting_Notes — brew instructions / marketing copy → clean flavour list
 *   Process       — garbage fragments → validated process method or null
 *
 * Also:
 *   • Normalizes whitespace (NBSP, zero-width chars)
 *   • Extracts structured fields from Desc as fallback
 *   • Deduplicates variant rows (null-Quantity vs real-Quantity)
 *
 * Usage:  node clean_data.js [input.json] [output.json]
 * Default output: cleaned_coffee_products_v2.json
 */

const fs   = require("fs");
const path = require("path");
const { KNOWN_ORIGINS } = require("./backend/src/utils/originNormalizer");

// ─────────────────────────────────────────────────────────────────────────────
// Vocabularies & Constants
// ─────────────────────────────────────────────────────────────────────────────

// Flavor words found in Indian specialty coffee
const FLAVOR_VOCABULARY = new Set([
  "chocolate", "caramel", "berry", "berries", "citrus", "fruity", "nutty",
  "honey", "floral", "vanilla", "orange", "lemon", "lime", "cocoa", "toffee",
  "molasses", "jasmine", "peach", "plum", "cherry", "jaggery", "mango",
  "banana", "cardamom", "cinnamon", "clove", "rose", "hazelnut", "cashew",
  "walnut", "almond", "coconut", "guava", "pineapple", "malt", "blackberry",
  "raspberry", "blueberry", "strawberry", "raisin", "prune", "pomegranate",
  "grape", "pear", "grapefruit", "brown sugar", "dark chocolate", "fig",
  "apricot", "tamarind", "sugarcane", "spice", "tobacco", "pepper", "wine",
  "woody", "earthy", "smoky", "creamy", "buttery", "silky", "tangy", "bright",
  "crisp", "stone fruit", "tropical", "dried fruit", "sweet", "bitter",
  "mild", "rich", "smooth", "bold", "balanced", "complex", "clean",
  "winey", "herbal", "tea-like", "roasted", "toasted",
  "pistachio", "peanut", "macadamia", "cream", "butter",
  "milk chocolate", "white chocolate", "cacao", "cocoa nibs", "nougat",
  "maple", "syrup", "panela", "muscovado", "demerara", "raw sugar",
  "black tea", "green tea", "chamomile", "hibiscus", "lavender", "bergamot",
  "mandarin", "tangerine", "clementine", "blood orange", "kumquat",
  "passionfruit", "lychee", "jackfruit", "papaya", "watermelon", "melon",
  "cantaloupe", "kiwi", "starfruit", "dragonfruit", "sapota", "chikoo",
  "dates", "currant", "cranberry", "gooseberry", "jamun",
  "kokum", "amla", "raw mango", "green apple", "red apple",
  "anjeer", "black currant", "mulberry", "boysenberry",
  "cane sugar", "palm sugar", "gur", "misri", "candy",
  "black pepper", "white pepper", "pink pepper", "star anise", "fennel",
  "nutmeg", "saffron", "turmeric", "ginger", "lemongrass",
  "sandalwood", "cedar", "oak", "pine", "moss", "mushroom",
  "full-bodied", "medium-bodied", "light-bodied", "velvety", "juicy",
  "sparkling", "effervescent", "delicate", "vibrant", "lively",
  "fruit", "fruity", "candied", "candy", "syrupy", "acidic", "acidity",
  "roasty", "malty", "biscuity", "graham", "cereal", "grain",
]);

// Known coffee processing methods
const VALID_PROCESSES = [
  "Natural", "Washed", "Honey", "Honey Process", "Anaerobic",
  "Anaerobic Natural", "Anaerobic Washed", "Anaerobic Honey",
  "Monsooned", "Monsoon Malabar", "Semi-Washed", "Semi Washed",
  "Pulped Natural", "Wet-Hulled", "Wet Hulled",
  "Carbonic Maceration", "Double Fermented", "Double Washed",
  "Experimental", "Sun Dried", "Natural Sun Dried",
  "Natural Sun-Dried", "Hand-Picked", "Natural Sun-Dried, Hand-Picked",
  "Dry Process", "Wet Process", "Fully Washed",
];

// Regex to match any valid process (case-insensitive)
const PROCESS_RE = new RegExp(
  VALID_PROCESSES
    .sort((a, b) => b.length - a.length)
    .map(p => p.replace(/[-/]/g, "[-/ ]?").replace(/\s+/g, "\\s+"))
    .join("|"),
  "i"
);

// Brewing methods that contaminate tasting notes
const BREWING_METHODS_RE = /\b(?:Pour\s*Over|French\s*Press|Aero\s*Press|Espresso|Moka\s*Pot|Cold\s*Brew|Drip|Chemex|Siphon|V60|Filter|Clever\s*Dripper|South\s*Indian\s*Filter)\b/gi;

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Whitespace normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize all whitespace: NBSP, zero-width chars, multiple spaces -> single space.
 */
function normalizeWhitespace(str) {
  if (!str || typeof str !== "string") return "";
  return str
    // Replace NBSP, zero-width chars, special spaces with normal space
    .replace(/[ ​‌‍‎‏ ﻿   ]/g, " ")
    // Collapse multiple spaces
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Structured field extraction from Desc
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse labeled key:value fields from the product description.
 * Most Indian roasters embed structured data in their Shopify descriptions.
 */
function extractStructuredFields(desc) {
  const result = { tastingNotes: null, origin: null, process: null };
  if (!desc || typeof desc !== "string") return result;

  const text = normalizeWhitespace(desc);

  // -- Tasting Notes --
  const notesPatterns = [
    /(?:Flavou?r\s+Notes?|Tasting\s+Notes?|Cupper[‘’’]?s?\s+Notes?|Tastes?\s+Like)\s*[:;–—-]\s*([^\n\[]+)/i,
    /\nFlavou?r\s+Notes?[:：]\s*([^\n\[]+)/i,
    // "layered flavors of X, Y, Z" / "notes of X, Y" / "hints of X, Y"
    /(?:layered\s+)?(?:flavou?rs?|notes|hints)\s+of\s+([^.!?\n]{5,120})/i,
  ];
  for (const re of notesPatterns) {
    const m = text.match(re);
    if (m) {
      let notes = m[1].trim();
      // Stop at next labeled field
      notes = notes.split(/\s*(?:Recommended|Brewing|Best\s+Brewed|Roast|Process|Variety|Location|Origin|Elevation|Altitude)\s*[:–—-]/i)[0];
      notes = notes.replace(/\[Meta\s+Description\].*$/i, "").trim();
      if (notes.length > 3) {
        result.tastingNotes = notes;
        break;
      }
    }
  }

  // -- Origin --
  const originPatterns = [
    /(?:Location|Origin|Region)\s*[:–—-]\s*([^\n\[]+)/i,
    /\n(?:Location|Origin|Region)[:：]\s*([^\n\[]+)/i,
  ];
  for (const re of originPatterns) {
    const m = text.match(re);
    if (m) {
      let origin = m[1].trim();
      origin = origin.split(/\s*(?:Flavou?r|Tasting|Recommended|Brewing|Roast|Process|Variety|Elevation|Altitude)\s*[:–—-]/i)[0];
      origin = origin.replace(/\[Meta\s+Description\].*$/i, "").trim();
      if (origin.length > 2) {
        result.origin = origin;
        break;
      }
    }
  }

  // -- Process --
  const processPatterns = [
    /(?:Process(?:ed|ing)?)\s*[:–—-]\s*([^\n\[]+)/i,
    /\nProcess(?:ed|ing)?[:：]\s*([^\n\[]+)/i,
  ];
  for (const re of processPatterns) {
    const m = text.match(re);
    if (m) {
      let process = m[1].trim();
      process = process.split(/\s*(?:Roast|Variety|Varietal|Location|Origin|Elevation|Altitude|Flavou?r|Tasting|Recommended|Brewing)\s*[:–—-]/i)[0];
      process = process.replace(/\[Meta\s+Description\].*$/i, "").trim();
      if (process.length > 2) {
        result.process = process;
        break;
      }
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Origin cleaning
// ─────────────────────────────────────────────────────────────────────────────

// Strings that are definitely not a geographic origin
const ORIGIN_BLACKLIST = [
  /^(coffee|beans|coffees|arabica|robusta|gesha|selection|single\s+origin|single\s+estate|a\s+single\s+estate|indian\s+coffee|specialty\s+coffee|classic\s+coffee)$/i,
  /^(and\s+process|washed\s+process|anaerobic\s+honey|filter\s+coffee|dark|high|an|to|s|ing|ers|for\s+us)$/i,
  /^multi[\s-]?origin/i,
];

// Phrases that indicate the origin is embedded somewhere in the string
const ORIGIN_EXTRACT_PATTERNS = [
  /\bfrom\s+([A-Za-z][A-Za-z\s]+?)(?:\s+in\b|\s+at\b|\s+estate\b|$)/i,
  /\bin\s+([A-Za-z][A-Za-z\s]+?)(?:\s+at\b|\s+for\b|,|$)/i,
  /\bof\s+([A-Za-z][A-Za-z\s]+?)(?:\s+a\b|\s+the\b|,|$)/i,
  /\bat\s+([A-Za-z][A-Za-z\s]+?)(?:\s+a\b|\s+the\b|,|$)/i,
  /\bplantations?\s+of\s+([A-Za-z][A-Za-z\s]+?)(?:\s|,|$)/i,
  /\bheart\s+of\s+([A-Za-z][A-Za-z\s]+?)(?:\s|,|$)/i,
  /\bhighlands?\s+of\s+([A-Za-z][A-Za-z\s]+?)(?:\s|,|$)/i,
  /\bthe\s+(?:renowned\s+|esteemed\s+|beautiful\s+)?([A-Za-z][A-Za-z\s]+?(?:\s+estate)?)\b/i,
  /\b([A-Za-z][A-Za-z\s]+?\s+estate)\b/i,
  /\b(?:based|located)\s+(?:in|at)\s+([A-Za-z][A-Za-z\s]+?)(?:\s|,|$)/i,
];

/**
 * Try to extract a canonical origin name from a raw (possibly garbage) string.
 * Returns the canonical display name from KNOWN_ORIGINS, or null.
 */
function extractOrigin(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = normalizeWhitespace(raw);
  if (!trimmed) return null;

  // Strip parenthetical metadata: "Aguragre, Meghalaya (200+ farmer community)" -> "Aguragre, Meghalaya"
  const withoutParens = trimmed.replace(/\s*\([^)]*\)\s*/g, " ").trim();

  // Direct hit
  const directKey = withoutParens.toLowerCase();
  if (KNOWN_ORIGINS[directKey]) return KNOWN_ORIGINS[directKey];

  // Blacklisted noise
  if (ORIGIN_BLACKLIST.some(re => re.test(withoutParens))) return null;

  // Try splitting on commas / "and" and resolving each token
  const segments = withoutParens.split(/[,&]|\band\b/i).map(s => s.trim()).filter(Boolean);

  // Try full string first, then each segment
  const candidates = [withoutParens, ...segments];

  for (const candidate of candidates) {
    const key = candidate.toLowerCase()
      // Strip common suffixes that aren't part of the location name
      .replace(/\s+(northeast\s+india|south\s+india|western\s+ghats|india|karnataka|kerala|tamil\s+nadu)$/i, "")
      .trim();

    if (KNOWN_ORIGINS[key]) return KNOWN_ORIGINS[key];

    // Try without region qualifiers
    const stripped = key
      .replace(/\s+(hills?|district|region|belt|valley|mountains?|highlands?|plateau)$/i, "")
      .trim();
    if (stripped && KNOWN_ORIGINS[stripped]) return KNOWN_ORIGINS[stripped];
  }

  // Try extraction patterns on the original string
  for (const pattern of ORIGIN_EXTRACT_PATTERNS) {
    const m = withoutParens.match(pattern);
    if (!m) continue;
    const candidate = m[1].trim().toLowerCase();
    if (KNOWN_ORIGINS[candidate]) return KNOWN_ORIGINS[candidate];
    const stripped = candidate.replace(/\s+(estate|plantation|farms?|hills?|valley|district|region|belt)$/i, "").trim();
    if (KNOWN_ORIGINS[stripped]) return KNOWN_ORIGINS[stripped];
    for (const word of candidate.split(/\s+/)) {
      if (word.length > 4 && KNOWN_ORIGINS[word]) return KNOWN_ORIGINS[word];
    }
  }

  // Last pass: scan every known key as a substring
  const rawLower = withoutParens.toLowerCase();
  const sortedKeys = Object.keys(KNOWN_ORIGINS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (key.length < 4) continue;
    if (rawLower.includes(key)) return KNOWN_ORIGINS[key];
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Process cleaning
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate and clean a process string.
 * Returns a recognized process name, or null if the string is garbage.
 */
function cleanProcess(raw, desc) {
  let text = normalizeWhitespace(raw);

  if (text) {
    // Check if the raw value matches a known process
    const m = text.match(PROCESS_RE);
    if (m) {
      // Normalize the matched process to title case from our vocabulary
      const matched = m[0];
      const normalized = VALID_PROCESSES.find(
        p => p.toLowerCase() === matched.toLowerCase()
      ) || matched;
      return normalized;
    }

    // If it's short garbage (< 5 chars) or clearly not a process -> try desc
    if (text.length >= 5) {
      // Longer string that doesn't match - check if it's marketing copy
      const looksLikeMarketing = /\b(careful|harvesting|precision|quality|experience|enjoy|every|ensuring|roasting|monitor|preserve|integrity)\b/i.test(text);
      if (!looksLikeMarketing) {
        // Might be a valid process with extra words, try to extract
        const m2 = text.match(PROCESS_RE);
        if (m2) return m2[0];
      }
    }
    // Fall through to desc extraction
  }

  // Fallback: try extracting from Desc
  if (desc) {
    const structured = extractStructuredFields(desc);
    if (structured.process) {
      const m = structured.process.match(PROCESS_RE);
      if (m) {
        const normalized = VALID_PROCESSES.find(
          p => p.toLowerCase() === m[0].toLowerCase()
        ) || m[0];
        return normalized;
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tasting notes cleaning
// ─────────────────────────────────────────────────────────────────────────────

// Strip these trailing suffixes from notes
const NOTES_TRAILING_STRIP = [
  /\s*Best\s+Brewed\s+[Ww]ith\s*:?[^.]*$/i,
  /\s*Harvest\s*:?\s*[A-Za-z]+\s+to\s+[A-Za-z]+\s*$/i,
  /\s*Brewing\s+Instructions\s*:.*$/is,
  /\s*!?\s*Know\s+the\s+Grower.*$/is,
  /\s*When\s+brewed\s+at\s+\d+.*$/is,
  /\s*Grab\s+a\s+freshly\s+brewed\s+cup.*$/is,
  /^\s*\[Meta\s+Description\]\s*:?\s*/i,
  /\s*This\s+coffee\s+is\s+(?:handpicked|best\s+enjoyed|a\s+blend).*$/is,
  /\s*Recommended\s+[Bb]rewing.*$/is,
];

// Strings that are not tasting notes at all
const NOTES_BLACKLIST = [
  /^\s*\[Meta\s+Description\]/i,
  /\b(buy now|shop now|order now|free shipping|subscribe|add to cart|click here|available at|delivery|per kg|per 100g)\b/i,
  /^\s*!?\s*Know\s+the\s+Grower\b/i,
  // Starts with marketing/brand copy, not flavors
  /^\s*(?:Crafted for|Designed for|Made for|A perfect|The perfect|An exceptional|100%|MokkaFarms|Experience the)\b/i,
];

/**
 * Check if a cleaned tasting note string contains at least one recognized flavor word.
 */
function hasFlavorContent(text) {
  const lower = text.toLowerCase();
  for (const flavor of FLAVOR_VOCABULARY) {
    if (lower.includes(flavor)) return true;
  }
  return false;
}

/**
 * Smart truncation: cut at comma boundaries, not mid-word.
 */
function smartTruncate(text, maxLen) {
  maxLen = maxLen || 160;
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  // Try to cut at last comma
  const lastComma = cut.lastIndexOf(",");
  if (lastComma > maxLen * 0.5) {
    return cut.slice(0, lastComma).trim();
  }
  // Try last space
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.5) {
    return cut.slice(0, lastSpace).trim();
  }
  return cut.trim();
}

/**
 * Clean a raw tasting notes string.
 * Returns a clean flavour-focused string, or null if nothing useful remains.
 */
function cleanTastingNotes(raw, desc) {
  // Normalize whitespace first (fixes "hintswith" from NBSP collisions)
  let t = normalizeWhitespace(raw);

  // Detect corrupted notes where spaces were stripped (words merged together)
  // Pattern: lowercase letter immediately followed by another common word start
  // e.g. "hintswith", "nuttyand", "limewith"
  const looksCorrupted = t && /[a-z]{3,}(?:with|and|the|for|but|has|are|its|from)\s/i.test(t);

  // If no tasting notes in the field, or they look corrupted, try extracting from Desc
  if ((!t || looksCorrupted) && desc) {
    const structured = extractStructuredFields(desc);
    if (structured.tastingNotes) {
      const fromDesc = normalizeWhitespace(structured.tastingNotes);
      // Prefer Desc extraction if it's longer or the field was corrupted
      if (!t || (looksCorrupted && fromDesc.length >= t.length * 0.5)) {
        t = fromDesc;
      }
    }
  }

  if (!t) return null;

  // Hard reject if the whole string is marketing noise
  if (NOTES_BLACKLIST.some(re => re.test(t))) return null;

  // Strip trailing brew/harvest/marketing suffixes iteratively
  let prev;
  do {
    prev = t;
    for (const re of NOTES_TRAILING_STRIP) {
      t = t.replace(re, "").trim();
    }
  } while (t !== prev);

  // Strip brewing methods that contaminated the notes
  t = t.replace(BREWING_METHODS_RE, "").trim();
  // Clean up orphaned separators after stripping
  t = t.replace(/,\s*,/g, ",").replace(/^[,\s]+|[,\s]+$/g, "");

  // Flatten bullet/dash list formats into comma-separated
  if (/^\s*[–—-]/.test(t) || t.includes("\n")) {
    t = t.replace(/^[–—\s]*What\s+You['‘’]?ll\s+Experience\s*/i, "");
    const parts = t
      .split(/\n|(?:\s+[–—]\s+)/)
      .map(function(p) { return p.replace(/^[–—•*]\s*/, "").trim(); })
      .filter(function(p) { return p.length > 1; });

    if (parts.length > 1) {
      t = parts.join(", ");
    } else if (parts.length === 1) {
      t = parts[0];
    }
  }

  // Strip leading punctuation/whitespace artifacts
  t = t.replace(/^[,.\s–—]+/, "").trim();
  // Collapse multiple spaces
  t = t.replace(/\s{2,}/g, " ");
  // Decode HTML entities
  t = t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

  // Strip [Meta Description] and everything after it
  t = t.replace(/\s*\[Meta\s+Description\].*$/i, "").trim();

  // Strip common marketing continuations that aren't flavor notes
  t = t.split(/\s+(?:Introducing|Farm-Fresh|FARM to|From bold|Crafted for|A fearless|Experience\s|Enjoy\s|Discover\s|Made\s+from|Made\s+with|Try\s|Perfect\s+for|Grown\s+on|Our\s+|ABOUT\s+US|SHOP\s+THE)/i)[0].trim();

  // Strip website/nav text that leaked in
  t = t.replace(/\s*(SHOP|BLOG|TERMS|PRIVACY|ABOUT US|THE TEAM|CONTACT|FAQ|PROMISE|We at\s).*$/i, "").trim();

  // Strip "100% Arabica" / "Single Origin" metadata that isn't a flavor note
  t = t.replace(/\s*\d+%\s*(Arabica|Robusta|Single)[^,]*/gi, "").trim();

  // Strip weight/quantity metadata: "Weight - 200gm/1kg" etc.
  t = t.replace(/\s*Weight\s*[-–:]\s*\d+[^,]*/gi, "").trim();

  // Strip trailing bullets, pipes, separators
  t = t.replace(/\s*[•·|]+\s*$/, "").trim();

  // Strip trailing " ||" or " |" separators
  t = t.replace(/\s*\|+\s*$/, "").trim();

  // Strip trailing product/brand name fragments: " ProductName -" or " - text"
  t = t.replace(/\s+\w+\s*[-–—]\s*$/, "").trim();

  // Strip marketing continuation after notes: "... A BOLD..." / "... designed for..."
  t = t.split(/\s+(?:A\s+BOLD|designed\s+f|is\s+designed|is\s+crafted|is\s+a\s+|is\s+our\s+|is\s+the\s+|–\s+\w+\s+is)/i)[0].trim();

  // Detect mid-word truncation: if the string ends with an incomplete word
  // (2-3 chars that don't look like a word ending), truncate at last comma or dash
  if (/\s\w{1,3}$/.test(t) && !/\s(and|or|the|for|but|of|to|in|is|it|at|no|so|up|on|by|as)$/i.test(t)) {
    // Likely truncated mid-sentence — cut at last natural break
    const lastComma = t.lastIndexOf(",");
    const lastDash = t.lastIndexOf("—"); // em-dash
    const cutPoint = Math.max(lastComma, lastDash);
    if (cutPoint > t.length * 0.3) {
      t = t.slice(0, cutPoint).trim();
    }
  }

  // Smart truncation at comma boundaries
  t = smartTruncate(t, 160);

  // Strip any remaining trailing incomplete phrases after truncation
  t = t.replace(/[,\s]+$/, "").trim();

  // ── Final punctuation & formatting pass ──────────────────────────────────

  // Normalize bullet separators to commas: "Figs • Strawberry • Peaches" → "Figs, Strawberry, Peaches"
  t = t.replace(/\s*[•·]\s*/g, ", ");

  // Normalize slash separators: "Pear / Black Tea / Goose Berries" → "Pear, Black Tea, Goose Berries"
  t = t.replace(/\s*\/\s*/g, ", ");

  // Normalize pipe separators: "Cocoa | Nutty | Dried-Fruit" → "Cocoa, Nutty, Dried-Fruit"
  t = t.replace(/\s*\|\s*/g, ", ");

  // Strip emoji: "🍇 Black Grapes ⭐ Star Fruit" → "Black Grapes, Star Fruit"
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{2702}-\u{27B0}]/gu, "")
    .replace(/\s{2,}/g, " ").trim();

  // Fix double commas from separator normalization
  t = t.replace(/,\s*,/g, ",");

  // Capitalize first letter
  if (t.length > 0 && /^[a-z]/.test(t)) {
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }

  // Strip trailing exclamation marks, colons, semicolons
  t = t.replace(/[!;:]+\s*$/, "").trim();

  // Strip marketing sentence fragments that slipped through
  // "...We are proud to introduce", "...Subscribe now...", "...Explore a curated..."
  t = t.split(/\.\s*(?:We\s|Subscribe\s|Explore\s|At\s+\w+,|Expect\s|This\s|Our\s|The\s+\w+\s+is)/i)[0].trim();

  // Strip "Brewing Styles:..." suffix
  t = t.replace(/\s*Brewing\s+Styles?:.*$/i, "").trim();

  // Ensure no trailing period (tasting notes are a list, not a sentence)
  t = t.replace(/\.\s*$/, "").trim();

  // Final cleanup: trailing separators and spaces
  t = t.replace(/[,\s–—-]+$/, "").trim();

  if (t.length < 3) return null;

  // Validate: must contain at least one recognized flavor word
  if (!hasFlavorContent(t)) return null;

  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deduplication
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove duplicate rows where null-Quantity duplicates a row with real Quantity.
 * Groups by (Name, Roaster, Price) and drops null-Quantity rows if a variant with
 * actual quantity data exists in the same group.
 */
function deduplicateRecords(data) {
  // Build groups
  const groups = new Map();
  for (const item of data) {
    const key = (item.Name || "").toLowerCase() + "|||" + (item.Roaster || "").toLowerCase() + "|||" + item.Price;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const result = [];
  for (const [, items] of groups) {
    const withQty = items.filter(function(i) { return i.Quantity && i.Quantity.trim(); });
    const withoutQty = items.filter(function(i) { return !i.Quantity || !i.Quantity.trim(); });

    if (withQty.length > 0 && withoutQty.length > 0) {
      // Drop null-Quantity rows - the real variant rows cover it
      result.push(...withQty);
    } else {
      // Either all have Quantity or none do - keep all
      result.push(...items);
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const args       = process.argv.slice(2);
  const inputPath  = path.resolve(args[0] || "cleaned_coffee_products.json");
  const outputPath = path.resolve(args[1] || "cleaned_coffee_products_v2.json");

  console.log("Reading  " + inputPath);
  const data = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

  const stats = {
    total: data.length,
    originFixed:     0,
    originCleared:   0,
    originUnchanged: 0,
    notesFixed:      0,
    notesCleared:    0,
    notesUnchanged:  0,
    notesFilled:     0,   // was null, now has a value (from Desc extraction)
    processFixed:    0,
    processCleared:  0,
    processUnchanged:0,
    duplicatesRemoved: 0,
  };

  const cleaned = data.map(function(item) {
    const out = Object.assign({}, item);
    const desc = item.Desc || "";

    // -- Origin --
    const rawOrigin  = normalizeWhitespace(item.Origin || "");
    var cleanOrigin = extractOrigin(rawOrigin);

    // If origin extraction from field failed, try the Desc
    if (!cleanOrigin && desc) {
      const structured = extractStructuredFields(desc);
      if (structured.origin) {
        cleanOrigin = extractOrigin(structured.origin);
      }
    }

    if (!rawOrigin) {
      if (cleanOrigin) {
        out.Origin = cleanOrigin;
        stats.originFixed++;
      } else {
        stats.originUnchanged++;
      }
    } else if (cleanOrigin === null) {
      out.Origin = null;
      stats.originCleared++;
    } else if (cleanOrigin !== rawOrigin) {
      out.Origin = cleanOrigin;
      stats.originFixed++;
    } else {
      stats.originUnchanged++;
    }

    // -- Tasting Notes --
    const rawNotes   = normalizeWhitespace(item.Tasting_Notes || "");
    const cleanNotes = cleanTastingNotes(rawNotes, desc);

    if (!rawNotes && cleanNotes) {
      out.Tasting_Notes = cleanNotes;
      stats.notesFilled++;
    } else if (!rawNotes) {
      stats.notesUnchanged++;
    } else if (cleanNotes === null) {
      out.Tasting_Notes = null;
      stats.notesCleared++;
    } else if (cleanNotes !== rawNotes) {
      out.Tasting_Notes = cleanNotes;
      stats.notesFixed++;
    } else {
      stats.notesUnchanged++;
    }

    // -- Process --
    const rawProcess = normalizeWhitespace(item.Process || "");
    const cleanedProcess = cleanProcess(rawProcess, desc);

    if (!rawProcess && cleanedProcess) {
      out.Process = cleanedProcess;
      stats.processFixed++;
    } else if (!rawProcess) {
      stats.processUnchanged++;
    } else if (cleanedProcess === null) {
      out.Process = null;
      stats.processCleared++;
    } else if (cleanedProcess !== rawProcess) {
      out.Process = cleanedProcess;
      stats.processFixed++;
    } else {
      stats.processUnchanged++;
    }

    return out;
  });

  // -- Deduplicate --
  const deduped = deduplicateRecords(cleaned);
  stats.duplicatesRemoved = cleaned.length - deduped.length;

  fs.writeFileSync(outputPath, JSON.stringify(deduped, null, 2), "utf-8");

  console.log("\nWrote    " + outputPath);
  console.log("\n-- Origin ------------------------------------");
  console.log("  Fixed (extracted/normalised): " + stats.originFixed);
  console.log("  Cleared (garbage -> null):    " + stats.originCleared);
  console.log("  Unchanged:                    " + stats.originUnchanged);
  console.log("\n-- Tasting Notes -----------------------------");
  console.log("  Fixed (stripped noise):       " + stats.notesFixed);
  console.log("  Filled (was null -> from Desc):" + stats.notesFilled);
  console.log("  Cleared (all noise -> null):  " + stats.notesCleared);
  console.log("  Unchanged:                    " + stats.notesUnchanged);
  console.log("\n-- Process -----------------------------------");
  console.log("  Fixed (validated/normalised): " + stats.processFixed);
  console.log("  Cleared (garbage -> null):    " + stats.processCleared);
  console.log("  Unchanged:                    " + stats.processUnchanged);
  console.log("\n-- Deduplication -----------------------------");
  console.log("  Duplicates removed:           " + stats.duplicatesRemoved);
  console.log("  Final record count:           " + deduped.length);
  console.log("\nTotal input records: " + stats.total);
}

main();
