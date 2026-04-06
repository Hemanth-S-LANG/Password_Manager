import { Router } from "express";
import {
  getCredentials,
  getStats,          // NEW
  addCredential,
  updateCredential,
  markUsed,          // NEW
  deleteCredential,
} from "../controllers/credentialController.js";
import { validateObjectId } from "../middleware/validateObjectId.js";

const router = Router();

router.get("/",           getCredentials);
router.get("/stats",      getStats);                              // NEW — must be before /:id routes
router.post("/",          addCredential);
router.put("/:id",        validateObjectId, updateCredential);
router.patch("/:id/used", validateObjectId, markUsed);            // NEW
router.delete("/:id",     validateObjectId, deleteCredential);

export default router;