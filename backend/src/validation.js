function sanitizeString(value, maxLen = 255) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function validateRating(rating) {
  const num = Number(rating);
  if (!Number.isFinite(num) || num < 1 || num > 5) {
    return { valid: false, message: "Rating must be between 1 and 5." };
  }
  if (!Number.isInteger(num)) {
    return { valid: false, message: "Rating must be a whole number." };
  }
  return { valid: true, value: num };
}

function validateReviewPayload(body) {
  const errors = [];
  const productId = Number(body.productId);
  if (!Number.isInteger(productId) || productId <= 0) {
    errors.push("Invalid productId.");
  }

  const name = sanitizeString(body.name || "", 100);
  if (!name) {
    errors.push("Name is required.");
  }

  const ratingResult = validateRating(body.rating);
  if (!ratingResult.valid) {
    errors.push(ratingResult.message);
  }

  const comment = sanitizeString(body.comment || "", 2000);

  return {
    errors,
    value: {
      productId,
      name,
      rating: ratingResult.valid ? ratingResult.value : null,
      comment
    }
  };
}

module.exports = {
  sanitizeString,
  validateRating,
  validateReviewPayload
};

