const request = require("supertest");
const { getDb } = require("../src/db");
const { app, dbReady } = require("../src/app");

describe("Products API", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    // Wait for schema initialization to complete
    await dbReady;

    const db = getDb();
    await db.execute({
      sql: `INSERT INTO products (productId, name, roaster, roastType, origin, tastingNotes, score, price, imageUrl, cuppingDate, description, url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "test-1",
        "Test Coffee",
        "Test Roaster",
        "Medium Roast",
        "Test Origin",
        "Chocolate, Nuts",
        88.5,
        15.5,
        "",
        "2024-01-01",
        "Test description",
        "https://example.com/test-coffee"
      ]
    });
  });

  it("GET /api/products should return products with pagination", async () => {
    const res = await request(app).get("/api/products").expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.pagination).toBeDefined();
  });
});
