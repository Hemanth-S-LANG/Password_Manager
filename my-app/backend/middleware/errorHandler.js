// Global error handling middleware.
// Must be registered LAST in server.js (after all routes).
// Catches any error passed via next(err) or unhandled throws.
export function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: messages.join(", ") });
  }

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  // Mongoose duplicate key (e.g. unique field conflict)
  if (err.code === 11000) {
    return res.status(409).json({ error: "Duplicate entry" });
  }

  // Default: internal server error
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
}
