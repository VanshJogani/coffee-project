/**
 * Required auth middleware — returns 401 if no valid user session.
 * Used only for endpoints that truly require authentication (e.g., claim).
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

module.exports = requireAuth;
