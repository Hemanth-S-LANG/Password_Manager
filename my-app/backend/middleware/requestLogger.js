// Logs every incoming request: method, path, status code, and response time.
// Useful for debugging and monitoring API activity.
export function requestLogger(req, res, next) {
  const start = Date.now();

  // Hook into the response "finish" event so we can log the final status code
  res.on("finish", () => {
    const ms = Date.now() - start;
    const color =
      res.statusCode >= 500 ? "\x1b[31m" // red   — server errors
      : res.statusCode >= 400 ? "\x1b[33m" // yellow — client errors
      : res.statusCode >= 300 ? "\x1b[36m" // cyan  — redirects
      : "\x1b[32m";                         // green  — success
    const reset = "\x1b[0m";

    console.log(
      `${color}[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)${reset}`
    );
  });

  next();
}
