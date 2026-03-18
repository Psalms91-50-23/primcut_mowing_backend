import express from "express";
import {
  createCustomerContact,
  getCustomerContacts,
  getCustomerContactByUUID,
  updateCustomerContact,
  deleteCustomerContact,
} from "../controllers/customerContactController.js";
import {
  authRateLimit,
  publicRateLimit,
  authenticatedRateLimit
} from '../middleware/rateLimit.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = express.Router();

// list all contacts for a customer
router.get("/customers/uuid/:customer_uuid/contacts", authenticatedRateLimit, requireAuth, requireRole(["owner", "admin","employee", "customer"]), getCustomerContacts);

// create new contact for a customer
router.post("/customers/uuid/:customer_uuid/contacts", authenticatedRateLimit, requireAuth, requireRole(["owner", "admin","employee", "customer"]),createCustomerContact);

// get one contact by contact uuid
router.get("/customer-contacts/uuid/:uuid", authenticatedRateLimit, requireRole(["owner", "admin","employee", "customer"]) , requireAuth, getCustomerContactByUUID);

// update one contact by contact uuid
router.patch("/customer-contacts/uuid/:uuid", authenticatedRateLimit, requireAuth, requireRole(["owner", "admin","employee", "customer"]), updateCustomerContact);

// soft delete one contact by contact uuid
router.delete("/customer-contacts/uuid/:uuid", authenticatedRateLimit, requireAuth, requireRole(["owner", "admin","employee", "customer"]),  deleteCustomerContact);

export default router;