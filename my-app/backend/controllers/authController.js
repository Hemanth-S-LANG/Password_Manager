import bcrypt from "bcryptjs";
import MasterPassword from "../models/MasterPassword.js";

// GET /api/auth/status → check if master password exists
export async function getStatus(req, res) {
  try {
    const exists = await MasterPassword.findOne();
    res.json({ hasPassword: !!exists });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

// POST /api/auth/create → create master password (first time)
export async function createMaster(req, res) {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Password required" });

    const existing = await MasterPassword.findOne();
    if (existing) return res.status(400).json({ error: "Master password already set" });

    const hash = await bcrypt.hash(password, 12);
    await MasterPassword.create({ hash });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
}

// POST /api/auth/verify → verify master password
export async function verifyMaster(req, res) {
  try {
    const { password } = req.body;
    const record = await MasterPassword.findOne();
    if (!record) return res.status(404).json({ error: "No master password set" });

    const match = await bcrypt.compare(password, record.hash);
    if (!match) return res.status(401).json({ error: "Incorrect password" });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

// PUT /api/auth/change → change master password
export async function changeMaster(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: "Both current and new password are required" });

    const record = await MasterPassword.findOne();
    if (!record) return res.status(404).json({ error: "No master password set" });

    const match = await bcrypt.compare(currentPassword, record.hash);
    if (!match) return res.status(401).json({ error: "Current password is incorrect" });

    const newHash = await bcrypt.hash(newPassword, 12);
    await MasterPassword.findByIdAndUpdate(record._id, { hash: newHash });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
}
