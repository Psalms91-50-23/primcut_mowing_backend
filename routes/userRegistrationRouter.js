import express from "express";
import {
  requestUserRegistration,
  completeUserRegistration,
  validatePendingRegistrationToken,
  requestPrivilegedUserRegistration,
} from "../controllers/userRegistrationController.js";

import {
  publicRateLimit,
  authenticatedRateLimit,
} from "../middleware/rateLimit.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = express.Router();

router.post("/request-registration", publicRateLimit, requestUserRegistration);

router.post(
  "/request-privileged-registration",
  authenticatedRateLimit,
  requireAuth,
  requireRole("admin", "owner"),
  requestPrivilegedUserRegistration
);

router.post("/complete-registration", publicRateLimit, completeUserRegistration);

router.get(
  "/validate-registration-token",
  publicRateLimit,
  validatePendingRegistrationToken
);

export default router;
