import express from "express";
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import {
  authRateLimit,
  publicRateLimit,
  authenticatedRateLimit
} from '../middleware/rateLimit.middleware.js';
import {
    getAllQuotes,
    getQuoteById,
    getQuoteByUUID,
    createQuote,
    updateQuoteByUUID,
    updateQuoteById,
    softDeleteQuote,
    reinstateQuote,
    hardDeleteQuote,
    acceptQuote,
    rejectQuote,
    extendQuoteController,
    updateQuoteByUUIDAdmin,
    deleteAllFilesFromBucket,
    verifyQuoteToken
} from "../controllers/quoteController.js";

import {
  viewQuoteByToken
} from "../controllers/quoteAccessTokenController.js"

const router = express.Router();

// GET all quotes
router.get("/all", getAllQuotes);

// GET quote by ID
router.get("/id/:id", getQuoteById);

router.get('/api/quotes/public', publicRateLimit, viewQuoteByToken);

// GET quote by UUID
router.get("/uuid/:uuid", publicRateLimit, requireAuth, requireRole(["owner", "admin","employee", "customer"]), getQuoteByUUID);

router.get("/verify/:uuid", verifyQuoteToken);

// CREATE quote
router.post("/", publicRateLimit, createQuote);

// UPDATE quote by UUID
router.patch("/uuid/:uuid", publicRateLimit, requireAuth, requireRole(["owner", "admin","employee"]), updateQuoteByUUID);

// update quote by uuid admin
router.patch("/admin/uuid/:uuid", requireAuth, requireRole(["owner", "admin","employee"]),  updateQuoteByUUIDAdmin);

// UPDATE quote by ID
router.patch("/id/:id", updateQuoteById);

// ACCEPT quote
router.patch("/accept/uuid/:uuid", publicRateLimit, acceptQuote)

// REJECT quote
router.patch("/reject/uuid/:uuid", publicRateLimit, rejectQuote)

// SOFT DELETE
router.patch("/soft-delete/uuid/:uuid", softDeleteQuote);

// REINSTATE
router.patch("/reinstate/uuid/:uuid", reinstateQuote);

// HARD DELETE
router.delete("/hard-delete/uuid/:uuid", hardDeleteQuote);

// EXTEND quote
router.patch("/extend/uuid/:uuid", extendQuoteController);

router.delete("/dev/delete-all-quote-images", deleteAllFilesFromBucket);

export default router;
