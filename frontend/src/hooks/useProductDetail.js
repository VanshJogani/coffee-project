import { useState } from "react";
import { fetchProduct, createReview, deleteReview } from "../api/client";

export function useProductDetail() {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [fromRandomizer, setFromRandomizer] = useState(false);

  const openDetail = async (product, isRandomizer = false) => {
    try {
      const full = await fetchProduct(product.id);
      setSelectedProduct({ ...full, variants: product.variants || [] });
      setDetailOpen(true);
      setFromRandomizer(isRandomizer);
    } catch {
      // silently ignore — error handling is in the interceptor
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setFromRandomizer(false);
  };

  const handleCreateReview = async (payload) => {
    const created = await createReview(payload);
    setSelectedProduct(prev =>
      prev ? { ...prev, reviews: [created, ...(prev.reviews || [])] } : prev
    );
  };

  const handleDeleteReview = async (id) => {
    await deleteReview(id);
    setSelectedProduct(prev =>
      prev ? { ...prev, reviews: (prev.reviews || []).filter(r => r.id !== id) } : prev
    );
  };

  return {
    selectedProduct,
    detailOpen,
    fromRandomizer,
    openDetail,
    closeDetail,
    handleCreateReview,
    handleDeleteReview,
  };
}
