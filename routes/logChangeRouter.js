import express from 'express';
import {
    getAllChangeLogs,
    getLogsByEntity
} from '../controllers/logChangeController.js';

const router = express.Router();

/**
 * GET /logs
 * Optional query params:
 *  - entity_type
 *  - entity_uuid
 */
router.get('/', getAllChangeLogs);

/**
 * GET /logs/:entityType/:uuid
 * Example: /logs/jobs/grOWfp1Uc
 */
router.get('/:entityType/:uuid', getLogsByEntity);

export default router;
