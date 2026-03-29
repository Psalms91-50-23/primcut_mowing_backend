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
    getJobsByCustomerUUID 
    
} from '../controllers/jobController.js';

// GET all jobs
router.get('/all', getAllJobs);
// router.get('/all', requireAuth, authenticatedRateLimit, requireRole(["owner", "admin","employee"]), getAllJobs);

router.post("/backfill-addresses", backfillJobAddresses);

// router.get("/dashboard", getDashboardJobs);
// GET job by UUID
router.get('/uuid/:uuid', getJobByUUID);

router.get('/:uuid/public-view', getPublicJobView );

// CREATE job from quote UUID
router.post('/from-quote/:quote_uuid', createJobFromQuote);

// GET job by quote UUID
router.get('/by-quote/:quote_uuid', getJobByQuoteUUID);

// HARD DELETE job by UUID
router.delete('/uuid/:uuid', hardDeleteJobByUUID);

router.get('/customer/:uuid', getJobsByCustomerUUID);

// UPDATE job by UUID
router.patch('/uuid/:uuid', updateByUUID);

router.get("/:uuid/summary", getJobSummaryByUUID);

router.get("/:uuid/details", getJobDetailedByUUID);

router.patch("/:uuid/schedule", updateJobSchedule);

router.get("/:uuid/recurrences", getJobRecurrences);

router.post("/:uuid/recurrences/extend", extendJobRecurrences);


export default router;