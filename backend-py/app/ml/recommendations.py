"""Recommendation engine stub — user→product recommendations.

Architecture:
- Build user preference vectors from: brew_logs (frequency), reviews (ratings),
  tasting notes of favorited/brewed products
- Build product feature vectors from: roastType, origin, process, tastingNotes, price
- Cosine similarity scoring between user vector and product vectors
- Collaborative filtering: users who brewed similar products also liked X

Future enhancements:
- Brew parameter optimization (grind, temp, ratio) per product
- Price prediction based on origin, process, rarity
- Seasonal trend detection
"""

from .base import MLService


class RecommendationService(MLService):
    """Product recommendation engine based on user preferences and brew history."""

    def __init__(self):
        self._ready = False

    async def initialize(self) -> None:
        """Build feature matrices from database. Called on startup."""
        # TODO: Load product features, build TF-IDF vectors for tasting notes
        # TODO: Build user-product interaction matrix
        self._ready = True

    async def predict(self, input_data: dict) -> dict:
        """
        Get recommendations for a user.

        Args:
            input_data: {"user_id": int, "limit": int, "exclude_brewed": bool}

        Returns:
            {"recommendations": [{"product_id": int, "score": float, "reason": str}]}
        """
        if not self._ready:
            return {"recommendations": [], "error": "Service not initialized"}

        # TODO: Implement actual recommendation logic
        # 1. Get user's brew history and ratings
        # 2. Build user preference vector
        # 3. Score all products by similarity
        # 4. Filter out already-brewed (if requested)
        # 5. Return top-N with explanation

        return {"recommendations": [], "message": "Recommendation engine not yet trained"}

    @property
    def is_ready(self) -> bool:
        return self._ready

    async def get_similar_users(self, user_id: int, limit: int = 5) -> list[dict]:
        """Find users with similar taste profiles (collaborative filtering)."""
        # TODO: Implement
        return []

    async def get_user_profile(self, user_id: int) -> dict:
        """Build a taste profile summary for a user."""
        # TODO: Aggregate preferences from brew logs, reviews, liked recipes
        return {
            "preferred_roast_types": [],
            "preferred_origins": [],
            "preferred_processes": [],
            "flavor_preferences": [],
            "price_range": {"min": 0, "max": 0},
            "brewing_frequency": 0,
        }
