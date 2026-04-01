// Sanitizes request body to prevent NoSQL injection attacks.
// MongoDB operators like $where, $gt, $set start with "$".
// Stripping those keys from user input stops attackers from injecting query operators.
// Also trims whitespace from all string values.
export function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitize(req.body);
  }
  next();
}

function sanitize(obj) {
  if (Array.isArray(obj)) return obj.map(sanitize);

  if (typeof obj === "object" && obj !== null) {
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
      // Drop any key that starts with "$" — these are MongoDB operators
      if (key.startsWith("$")) continue;
      clean[key] = sanitize(value);
    }
    return clean;
  }

  // Trim whitespace from string values
  if (typeof obj === "string") return obj.trim();

  return obj;
}
