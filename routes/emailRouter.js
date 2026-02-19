import express from "express";
import { sendTestEmail } from "../controllers/emailController.js";

const router = express.Router();

// POST /api/email/test
router.post("/test", sendTestEmail);

export default router;