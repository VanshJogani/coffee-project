"""Abstract base class for ML services."""

from abc import ABC, abstractmethod


class MLService(ABC):
    """Base class for all ML services in the app."""

    @abstractmethod
    async def initialize(self) -> None:
        """Load models, build indexes, etc. Called on app startup."""
        ...

    @abstractmethod
    async def predict(self, input_data: dict) -> dict:
        """Run inference on input data."""
        ...

    @property
    @abstractmethod
    def is_ready(self) -> bool:
        """Whether the service has been initialized and is ready to serve."""
        ...
