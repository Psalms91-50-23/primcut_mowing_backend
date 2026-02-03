import express from "express";
import { requestPasswordReset, resetPassword, checkResetToken } from "../controllers/passwordResetTokenController.js";

const router = express.Router();

// Request a password reset token
router.post("/request", requestPasswordReset);

// Check if a reset token is valid
router.post("/check", checkResetToken);

// Reset password using token
router.post("/reset", resetPassword);

export default router;