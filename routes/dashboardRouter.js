import express from "express";
import {
  getDashboardJobs,
  getEmployeeDashboardStats,
} from "../controllers/dashboardController.js";

import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

import {
  authRateLimit,
  publicRateLimit,
  authenticatedRateLimit
} from '../middleware/rateLimit.middleware.js';


const router = express.Router();

router.get("/", authenticatedRateLimit, requireAuth, requireRole("employee", "admin", "owner"), getDashboardJobs);

router.get("/jobs", authenticatedRateLimit, requireAuth, requireRole("employee", "admin", "owner"), getDashboardJobs);
router.get("/", authenticatedRateLimit, requireAuth, requireRole("employee", "admin", "owner"), getDashboardJobs);
router.get("/employee/stats", authenticatedRateLimit, requireAuth, requireRole("employee", "admin", "owner"), getEmployeeDashboardStats);

export default router;