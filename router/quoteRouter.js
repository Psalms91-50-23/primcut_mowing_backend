import express from "express";
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
    rejectQuote
} from "../controller/quoteController.js";

const router = express.Router();

// GET all quotes
router.get("/all", getAllQuotes);

// GET quote by ID
router.get("/id/:id", getQuoteById);

// GET quote by UUID
router.get("/uuid/:uuid", getQuoteByUUID);

// CREATE quote
router.post("/", createQuote);

// UPDATE quote by UUID
router.patch("/uuid/:uuid", updateQuoteByUUID);

// UPDATE quote by ID
router.patch("/id/:id", updateQuoteById);

// ACCEPT quote
router.patch("/accept-quote/uuid/:uuid", acceptQuote)

// REJECT quote
router.patch("/reject-quote/uuid/:uuid", rejectQuote)

// SOFT DELETE
router.delete("/soft-delete/uuid/:uuid", softDeleteQuote);

// REINSTATE
router.patch("/reinstate/uuid/:uuid", reinstateQuote);

// HARD DELETE
router.delete("/hard-delete/uuid/:uuid", hardDeleteQuote);

export default router;
