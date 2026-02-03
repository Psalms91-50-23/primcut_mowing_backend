import express from 'express';
const router = express.Router();

import {
    getAllJobs,
    getJobByUUID,
    createJobFromQuote,
    getJobByQuoteUUID,
    hardDeleteJobByUUID,
    updateByUUID
} from '../controllers/jobController.js';

// GET all jobs
router.get('/all', getAllJobs);

// GET job by UUID
router.get('/uuid/:uuid', getJobByUUID);

// CREATE job from quote UUID
router.post('/from-quote/:quote_uuid', createJobFromQuote);

// GET job by quote UUID
router.get('/by-quote/:quote_uuid', getJobByQuoteUUID);

// HARD DELETE job by UUID
router.delete('/uuid/:uuid', hardDeleteJobByUUID);

// UPDATE job by UUID
router.patch('/uuid/:uuid', updateByUUID);


export default router;