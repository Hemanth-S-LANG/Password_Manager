import Credential from "../models/Credential.js";
import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const KEY = crypto.scryptSync(
  process.env.ENCRYPTION_KEY || "fallback_key_32chars_padding_here",
  "salt",
  32
);

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(stored) {
  const [ivHex, encHex] = stored.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// GET /api/credentials — supports ?category= and ?website= filters
export async function getCredentials(req, res) {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.website) {
      filter.website = {
        $regex: req.query.website.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    }
    const credentials = await Credential.find(filter).sort({ createdAt: -1 });
    res.json(
      credentials.map((c) => ({
        _id: c._id,
        website: c.website,
        username: c.username,
        password: decrypt(c.password),
        category: c.category,
        createdAt: c.createdAt,
      }))
    );
  } catch {
    res.status(500).json({ error: "Failed to fetch credentials" });
  }
}

// POST /api/credentials
export async function addCredential(req, res) {
  try {
    const { website, username, password, category } = req.body;
    if (!website || !username || !password)
      return res.status(400).json({ error: "All fields are required" });

    const credential = await Credential.create({
      website, username,
      password: encrypt(password),
      category: category || "Others",
    });
    res.status(201).json({
      _id: credential._id,
      website: credential.website,
      username: credential.username,
      password,
      category: credential.category,
      createdAt: credential.createdAt,
    });
  } catch {
    res.status(500).json({ error: "Failed to add credential" });
  }
}

// PUT /api/credentials/:id
export async function updateCredential(req, res) {
  try {
    const { website, username, password, category } = req.body;
    const updated = await Credential.findByIdAndUpdate(
      req.params.id,
      { website, username, password: encrypt(password), category: category || "Others" },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Credential not found" });
    res.json({
      _id: updated._id,
      website: updated.website,
      username: updated.username,
      password,
      category: updated.category,
      createdAt: updated.createdAt,
    });
  } catch {
    res.status(500).json({ error: "Failed to update credential" });
  }
}

// DELETE /api/credentials/:id
export async function deleteCredential(req, res) {
  try {
    const deleted = await Credential.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Credential not found" });
    res.json({ message: "Deleted successfully" });
  } catch {
    res.status(500).json({ error: "Failed to delete credential" });
  }
}
