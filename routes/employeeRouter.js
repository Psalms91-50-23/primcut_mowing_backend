import express from 'express';
import { registerEmployee, getEmployee, listEmployees, updateEmployee, deleteEmployee } from '../controllers/employeeController.js';

import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = express.Router();

// Register new employee (admin only)
router.post('/register', requireAuth, requireRole(["admin", "owner"]), registerEmployee);

// CRUD routes
router.get('/', requireAuth,requireRole(["admin", "owner"]), listEmployees);
router.get('/:user_uuid', requireAuth, getEmployee);
router.put('/:user_uuid', requireAuth, requireRole(["admin", "employee", "owner"]), updateEmployee);
router.delete('/:user_uuid', requireAuth, requireRole(["admin", "owner"]), deleteEmployee);

export default router;
