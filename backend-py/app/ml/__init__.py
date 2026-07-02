"""ML module — recommendation engine, flavor analysis, and extensibility stubs."""

from .base import MLService
from .recommendations import RecommendationService
from .flavor_analysis import FlavorAnalysisService

__all__ = ["MLService", "RecommendationService", "FlavorAnalysisService"]
