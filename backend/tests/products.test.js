const request = require("supertest");
const { getDb, initSchema } = require("../src/db");
const app = require("../src/app");

describe("Products API", () => {
  beforeAll((done) => {
    process.env.NODE_ENV = "test";
    process.env.TEST_DATABASE_PATH = ":memory:";
    const db = getDb();
    initSchema(db);

    db.run(
      `INSERT INTO products (productId, name, roaster, roastType, origin, tastingNotes, score, price, imageUrl, cuppingDate, description, url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ],
      (err) => {
        if (err) return done(err);
        done();
      }
    );
  });

  it("GET /api/products should return products with pagination", async () => {
    const res = await request(app).get("/api/products").expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.pagination).toBeDefined();
  });
});

