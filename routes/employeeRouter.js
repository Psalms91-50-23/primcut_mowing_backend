import express from 'express';
import { createEmployee , getEmployee, listEmployees, updateEmployee, deleteEmployee, createEmployeeLinkToUser } from '../controllers/employeeController.js';
import {
  authRateLimit,
  publicRateLimit,
  authenticatedRateLimit
} from '../middleware/rateLimit.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = express.Router();

// CRUD routes

// Register new employee (admin only)
router.post('/register', requireAuth, authenticatedRateLimit, requireRole(["admin", "owner"]), createEmployee );

router.post("/create/user-link/:user_uuid", requireAuth, authenticatedRateLimit, requireRole(["admin", "owner"]), createEmployeeLinkToUser);

router.get('/', requireAuth,requireRole(["admin", "owner"]), listEmployees);
router.get('/:user_uuid', requireAuth, getEmployee);
router.put('/:user_uuid', requireAuth, requireRole(["admin", "employee", "owner"]), updateEmployee);
router.delete('/:user_uuid', requireAuth, requireRole(["admin", "owner"]), deleteEmployee);

export default router;
