import mongoose from "mongoose";

const credentialSchema = new mongoose.Schema(
  {
    website:  { type: String, required: true, trim: true },
    username: { type: String, required: true, trim: true },
    // password stored as AES-256-CBC encrypted string
    password: { type: String, required: true },
    category: { type: String, required: true, trim: true, default: "Others" },
  },
  { timestamps: true }
);

export default mongoose.model("Credential", credentialSchema);
