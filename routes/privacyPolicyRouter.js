import express from "express";
import {
  createPrivacyPolicy,
  getActivePrivacyPolicy,
  getLatestPrivacyPolicy,
  getPrivacyPolicyByUUID,
  getPrivacyPolicyVersions,
  listPrivacyPolicies,
  activatePrivacyPolicy,
  
} from "../controllers/privacyPolicyController.js";


import {
  authRateLimit,
  publicRateLimit,
  authenticatedRateLimit
} from '../middleware/rateLimit.middleware.js';

import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = express.Router();

/**
 * Public routes
 */
router.get("/latest", publicRateLimit, getLatestPrivacyPolicy);
router.get("/active", publicRateLimit, getActivePrivacyPolicy);
router.get("/uuid/:uuid", publicRateLimit, getPrivacyPolicyByUUID);

/**
 * Admin routes
 * add your auth middleware if needed
 */
router.get("/", authenticatedRateLimit, requireAuth, requireRole("admin", "owner"),  listPrivacyPolicies);
router.get("/versions", authenticatedRateLimit, requireAuth, requireRole("admin", "owner"), getPrivacyPolicyVersions);
// router.get("/versions", authenticatedRateLimit, requireAuth, requireRole("admin", "owner"), getPrivacyPolicyVersions);
router.post("/", authenticatedRateLimit, requireAuth, requireRole("admin", "owner"), createPrivacyPolicy);
router.patch("/activate/:uuid", authenticatedRateLimit, requireAuth, requireRole("admin", "owner"), activatePrivacyPolicy);

export default router;