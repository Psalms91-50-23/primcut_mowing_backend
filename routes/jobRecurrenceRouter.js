import express from 'express';
import {
  createJobRecurrence,
  getRecurrencesByJobUUID,
  getRecurrenceByUUID,
  updateRecurrence,
  completeRecurrence,
  missRecurrence,
  deleteRecurrence,
  tempBackfillRecurrenceServicesFromParent,
  updateRecurrenceAndNotifyClient
} from '../controllers/jobRecurrenceController.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import {
  authRateLimit,
  publicRateLimit,
  authenticatedRateLimit
} from '../middleware/rateLimit.middleware.js';


const router = express.Router();

// Temp backfill route
router.post('/temp/backfill-from-parent', tempBackfillRecurrenceServicesFromParent);

// Create recurrence
router.post('/', createJobRecurrence);

// Get recurrences for a job
router.get('/job/:job_uuid', getRecurrencesByJobUUID);

// Get single recurrence
router.get('/:uuid', getRecurrenceByUUID);

// General update
router.patch('/:uuid', updateRecurrence);
router.patch('/:uuid/notify-client', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee"), updateRecurrenceAndNotifyClient);
// Update status
router.patch('/:uuid/complete', completeRecurrence);
router.patch('/:uuid/missed', missRecurrence);

// Delete recurrence
router.delete('/:uuid', deleteRecurrence);

export default router;