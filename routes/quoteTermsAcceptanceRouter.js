import express from "express";
import {
  createQuoteTermsAcceptance,
  getQuoteTermsAcceptanceByUUID,
  getQuoteTermsAcceptancesByQuoteUUID,
  getLatestQuoteTermsAcceptanceByQuoteUUID,
} from "../controllers/quoteTermsAcceptanceController.js";

// import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Public or semi-public:
 * Used when customer accepts terms for a quote.
 */
router.post("/", createQuoteTermsAcceptance);

/**
 * Protected routes below if needed
 */
// router.get("/:uuid", requireAuth, getQuoteTermsAcceptanceByUUID);
// router.get("/quote/:quote_uuid", requireAuth, getQuoteTermsAcceptancesByQuoteUUID);
// router.get("/quote/:quote_uuid/latest", requireAuth, getLatestQuoteTermsAcceptanceByQuoteUUID);

router.get("/:uuid", getQuoteTermsAcceptanceByUUID);
router.get("/quote/:quote_uuid", getQuoteTermsAcceptancesByQuoteUUID);
router.get("/quote/:quote_uuid/latest", getLatestQuoteTermsAcceptanceByQuoteUUID);

export default router;