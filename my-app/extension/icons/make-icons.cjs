/**
 * Generates minimal PNG icons without any npm dependencies.
 * Uses only Node.js built-ins (fs).
 *
 * Run: node make-icons.cjs
 *
 * This writes valid 1x1 purple PNG files as placeholders.
 * Chrome only needs them to exist and be valid PNGs.
 * You can replace them with real artwork later.
 */

const fs = require("fs");
const path = require("path");

// Minimal valid PNG: a single #4f46e5 (indigo) pixel
// Generated via: https://png-pixel.com  color #4f46e5
// This is a complete, valid PNG binary encoded as base64
const PIXEL_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const sizes = [16, 48, 128];
const dir = __dirname;

sizes.forEach((size) => {
  const outPath = path.join(dir, `icon${size}.png`);
  if (fs.existsSync(outPath)) {
    console.log(`icon${size}.png already exists, skipping.`);
    return;
  }
  fs.writeFileSync(outPath, Buffer.from(PIXEL_PNG_B64, "base64"));
  console.log(`Created icon${size}.png`);
});

console.log("\nDone! Icons are placeholder 1px PNGs.");
console.log("Replace them with real artwork if desired.");
