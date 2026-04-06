import mongoose from "mongoose";

const credentialSchema = new mongoose.Schema(
  {
    website:      { type: String, required: true, trim: true },
    username:     { type: String, required: true, trim: true },
    // password stored as AES-256-CBC encrypted string
    password:     { type: String, required: true },
    category:     { type: String, required: true, trim: true, default: "Others" },
    // Optional free-text notes — useful for security questions, recovery codes, PINs
    notes:        { type: String, default: "", trim: true },
    lastUsedAt:   { type: Date, default: null },
    autofillCount:{ type: Number, default: 0 },
  },
  { timestamps: true } // createdAt = added date, updatedAt = last modified
);

export default mongoose.model("Credential", credentialSchema);