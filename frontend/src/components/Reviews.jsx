import React, { useState } from "react";
import RatingStars from "./RatingStars";

function Reviews({ productId, reviews, onCreate, onUpdate, onDelete }) {
  const [form, setForm] = useState({
    name: "",
    rating: 5,
    comment: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onCreate({
        productId,
        name: form.name,
        rating: Number(form.rating),
        comment: form.comment
      });
      setForm({ name: "", rating: 5, comment: "" });
    } catch (err) {
      setError(err?.response?.data?.errors?.join(", ") || "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-6">
      <h3 className="text-sm font-semibold text-slate-800 mb-2">Reviews</h3>

      <form
        onSubmit={handleSubmit}
        className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2"
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            required
            placeholder="Your name"
            className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
          <select
            className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm"
            value={form.rating}
            onChange={(e) => handleChange("rating", e.target.value)}
          >
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r} ★
              </option>
            ))}
          </select>
        </div>
        <textarea
          rows={3}
          placeholder="Share your thoughts about this coffee..."
          className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
          value={form.comment}
          onChange={(e) => handleChange("comment", e.target.value)}
        />
        {error && <div className="text-xs text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded-md bg-coffee-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-coffee-700 disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Add Review"}
        </button>
      </form>

      {reviews.length === 0 ? (
        <div className="text-xs text-slate-500">No reviews yet. Be the first!</div>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-800">{r.reviewerName}</span>
                <RatingStars value={r.rating} />
              </div>
              {r.comment && <p className="text-slate-700 mb-1">{r.comment}</p>}
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                <button
                  type="button"
                  className="text-red-500 hover:underline"
                  onClick={() => onDelete(r.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default Reviews;

