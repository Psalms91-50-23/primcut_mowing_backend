import express from "express";
import {
  createTermsAndConditions,
  getAllTermsAndConditions,
  getActiveTermsAndConditions,
  getTermsAndConditionsByUUID,
  updateTermsAndConditions,
  setActiveTermsAndConditions,
  deleteTermsAndConditions,
} from "../controllers/termsAndConditionsController.js";

import {
  authRateLimit,
  publicRateLimit,
  authenticatedRateLimit
} from '../middleware/rateLimit.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = express.Router();

// Public / customer-safe route
router.get("/active", getActiveTermsAndConditions);

// Admin / dashboard routes
router.get("/", getAllTermsAndConditions);
router.get("/:uuid", getTermsAndConditionsByUUID);
router.post("/", requireAuth, authenticatedRateLimit, requireRole("admin", "owner"), createTermsAndConditions);
router.patch("/:uuid", requireAuth, authenticatedRateLimit, requireRole("admin", "owner"), updateTermsAndConditions);
router.patch("/:uuid/activate", requireAuth, authenticatedRateLimit, requireRole("admin", "owner"), setActiveTermsAndConditions);
router.delete("/:uuid", requireAuth, authenticatedRateLimit, requireRole("admin", "owner"), deleteTermsAndConditions);

export default router;