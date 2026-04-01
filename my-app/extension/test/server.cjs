/**
 * Tiny static server — serves the test login page over http://localhost:3333
 * Run: node server.cjs
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3333;

const routes = {
  "/":       path.join(__dirname, "login-test.html"),
  "/login":  path.join(__dirname, "login-test.html"),
  "/signup": path.join(__dirname, "signup-test.html"),
};

http.createServer((req, res) => {
  const file = routes[req.url] || routes["/"];
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(fs.readFileSync(file));
}).listen(PORT, () => {
  console.log(`\n✅ Test pages running:\n`);
  console.log(`  Login page  → http://localhost:${PORT}/login`);
  console.log(`  Signup page → http://localhost:${PORT}/signup  ← test password suggestion here\n`);
});
