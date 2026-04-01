/**
 * Run this once with Node.js to generate the required PNG icons:
 *   node generate-icons.js
 *
 * Requires the 'canvas' package:
 *   npm install canvas
 *
 * Or you can simply export your own 16x16, 48x48, 128x128 PNG files
 * named icon16.png, icon48.png, icon128.png and place them in this folder.
 */

import { createCanvas } from "canvas";
import { writeFileSync } from "fs";

const sizes = [16, 48, 128];

for (const size of sizes) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#1e1b4b";
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();

  // Key emoji approximation
  ctx.fillStyle = "#a5b4fc";
  ctx.font = `bold ${size * 0.6}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🔑", size / 2, size / 2);

  writeFileSync(`icon${size}.png`, canvas.toBuffer("image/png"));
  console.log(`Generated icon${size}.png`);
}
