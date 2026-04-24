import express from 'express';
import {
    getAllChangeLogs,
    getLogsByEntity
} from '../controllers/changeLogController.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import {
  authRateLimit,
  publicRateLimit,
  authenticatedRateLimit
} from '../middleware/rateLimit.middleware.js';
const router = express.Router();

/**
 * GET /logs
 * Optional query params:
 *  - entity_type
 *  - entity_uuid
 */
router.get('/', requireAuth, authenticatedRateLimit, requireRole(["owner", "admin"]), getAllChangeLogs);

/**
 * GET /logs/:entityType/:uuid
 * Example: /logs/jobs/grOWfp1Uc
 */
router.get('/:entityType/:uuid', requireAuth, authenticatedRateLimit, requireRole(["owner", "admin"]), getLogsByEntity);

export default router;
