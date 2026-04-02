import { Router } from "express";
import {
  getStatus, createMaster, verifyMaster, changeMaster,
  getSecurityStatus, saveSecurityQuestions, verifySecurityQuestions, resetPassword,
} from "../controllers/authController.js";

const router = Router();

router.get("/status",                       getStatus);
router.post("/create",                      createMaster);
router.post("/verify",                      verifyMaster);
router.put("/change",                       changeMaster);
router.get("/security-questions/status",    getSecurityStatus);
router.post("/security-questions/save",     saveSecurityQuestions);
router.post("/security-questions/verify",   verifySecurityQuestions);
router.post("/reset-password",              resetPassword);

export default router;
