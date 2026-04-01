import mongoose from "mongoose";

// Validates that route params containing an ID are valid MongoDB ObjectIds.
// Prevents Mongoose from throwing a CastError when an invalid ID is passed.
// Usage: router.delete("/:id", validateObjectId, deleteCredential)
export function validateObjectId(req, res, next) {
  const id = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: `Invalid ID format: "${id}"` });
  }
  next();
}
