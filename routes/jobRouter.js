import express from 'express';
const router = express.Router();
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import {
  authRateLimit,
  publicRateLimit,
  authenticatedRateLimit
} from '../middleware/rateLimit.middleware.js';

import {
  getAllJobs,
  getJobByUUID,
  createJobFromQuote,
  getJobByQuoteUUID,
  hardDeleteJobByUUID,
  updateByUUID,
  backfillJobAddresses,
  getJobSummaryByUUID,
  getJobDetailedByUUID,
  updateJobSchedule,
  getJobRecurrences,
  extendJobRecurrences,
  getDashboardJobs,
  getPublicJobView,
  getJobsByCustomerUUID,
  getScheduledJobs
} from '../controllers/jobController.js';

// GET all jobs with optional filters:
// /all?status=pending
// /all?scheduledPreset=today
// /all?scheduledPreset=day_prior
// /all?scheduledPreset=seven_days_prior
// /all?scheduledStart=2026-04-05&scheduledEnd=2026-04-12
// /all?status=scheduled&scheduledStart=2026-04-05&scheduledEnd=2026-04-12
// /all?search=jgrl5
router.get('/all', getAllJobs);
// router.get('/all', requireAuth, authenticatedRateLimit, requireRole(["owner", "admin", "employee"]), getAllJobs);
router.get("/scheduled", getScheduledJobs);
router.post("/backfill-addresses", backfillJobAddresses);

// router.get("/dashboard", getDashboardJobs);

router.get('/uuid/:uuid', getJobByUUID);

router.get('/:uuid/public-view', getPublicJobView);

router.post('/from-quote/:quote_uuid', createJobFromQuote);

router.get('/by-quote/:quote_uuid', getJobByQuoteUUID);

router.delete('/uuid/:uuid', hardDeleteJobByUUID);

router.get('/customer/:uuid', getJobsByCustomerUUID);

router.patch('/uuid/:uuid', updateByUUID);

router.get("/:uuid/summary", getJobSummaryByUUID);

router.get("/:uuid/details", getJobDetailedByUUID);

router.patch("/:uuid/schedule", updateJobSchedule);

router.get("/:uuid/recurrences", getJobRecurrences);

router.post("/:uuid/recurrences/extend", extendJobRecurrences);



export default router;