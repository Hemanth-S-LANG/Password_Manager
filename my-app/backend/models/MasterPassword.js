import mongoose from "mongoose";

// Only one document ever exists — the master password hash
const masterPasswordSchema = new mongoose.Schema({
  hash: { type: String, required: true },
});

export default mongoose.model("MasterPassword", masterPasswordSchema);
