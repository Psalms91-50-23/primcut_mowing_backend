import express from "express";
import {
  createQuoteTermsAcceptance,
  getQuoteTermsAcceptanceByUUID,
  getQuoteTermsAcceptancesByQuoteUUID,
  getLatestQuoteTermsAcceptanceByQuoteUUID,
} from "../controllers/quoteTermsAcceptanceController.js";
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import {
  authRateLimit,
  publicRateLimit,
  authenticatedRateLimit
} from '../middleware/rateLimit.middleware.js';
// import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Public or semi-public:
 * Used when customer accepts terms for a quote.
 */
router.post("/", authenticatedRateLimit, requireAuth, requireRole("admin", "owner"), createQuoteTermsAcceptance);

/**
 * Protected routes below if needed
 */
// router.get("/:uuid", requireAuth, getQuoteTermsAcceptanceByUUID);
// router.get("/quote/:quote_uuid", requireAuth, getQuoteTermsAcceptancesByQuoteUUID);
// router.get("/quote/:quote_uuid/latest", requireAuth, getLatestQuoteTermsAcceptanceByQuoteUUID);

router.get("/:uuid", getQuoteTermsAcceptanceByUUID);
router.get("/quote/:quote_uuid", authenticatedRateLimit, requireAuth, requireRole("admin", "owner"),  getQuoteTermsAcceptancesByQuoteUUID);
router.get("/quote/:quote_uuid/latest", authenticatedRateLimit, requireAuth, requireRole("admin", "owner"), getLatestQuoteTermsAcceptanceByQuoteUUID);

export default router;