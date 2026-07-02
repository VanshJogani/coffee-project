"""Basic tests for the health and auth endpoints."""


def test_health(client):
    """GET /api/health returns ok."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "productCount" in data


def test_register_and_login(client):
    """Register a user, then login."""
    # Register
    resp = client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "securepass123",
        "displayName": "Test Brewer",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["user"]["email"] == "test@example.com"
    assert data["user"]["displayName"] == "Test Brewer"

    # Login
    resp = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "securepass123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["email"] == "test@example.com"


def test_register_duplicate_email(client):
    """Registering with the same email twice returns 409."""
    payload = {"email": "dupe@example.com", "password": "pass123", "displayName": "Dupe"}
    client.post("/api/auth/register", json=payload)
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 409


def test_login_wrong_password(client):
    """Wrong password returns 401."""
    client.post("/api/auth/register", json={
        "email": "user@example.com", "password": "correct", "displayName": "User",
    })
    resp = client.post("/api/auth/login", json={
        "email": "user@example.com", "password": "wrong",
    })
    assert resp.status_code == 401


def test_me_anonymous(client):
    """GET /api/auth/me without token returns null user."""
    resp = client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json()["user"] is None


def test_products_list(client):
    """GET /api/products returns paginated response."""
    resp = client.get("/api/products")
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert "pagination" in data
    assert data["pagination"]["page"] == 1


def test_recipes_list(client):
    """GET /api/recipes returns array."""
    resp = client.get("/api/recipes")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_inventory_anonymous(client):
    """GET /api/inventory without auth returns empty list."""
    resp = client.get("/api/inventory")
    assert resp.status_code == 200
    assert resp.json() == []
