"""Flavor analysis stub — NLP on tasting notes, similarity scoring, auto-categorization.

Architecture:
- Tokenize tasting notes into standard flavor wheel categories
- Build flavor vectors per product (TF-IDF or embeddings)
- Cosine similarity between products for "similar coffees" feature
- Auto-categorize free-text descriptions into the flavor wheel hierarchy

Future enhancements:
- Sentiment analysis on reviews
- Flavor trend detection across roasters/origins
- Pairing suggestions (food, brewing method)
"""

from .base import MLService


# Standard flavor wheel categories (SCA-inspired)
FLAVOR_CATEGORIES = {
    "fruity": ["berry", "citrus", "stone fruit", "tropical", "dried fruit", "apple", "grape"],
    "sweet": ["chocolate", "caramel", "honey", "vanilla", "molasses", "brown sugar", "maple"],
    "nutty": ["almond", "hazelnut", "peanut", "walnut", "cashew", "pecan"],
    "floral": ["jasmine", "rose", "lavender", "chamomile", "hibiscus", "elderflower"],
    "spicy": ["cinnamon", "clove", "pepper", "cardamom", "ginger", "nutmeg"],
    "roasty": ["dark chocolate", "cocoa", "tobacco", "smoky", "ash", "burnt"],
    "earthy": ["mushroom", "soil", "woody", "cedar", "leather", "moss"],
    "acidic": ["bright", "crisp", "tangy", "tart", "wine-like", "sparkling"],
}


class FlavorAnalysisService(MLService):
    """NLP-based flavor note analysis and product similarity scoring."""

    def __init__(self):
        self._ready = False

    async def initialize(self) -> None:
        """Build flavor vectors for all products. Called on startup."""
        # TODO: Load all product tasting notes from DB
        # TODO: Tokenize and build TF-IDF matrix
        # TODO: Pre-compute similarity matrix for fast lookup
        self._ready = True

    async def predict(self, input_data: dict) -> dict:
        """
        Analyze tasting notes text.

        Args:
            input_data: {"text": str} or {"product_id": int, "action": "similar"}

        Returns:
            {"categories": [...], "profile": {...}} or {"similar": [...]}
        """
        if not self._ready:
            return {"error": "Service not initialized"}

        text = input_data.get("text", "")
        if text:
            return await self.analyze_notes(text)

        product_id = input_data.get("product_id")
        if product_id:
            return await self.find_similar(product_id)

        return {"error": "Provide 'text' or 'product_id'"}

    @property
    def is_ready(self) -> bool:
        return self._ready

    async def analyze_notes(self, text: str) -> dict:
        """
        Analyze free-text tasting notes into structured flavor categories.

        Returns:
            {
                "categories": [{"name": "fruity", "score": 0.8, "keywords": ["berry", "citrus"]}],
                "dominant_flavor": "fruity",
                "complexity_score": 0.7
            }
        """
        # TODO: Implement NLP tokenization + keyword matching + scoring
        text_lower = text.lower()
        matches = {}
        for category, keywords in FLAVOR_CATEGORIES.items():
            found = [kw for kw in keywords if kw in text_lower]
            if found:
                matches[category] = found

        categories = [
            {"name": cat, "score": len(kws) / len(FLAVOR_CATEGORIES[cat]), "keywords": kws}
            for cat, kws in matches.items()
        ]
        categories.sort(key=lambda x: x["score"], reverse=True)

        return {
            "categories": categories,
            "dominant_flavor": categories[0]["name"] if categories else None,
            "complexity_score": min(1.0, len(matches) / 4),
        }

    async def find_similar(self, product_id: int, limit: int = 10) -> dict:
        """Find products with similar flavor profiles."""
        # TODO: Look up pre-computed similarity scores
        return {"similar": [], "message": "Similarity index not yet built"}

    async def auto_categorize(self, text: str) -> list[str]:
        """Map free text to flavor wheel leaf nodes."""
        # TODO: Implement with trained classifier
        return []
