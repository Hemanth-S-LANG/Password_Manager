import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

import credentialRoutes from "./routers/credentialRoutes.js";
import authRoutes from "./routers/authRoutes.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { sanitizeInput } from "./middleware/sanitizeInput.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Explicitly point dotenv to the .env file in the same directory as server.js
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin.startsWith("http://localhost") || origin.startsWith("chrome-extension://")) {
      return cb(null, true);
    }
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(requestLogger);
app.use(sanitizeInput);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use("/api/credentials", credentialRoutes);
app.use("/api/auth", authRoutes);
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use(errorHandler);
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
