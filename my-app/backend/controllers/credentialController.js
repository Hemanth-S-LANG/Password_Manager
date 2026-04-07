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

// Map a Credential doc to a safe response object
function toResponse(c, plainPassword) {
  return {
    _id:             c._id,
    website:         c.website,
    username:        c.username,
    password:        plainPassword,
    category:        c.category,
    notes:           c.notes || "",
    createdAt:       c.createdAt,
    updatedAt:       c.updatedAt,
    lastUsedAt:      c.lastUsedAt  || null,
    autofillCount:   c.autofillCount || 0,
    passwordHistory: (c.passwordHistory || []).map((h) => ({
      password:  decrypt(h.password),
      changedAt: h.changedAt,
    })),
  };
}

// Password strength check (mirrors frontend logic)
function isStrongPassword(pwd) {
  return (
    pwd.length >= 8 &&
    /[A-Z]/.test(pwd) &&
    /[0-9]/.test(pwd) &&
    /[^A-Za-z0-9]/.test(pwd)
  );
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
    res.json(credentials.map((c) => toResponse(c, decrypt(c.password))));
  } catch {
    res.status(500).json({ error: "Failed to fetch credentials" });
  }
}

// GET /api/credentials/stats — vault analytics & security score
export async function getStats(req, res) {
  try {
    const all = await Credential.find().sort({ createdAt: -1 });
    const total = all.length;

    if (total === 0) {
      return res.json({
        total: 0, strong: 0, weak: 0, reused: 0,
        mostRecent: null, securityScore: 0,
        duplicateSites: [], topAutofilled: [],
      });
    }

    const plains = all.map((c) => ({ doc: c, pwd: decrypt(c.password) }));

    // Strong vs weak
    const strong = plains.filter((p) => isStrongPassword(p.pwd)).length;
    const weak   = total - strong;

    // Reused passwords (same password on different sites)
    const pwdMap = {};
    plains.forEach(({ doc, pwd }) => {
      if (!pwdMap[pwd]) pwdMap[pwd] = [];
      pwdMap[pwd].push(doc.website);
    });
    const duplicateSites = Object.entries(pwdMap)
      .filter(([, sites]) => sites.length > 1)
      .map(([, sites]) => sites);
    const reused = plains.filter(({ pwd }) => pwdMap[pwd].length > 1).length;

    // Most recently added
    const mostRecent = all[0] ? { website: all[0].website, createdAt: all[0].createdAt } : null;

    // Top autofilled credentials
    const topAutofilled = [...all]
      .filter((c) => c.autofillCount > 0)
      .sort((a, b) => b.autofillCount - a.autofillCount)
      .slice(0, 3)
      .map((c) => ({ website: c.website, autofillCount: c.autofillCount }));

    // Security score out of 100
    const strongScore  = Math.round((strong / total) * 40);
    const reusedScore  = Math.round(Math.max(0, 1 - reused / total) * 30);
    const now          = Date.now();
    const oldCount     = all.filter((c) => (now - new Date(c.createdAt)) > 90 * 86400000).length;
    const ageScore     = Math.round(Math.max(0, 1 - oldCount / total) * 20);
    const unusedCount  = all.filter((c) => !c.lastUsedAt || (now - new Date(c.lastUsedAt)) > 30 * 86400000).length;
    const usageScore   = Math.round(Math.max(0, 1 - unusedCount / total) * 10);
    const securityScore = strongScore + reusedScore + ageScore + usageScore;

    res.json({
      total, strong, weak, reused,
      mostRecent, securityScore,
      duplicateSites,
      topAutofilled,
      breakdown: { strongScore, reusedScore, ageScore, usageScore },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to compute stats" });
  }
}

// POST /api/credentials
export async function addCredential(req, res) {
  try {
    const { website, username, password, category, notes } = req.body;  // ← notes
    if (!website || !username || !password)
      return res.status(400).json({ error: "All fields are required" });

    const credential = await Credential.create({
      website, username,
      password: encrypt(password),
      category: category || "Others",
      notes:    notes    || "",          // ← notes
    });
    res.status(201).json(toResponse(credential, password));
  } catch {
    res.status(500).json({ error: "Failed to add credential" });
  }
}

// PUT /api/credentials/:id
export async function updateCredential(req, res) {
  try {
    const { website, username, password, category, notes } = req.body;
    const existing = await Credential.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Credential not found" });

    // Save the current password to history if it changed
    const historyEntry = [];
    if (existing.password !== encrypt(password)) {
      // Keep last 10 versions — prepend current before overwriting
      const newEntry   = { password: existing.password, changedAt: new Date() };
      const oldHistory = existing.passwordHistory || [];
      historyEntry.push(...[newEntry, ...oldHistory].slice(0, 10));
    } else {
      historyEntry.push(...(existing.passwordHistory || []));
    }

    const updated = await Credential.findByIdAndUpdate(
      req.params.id,
      {
        website, username,
        password:        encrypt(password),
        category:        category || "Others",
        notes:           notes    || "",
        passwordHistory: historyEntry,
      },
      { new: true }
    );
    res.json(toResponse(updated, password));
  } catch {
    res.status(500).json({ error: "Failed to update credential" });
  }
}

// PATCH /api/credentials/:id/used — called when autofill is triggered
export async function markUsed(req, res) {
  try {
    const updated = await Credential.findByIdAndUpdate(
      req.params.id,
      { lastUsedAt: new Date(), $inc: { autofillCount: 1 } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Credential not found" });
    res.json({ ok: true, lastUsedAt: updated.lastUsedAt, autofillCount: updated.autofillCount });
  } catch {
    res.status(500).json({ error: "Failed to update usage" });
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