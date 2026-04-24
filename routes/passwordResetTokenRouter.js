import express from "express";
import { requestPasswordReset, resetPassword, checkResetToken } from "../controllers/passwordResetTokenController.js";
import {
  authRateLimit,
  publicRateLimit,
  authenticatedRateLimit
} from '../middleware/rateLimit.middleware.js';

const router = express.Router();

// Request a password reset token
router.post("/request", publicRateLimit, requestPasswordReset);

// Check if a reset token is valid
router.post("/check", publicRateLimit, checkResetToken);

// Reset password using token
router.post("/reset", publicRateLimit, resetPassword);

export default router;