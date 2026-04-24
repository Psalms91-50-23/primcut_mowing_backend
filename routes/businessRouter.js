import express from 'express';
import { 
    getAllBusinesses,
    getBusinessByUUID,
    getBusinessByName,
    createBusiness,
    updateBusinessByUUID,
    softDeleteBusiness,
    reinstateBusiness,
    hardDeleteBusiness
} from '../controllers/businessController.js';

import {
  publicRateLimit,
  authenticatedRateLimit,
} from "../middleware/rateLimit.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = express.Router();

// GET all businesses
router.get('/all', authenticatedRateLimit, requireAuth, requireRole(["owner", "admin","employee", "customer"]), getAllBusinesses);

// GET business by UUID
router.get('/uuid/:uuid', authenticatedRateLimit, requireAuth, requireRole(["owner", "admin","employee", "customer"]), getBusinessByUUID);

// GET business by name
router.get('/name/:name', authenticatedRateLimit, requireAuth, requireRole(["owner", "admin","employee", "customer"]), getBusinessByName);

// CREATE business
router.post('/', authenticatedRateLimit, requireAuth, requireRole(["owner", "admin","employee", "customer"]), createBusiness);

// UPDATE business by UUID
router.patch('/uuid/:uuid', authenticatedRateLimit, requireAuth, requireRole(["owner", "admin","employee", "customer"]), updateBusinessByUUID);

// SOFT DELETE business by UUID
router.patch('/soft-delete/uuid/:uuid', authenticatedRateLimit, requireAuth, requireRole(["owner", "admin","employee", "customer"]), softDeleteBusiness);

// REINSTATE business by UUID
router.patch('/reinstate/uuid/:uuid', authenticatedRateLimit, requireAuth, requireRole(["owner", "admin","employee", "customer"]), reinstateBusiness);

// HARD DELETE business by UUID
router.delete('/hard-delete/uuid/:uuid', authenticatedRateLimit, requireAuth, requireRole(["owner", "admin","employee", "customer"]),  hardDeleteBusiness);

export default router;
