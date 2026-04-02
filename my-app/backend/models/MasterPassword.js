import mongoose from "mongoose";

const securityAnswerSchema = new mongoose.Schema({
  questionKey: { type: String, required: true }, // e.g. "school"
  answerHash:  { type: String, required: true }, // bcrypt hash of lowercased answer
}, { _id: false });

// Only one document ever exists — the master password hash
const masterPasswordSchema = new mongoose.Schema({
  hash:             { type: String, required: true },
  securityAnswers:  { type: [securityAnswerSchema], default: [] },
});

export default mongoose.model("MasterPassword", masterPasswordSchema);
