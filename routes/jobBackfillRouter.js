import express from "express";
import { backfillJobAmountsFromQuotes } from "../controllers/jobBackfillController.js";

const router = express.Router();

// POST /api/jobs/backfill-amounts-from-quotes
router.post("/", backfillJobAmountsFromQuotes);

export default router;