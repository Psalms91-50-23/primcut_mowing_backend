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
    // reinstateQuote,
    hardDeleteQuote,
    acceptQuote,
    rejectQuote,
    extendQuoteController,
    updateQuoteByUUIDEmployee,
    deleteAllFilesFromBucket,
    getQuotes,
    getLimitedQuoteByUUID,
    autoExpireQuote,
    restoreQuote,
    getQuoteSummaryByUUID,
    getQuoteDetailedByUUID,
    linkCustomerToQuote 
    
} from "../controllers/quoteController.js";
import { viewQuotePdf } from "../controllers/viewQuotePdfController.js";

import {
  viewPublicQuote
} from "../controllers/quoteAccessTokenController.js"

const router = express.Router();
// GET quotes with pagination and filtering
router.get("/", requireAuth, authenticatedRateLimit, requireRole(["owner", "admin","employee"]), getQuotes);
//PDF route for quote
router.get("/:uuid/pdf", viewQuotePdf);
// GET all quotes
router.get("/all", getAllQuotes);

// GET quote by ID
router.get("/id/:id", getQuoteById);

// router.get('/api/quotes/public', viewPublicQuote);

// GET quote by UUID
router.get("/uuid/:uuid", requireAuth, requireRole(["owner", "admin","employee", "customer"]), getQuoteByUUID);

// GET quote by UUID
router.get("/customer/uuid/:uuid", authenticatedRateLimit, requireAuth, requireRole(["owner", "admin","employee", "customer"]), getQuoteByUUID);

//Auto update quote status to expired
router.patch("/public/customer/uuid/:uuid", publicRateLimit,  autoExpireQuote);

// UPDATE quote by UUID
router.patch("/uuid/:uuid", requireAuth, authenticatedRateLimit, requireRole(["owner", "admin","employee"]), updateQuoteByUUID);

// update quote by uuid admin
router.patch("/employee/uuid/:uuid", requireAuth, authenticatedRateLimit, requireRole(["owner", "admin","employee"]),  updateQuoteByUUIDEmployee);

// UPDATE quote by ID
router.patch("/id/:id", updateQuoteById);

// CREATE quote
router.post("/create", createQuote);

// ACCEPT quote
router.patch("/public/accept/uuid/:uuid", acceptQuote)

//GET QUOTES BY LIMITED ROUTE 
router.get("/public/limited/uuid/:uuid", getLimitedQuoteByUUID)

// REJECT quote
router.patch("/public/reject/uuid/:uuid", rejectQuote)

// SOFT DELETE
router.patch("/soft-delete/uuid/:uuid", softDeleteQuote);

// RESTORE quote
router.patch("/restore-delete/uuid/:uuid", restoreQuote);
// router.patch("/reinstate/uuid/:uuid", reinstateQuote);

// HARD DELETE
router.delete("/hard-delete/uuid/:uuid", requireAuth, requireRole(["owner", "admin"]), hardDeleteQuote);

// EXTEND quote
router.patch("/extend/uuid/:uuid", extendQuoteController);

router.delete("/dev/delete-all-quote-images", deleteAllFilesFromBucket);

router.get("/:uuid/summary", getQuoteSummaryByUUID);

router.get("/:uuid/details", getQuoteDetailedByUUID);

router.patch("/public/link-customer/uuid/:uuid", linkCustomerToQuote );


export default router;
