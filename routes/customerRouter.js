import express from 'express';
import { 
    getAllCustomers,
    getCustomerByUUID,
    getCustomerById,
    getCustomerByEmail,
    createCustomer,
    updateCustomerByUUID,
    updateCustomerById,
    softDeleteCustomer,
    reinstateCustomer,
    hardDeleteCustomer,
    getCustomersByBusinessUUID,
    linkCustomerToBusiness,
    getCustomerByPhone,
    getAllCustomersWithDetails,
    getOneCustomersWithDetails,
    getCustomerDetailedByUUID,
    getCustomerSummaryByUUID,
    getCustomerQuotes,
    getCustomerJobsAndRecurrences,
    getCustomerContacts,
    getMyCustomer,
    getCustomerFullProfileByUUID
} from '../controllers/customerController.js';

import {
  authRateLimit,
  publicRateLimit,
  authenticatedRateLimit
} from '../middleware/rateLimit.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
const router = express.Router();

// GET all customers
// router.get('/all', getAllCustomers);
// GET all customers and details, t
// router.get('/all/details', getAllCustomersWithDetails);
// GET all customers and details with pagination and 
// allows to get all customers using  http://localhost:4000/api/customers or
// pagination http://localhost:4000/api/customers?page=2&pageSize=7
router.get('/', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), getAllCustomersWithDetails);

router.get("/me", requireAuth, authenticatedRateLimit, requireRole(["customer"]), getMyCustomer);
// GET one customers and details
router.get('/one/details/uuid/:uuid', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), getOneCustomersWithDetails);

// GET customer by ID
router.get('/id/:id', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), getCustomerById);

// GET customer by UUID
router.get('/uuid/:uuid', requireAuth, authenticatedRateLimit,  requireRole(["owner", "admin","employee", "customer"]), getCustomerByUUID);

// GET customers by email
router.get('/email/:email', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), getCustomerByEmail);

// GET all customers for a business by business UUID
router.get('/business/:business_uuid', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), getCustomersByBusinessUUID);

// GET customer by phone
router.get('/phone', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), getCustomerByPhone);

// GET all customers with business details such as quotes and jobs etc
router.get('/all/details', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), getAllCustomers);

// CREATE customer
router.post('/', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), createCustomer);

// UPDATE customer by UUID
router.patch('/uuid/:uuid', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), updateCustomerByUUID);
    
//get quotes for customer by uuid
router.get('/uuid/:uuid/quotes', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), getCustomerQuotes);

//get customer alternative contacts for customer by uuid
router.get('/uuid/:uuid/contacts', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"),  getCustomerContacts);

//get jobs and recurrences for customer by uuid
router.get('/uuid/:uuid/jobs-and-recurrences', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"),  getCustomerJobsAndRecurrences);

// UPDATE customer by ID
router.patch('/id/:id', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee"), updateCustomerById);

// SOFT DELETE customer by UUID
router.delete('/soft-delete/uuid/:uuid', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), softDeleteCustomer);

// REINSTATE customer by UUID
router.patch('/reinstate/uuid/:uuid', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), reinstateCustomer);

// HARD DELETE customer by UUID
router.delete('/hard-delete/uuid/:uuid', authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee"), hardDeleteCustomer);

// LINK customer to business
router.patch('/uuid/:customer_uuid/link-business', linkCustomerToBusiness);

router.get("/:uuid/summary", authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), getCustomerSummaryByUUID);

router.get("/:uuid/details", authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), getCustomerDetailedByUUID);

router.get("/:uuid/full-profile", authenticatedRateLimit, requireAuth, requireRole("admin", "owner", "employee", "customer"), getCustomerFullProfileByUUID);

export default router;
