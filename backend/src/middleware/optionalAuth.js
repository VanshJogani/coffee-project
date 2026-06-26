const jwt = require("jsonwebtoken");

/**
 * Optional auth middleware — attaches req.user if a valid token is present,
 * but NEVER blocks the request. Anonymous users proceed with req.user = null.
 */
function optionalAuth(req, res, next) {
  req.user = null;

  // Try cookie first, then Authorization header (for future mobile support)
  const token =
    req.cookies?.access_token ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      displayName: payload.displayName,
    };
  } catch (_err) {
    // Token invalid or expired — that's fine, continue as anonymous
  }

  next();
}

module.exports = optionalAuth;
