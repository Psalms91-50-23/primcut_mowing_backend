import express from "express";
import QuoteAccessTokenController from "../controllers/quoteAccessTokenController.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

// Create a new token (Admin only)
router.post("/", requireAuth, QuoteAccessTokenController.create);

// Revoke all tokens for a quote (Admin only)
router.delete("/revoke/:quote_uuid", requireAuth, QuoteAccessTokenController.revokeAll);

// Public access to quote via token
router.get("/public/:token", QuoteAccessTokenController.viewQuoteByToken);

export default router;
