import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api" // Uses Railway URL in production, proxy in dev
});

// ── Products ──────────────────────────────────────────────────────────────────
export async function fetchProducts(params) {
  const res = await api.get("/products", { params });
  return res.data;
}
export async function fetchProduct(id) {
  const res = await api.get(`/products/${id}`);
  return res.data;
}

// ── Reviews ───────────────────────────────────────────────────────────────────
export async function createReview(payload) {
  const res = await api.post("/reviews", payload);
  return res.data;
}
export async function updateReview(id, payload) {
  const res = await api.put(`/reviews/${id}`, payload);
  return res.data;
}
export async function deleteReview(id) {
  await api.delete(`/reviews/${id}`);
}

// ── Recipes ───────────────────────────────────────────────────────────────────
export async function fetchRecipes() {
  const res = await api.get("/recipes");
  return res.data;
}
export async function fetchRecipe(id) {
  const res = await api.get(`/recipes/${id}`);
  return res.data;
}
export async function createRecipe(payload) {
  const res = await api.post("/recipes", payload);
  return res.data;
}
export async function updateRecipe(id, payload) {
  const res = await api.put(`/recipes/${id}`, payload);
  return res.data;
}
export async function deleteRecipe(id) {
  await api.delete(`/recipes/${id}`);
}
export async function forkRecipe(recipe) {
  // Fork = create a new user recipe pre-filled from the built-in
  const { id: _id, isBuiltIn: _bi, createdAt: _ca, updatedAt: _ua, ...fields } = recipe;
  return createRecipe({ ...fields, sourceRecipe: recipe.name });
}

// ── Bean Inventory ────────────────────────────────────────────────────────────
export async function fetchInventory() {
  const res = await api.get("/inventory");
  return res.data;
}
export async function fetchInventoryItem(id) {
  const res = await api.get(`/inventory/${id}`);
  return res.data;
}
export async function createInventoryItem(payload) {
  const res = await api.post("/inventory", payload);
  return res.data;
}
export async function updateInventoryItem(id, payload) {
  const res = await api.put(`/inventory/${id}`, payload);
  return res.data;
}
export async function deleteInventoryItem(id) {
  await api.delete(`/inventory/${id}`);
}

// ── Brew Logs ─────────────────────────────────────────────────────────────────
export async function fetchBrewLogs(params = {}) {
  const res = await api.get("/brew-logs", { params });
  return res.data;
}
export async function fetchBrewLog(id) {
  const res = await api.get(`/brew-logs/${id}`);
  return res.data;
}
export async function createBrewLog(payload) {
  const res = await api.post("/brew-logs", payload);
  return res.data;
}
export async function updateBrewLog(id, payload) {
  const res = await api.put(`/brew-logs/${id}`, payload);
  return res.data;
}
export async function deleteBrewLog(id) {
  await api.delete(`/brew-logs/${id}`);
}

// ── Brew Notes (community) ────────────────────────────────────────────────────
export async function fetchBrewNotes(productId) {
  const res = await api.get("/brew-notes", { params: { productId } });
  return res.data;
}
export async function createBrewNote(payload) {
  const res = await api.post("/brew-notes", payload);
  return res.data;
}
export async function deleteBrewNote(id) {
  await api.delete(`/brew-notes/${id}`);
}

export default api;


