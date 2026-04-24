import express from "express";
import { viewPublicQuote, create, revokeAll, validateQuoteAccessToken, 
    validateQuoteSession
 } from "../controllers/quoteAccessTokenController.js";
import {
  publicRateLimit,
  authenticatedRateLimit,
} from "../middleware/rateLimit.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = express.Router();

// router.get('/uuid/:uuid', viewPublicQuote);
router.get('/session/uuid/:uuid', publicRateLimit, validateQuoteSession);

router.post('/validate-token/uuid/:uuid', validateQuoteAccessToken);

// Create a new token (Admin only)
router.post("/", authenticatedRateLimit, requireAuth, requireRole(["owner", "admin","employee"]), create);

// Revoke all tokens for a quote (Admin only)
router.delete("/revoke/:quote_uuid", authenticatedRateLimit, requireAuth, requireRole(["owner", "admin","employee"]), revokeAll);

// Public access to quote via token
// router.get("/:token", viewPublicQuote);

export default router;
