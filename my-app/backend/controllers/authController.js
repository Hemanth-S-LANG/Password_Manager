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

// The 5 fixed security questions
export const SECURITY_QUESTIONS = [
  { key: "school",        label: "What was the name of your first school?" },
  { key: "color",         label: "What is your favourite color?" },
  { key: "birthplace",    label: "What is your place of birth?" },
  { key: "vehicle",       label: "What is your vehicle number?" },
  { key: "mothers_maiden",label: "What is your mother's maiden name?" },
];

// GET /api/auth/security-questions/status
export async function getSecurityStatus(req, res) {
  try {
    const record = await MasterPassword.findOne();
    if (!record) return res.status(404).json({ error: "No master password set" });
    res.json({ hasSecurityQuestions: record.securityAnswers.length > 0 });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

// POST /api/auth/security-questions/save  { answers: [{ key, answer }] }
export async function saveSecurityQuestions(req, res) {
  try {
    const { answers } = req.body;
    if (!Array.isArray(answers) || answers.length !== 3)
      return res.status(400).json({ error: "Provide exactly 3 answers" });

    const record = await MasterPassword.findOne();
    if (!record) return res.status(404).json({ error: "No master password set" });

    const hashed = await Promise.all(
      answers.map(async ({ key, answer }) => ({
        questionKey: key,
        answerHash: await bcrypt.hash(answer.trim().toLowerCase(), 10),
      }))
    );

    await MasterPassword.findByIdAndUpdate(record._id, { securityAnswers: hashed });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
}

// POST /api/auth/security-questions/verify  { answers: [{ key, answer }] }
export async function verifySecurityQuestions(req, res) {
  try {
    const { answers } = req.body;
    if (!Array.isArray(answers) || answers.length !== 3)
      return res.status(400).json({ error: "Provide exactly 3 answers" });

    const record = await MasterPassword.findOne();
    if (!record || record.securityAnswers.length === 0)
      return res.status(404).json({ error: "Security questions not set" });

    for (const { key, answer } of answers) {
      const stored = record.securityAnswers.find((a) => a.questionKey === key);
      if (!stored) return res.status(400).json({ error: `Unknown question: ${key}` });
      const match = await bcrypt.compare(answer.trim().toLowerCase(), stored.answerHash);
      if (!match) return res.status(401).json({ error: "One or more answers are incorrect" });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
}

// POST /api/auth/reset-password  { answers: [{ key, answer }], newPassword }
export async function resetPassword(req, res) {
  try {
    const { answers, newPassword } = req.body;
    if (!Array.isArray(answers) || answers.length !== 3 || !newPassword)
      return res.status(400).json({ error: "Answers and new password required" });

    const record = await MasterPassword.findOne();
    if (!record || record.securityAnswers.length === 0)
      return res.status(404).json({ error: "Security questions not set" });

    // Verify all answers first
    for (const { key, answer } of answers) {
      const stored = record.securityAnswers.find((a) => a.questionKey === key);
      if (!stored) return res.status(400).json({ error: `Unknown question: ${key}` });
      const match = await bcrypt.compare(answer.trim().toLowerCase(), stored.answerHash);
      if (!match) return res.status(401).json({ error: "One or more answers are incorrect" });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await MasterPassword.findByIdAndUpdate(record._id, { hash: newHash });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
}
