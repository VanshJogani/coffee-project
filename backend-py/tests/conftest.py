"""Pytest fixtures for the FastAPI test suite."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import get_db, init_schema, run_migrations, close_db
from app.config import settings

# Override to use in-memory DB for tests
settings.env = "test"
settings.turso_database_url = ""
settings.database_path = ":memory:"


@pytest.fixture(autouse=True)
def setup_test_db():
    """Create a fresh in-memory DB for each test."""
    # Reset the connection
    close_db()
    settings.env = "test"
    db = get_db()
    init_schema(db)
    run_migrations(db)
    yield db
    close_db()


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)
