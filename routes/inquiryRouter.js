import express from "express";
import {
  createInquiry,
  getAllInquiries,
  getInquiryByUUID,
  updateInquiryByUUID,
  deleteInquiryByUUID,
  getMyInquiries,
  getMyInquiryByUUID,
  createInquiryReply,
  getInquiries
} from "../controllers/InquiryController.js";

import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { optionalAuth } from '../middleware/optionalAuth.middleware.js';
import {
  authRateLimit,
  publicRateLimit,
  authenticatedRateLimit
} from '../middleware/rateLimit.middleware.js';

const router = express.Router();

// Public or authenticated submit
router.post("/create", publicRateLimit, optionalAuth,  requireRole(["admin", "owner"]), createInquiry);

router.get("/", getInquiries);
router.get("/all", authenticatedRateLimit, requireAuth, requireRole(["admin", "owner", "employee"]), getAllInquiries);

router.get("/:uuid", authenticatedRateLimit, requireAuth, requireRole(["admin", "owner", "employee"]), getInquiryByUUID);
// Staff only
// router.get("/:uuid", getInquiryByUUID);
// router.get("/:uuid", authenticatedRateLimit, requireAuth, requireRole(["admin", "owner", "employee", "customer"]), getInquiryByUUID);

router.patch("/:uuid", authenticatedRateLimit, requireAuth, requireRole(["admin", "owner", "employee"]), updateInquiryByUUID);

router.post("/:uuid/replies", authenticatedRateLimit, requireAuth, requireRole(["admin", "owner", "employee"]), createInquiryReply);

router.delete("/:uuid", authenticatedRateLimit, requireAuth, requireRole(["admin", "owner", "employee"]), deleteInquiryByUUID);

router.get("/my", authenticatedRateLimit, requireAuth, requireRole(["admin", "owner", "employee", "customer"]), getMyInquiries);

router.get("/my/:uuid", authenticatedRateLimit, requireAuth, requireRole(["admin", "owner", "employee", "customer"]), getMyInquiryByUUID);

export default router;