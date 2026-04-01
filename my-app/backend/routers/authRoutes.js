import { Router } from "express";
import { getStatus, createMaster, verifyMaster, changeMaster } from "../controllers/authController.js";

const router = Router();

router.get("/status",  getStatus);
router.post("/create", createMaster);
router.post("/verify", verifyMaster);
router.put("/change",  changeMaster);

export default router;
