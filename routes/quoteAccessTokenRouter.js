import express from "express";
import { viewPublicQuote, create, revokeAll, validateQuoteAccessToken, 
    validateQuoteSession
 } from "../controllers/quoteAccessTokenController.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

// router.get('/uuid/:uuid', viewPublicQuote);
router.get('/session/uuid/:uuid', validateQuoteSession);

router.post('/validate-token/uuid/:uuid', validateQuoteAccessToken);

// Create a new token (Admin only)
router.post("/", requireAuth, create);

// Revoke all tokens for a quote (Admin only)
router.delete("/revoke/:quote_uuid", requireAuth, revokeAll);

// Public access to quote via token
// router.get("/:token", viewPublicQuote);

export default router;
