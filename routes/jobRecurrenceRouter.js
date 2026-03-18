import express from 'express';
import {
    createJobRecurrence,
    getRecurrencesByJobUUID,
    getRecurrenceByUUID,
    completeRecurrence,
    missRecurrence,
    deleteRecurrence,

} from '../controllers/jobRecurrenceController.js';

const router = express.Router();

// Create recurrence
router.post('/', createJobRecurrence);

// Get recurrences for a job
router.get('/job/:job_uuid', getRecurrencesByJobUUID);

// Get single recurrence
router.get('/:uuid', getRecurrenceByUUID);

// Update status
router.patch('/:uuid/complete', completeRecurrence);

router.patch('/:uuid/missed', missRecurrence);

// Delete recurrence
router.delete('/:uuid', deleteRecurrence);


export default router;
