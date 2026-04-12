import axios from "axios";

const api = axios.create({
  baseURL: "/api"
});

export async function fetchProducts(params) {
  const res = await api.get("/products", { params });
  return res.data;
}

export async function fetchProduct(id) {
  const res = await api.get(`/products/${id}`);
  return res.data;
}

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

export default api;

