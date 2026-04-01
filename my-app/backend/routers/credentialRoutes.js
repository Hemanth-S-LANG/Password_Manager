import { Router } from "express";
import {
  getCredentials, addCredential, updateCredential, deleteCredential,
} from "../controllers/credentialController.js";
import { validateObjectId } from "../middleware/validateObjectId.js";

const router = Router();

router.get("/",    getCredentials);
router.post("/",   addCredential);
router.put("/:id",    validateObjectId, updateCredential);
router.delete("/:id", validateObjectId, deleteCredential);

export default router;
