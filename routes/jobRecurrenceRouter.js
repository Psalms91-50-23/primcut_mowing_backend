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
router.post('/', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee"), createJobRecurrence);

// Get recurrences for a job
router.get('/job/:job_uuid', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), getRecurrencesByJobUUID);

// Get single recurrence
router.get('/:uuid', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), getRecurrenceByUUID);

// General update
router.patch('/:uuid', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), updateRecurrence);

router.patch('/:uuid/notify-client', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee"), updateRecurrenceAndNotifyClient);
// Update status
router.patch('/:uuid/complete', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee"),  completeRecurrence);
router.patch('/:uuid/missed', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee"), missRecurrence);

// Delete recurrence
router.delete('/:uuid', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee"), deleteRecurrence);

export default router;