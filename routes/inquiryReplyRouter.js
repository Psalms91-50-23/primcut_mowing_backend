import  express from ("express");
const router = express.Router();
import {
  authRateLimit,
  publicRateLimit,
  authenticatedRateLimit
} from '../middleware/rateLimit.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
const {
  createInquiryReply,
  getRepliesByInquiry,
  getReplyByUUID,
  deleteInquiryReply,
} = require("../controllers/inquiryReplyController");

// Create a reply (admin/business replying to inquiry)
router.post("/", requireAuth, authenticatedRateLimit, requireRole(["owner", "admin","employee"]), createInquiryReply);

// Get all replies for a specific inquiry (thread)
router.get("/inquiry/:inquiry_uuid", getRepliesByInquiry);

// Get a single reply
router.get("/:uuid", getReplyByUUID);

// Delete a reply
router.delete("/:uuid", deleteInquiryReply);

module.exports = router;