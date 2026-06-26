import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "/api";
const isDev = import.meta.env.DEV;

if (isDev) console.log("[API] baseURL:", BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Log every outgoing request (dev only)
api.interceptors.request.use(config => {
  if (isDev) console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, config.params || "");
  return config;
});

// Centralized response error handler with silent token refresh
api.interceptors.response.use(
  res => {
    if (isDev) console.log(`[API] ✔ ${res.config.url} — ${res.status}`, Array.isArray(res.data) ? `(${res.data.length} items)` : "");
    return res;
  },
  async err => {
    const status = err.response?.status;
    const message = err.response?.data?.error || err.response?.data?.errors?.[0] || err.message;
    if (isDev) console.error(`[API] ✘ ${err.config?.url} — ${status || "NO RESPONSE"}`, message, err.response?.data || err.message);

    // Attempt silent token refresh on 401 (skip if already retrying or on auth endpoints)
    if (status === 401 && !err.config._retry && !err.config.url?.startsWith("/auth/")) {
      err.config._retry = true;
      try {
        await api.post("/auth/refresh");
        return api(err.config);
      } catch (_refreshErr) {
        // Refresh failed — user needs to re-login, don't toast the 401
        return Promise.reject(err);
      }
    }

    // Don't toast 401s from auth endpoints (login failures are shown in the modal)
    if (status === 401) {
      return Promise.reject(err);
    }

    if (status === 404) {
      showToast("Not found: " + message, "warn");
    } else if (status >= 400 && status < 500) {
      showToast(message, "warn");
    } else if (status >= 500 || !status) {
      showToast("Server error — please try again.", "error");
    }
    return Promise.reject(err);
  }
);

// ── Minimal toast (no extra lib needed) ──────────────────────────────────────
function showToast(message, level = "error") {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  const colors = { error: "#7f1d1d", warn: "#78350f", info: "#1e3a5f" };
  el.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    background:${colors[level] ?? colors.error}; color:#fff;
    padding:10px 20px; border-radius:8px; font-size:13px;
    z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,.3);
    max-width:90vw; text-align:center; pointer-events:none;
  `;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

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
export async function fetchCommunityRecipes() {
  const res = await api.get("/recipes", { params: { community: 1 } });
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
  const { id: _id, isBuiltIn: _bi, createdAt: _ca, updatedAt: _ua,
          isPublic: _ip, authorName: _an, authorSetup: _as, ...fields } = recipe;
  return createRecipe({ ...fields, sourceRecipe: recipe.name, isPublic: 0,
    roastLevel: recipe.roastLevel || null, coffeeBrand: recipe.coffeeBrand || null,
    coffeeName: recipe.coffeeName || null });
}
export async function fetchRandomRecipe(filters = {}) {
  const params = {};
  if (filters.brewerType) params.brewerType = filters.brewerType;
  if (filters.roastLevel) params.roastLevel = filters.roastLevel;
  if (filters.coffeeBrand) params.coffeeBrand = filters.coffeeBrand;
  const res = await api.get("/recipes/random", { params });
  return res.data;
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

// ── Brew Notes ────────────────────────────────────────────────────────────────
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

// ── Community Posts ───────────────────────────────────────────────────────────
export async function fetchPosts() {
  const res = await api.get("/posts");
  return res.data;
}
export async function createPost(payload) {
  const res = await api.post("/posts", payload);
  return res.data;
}
export async function likePost(id) {
  const res = await api.put(`/posts/${id}/like`);
  return res.data;
}
export async function deletePost(id) {
  await api.delete(`/posts/${id}`);
}

export default api;
