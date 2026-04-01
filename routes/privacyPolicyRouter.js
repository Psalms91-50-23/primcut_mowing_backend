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

// import { requireAuth } from "../middleware/requireAuth.js";
// import { requireAdminOrOwner } from "../middleware/requireAdminOrOwner.js";

const router = express.Router();

/**
 * Public routes
 */
router.get("/latest", getLatestPrivacyPolicy);
router.get("/active", getActivePrivacyPolicy);
router.get("/uuid/:uuid", getPrivacyPolicyByUUID);

/**
 * Admin routes
 * add your auth middleware if needed
 */
router.get("/", listPrivacyPolicies);
router.get("/versions", getPrivacyPolicyVersions);
router.post("/", createPrivacyPolicy);
router.patch("/activate/:uuid", activatePrivacyPolicy);

export default router;