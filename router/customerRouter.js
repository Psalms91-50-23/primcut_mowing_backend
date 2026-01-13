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
    getOneCustomersWithDetails
} from '../controller/customerController.js';

const router = express.Router();

// GET all customers
router.get('/all', getAllCustomers);
// GET all customers and details
router.get('/all/details', getAllCustomersWithDetails);
// GET all customers and details with pagination
router.get('/', getAllCustomersWithDetails);
// GET one customers and details
router.get('/one/details/uuid/:uuid', getOneCustomersWithDetails);

// GET customer by ID
router.get('/id/:id', getCustomerById);

// GET customer by UUID
router.get('/uuid/:uuid', getCustomerByUUID);

// GET customers by email
router.get('/email/:email', getCustomerByEmail);

// GET all customers for a business by business UUID
router.get('/business/:business_uuid', getCustomersByBusinessUUID);

router.get('/phone', getCustomerByPhone);

// GET all customers with business details such as quotes and jobs etc
router.get('/all/details', getAllCustomers);

// CREATE customer
router.post('/', createCustomer);

// UPDATE customer by UUID
router.patch('/uuid/:uuid', updateCustomerByUUID);

// UPDATE customer by ID
router.patch('/id/:id', updateCustomerById);

// SOFT DELETE customer by UUID
router.delete('/soft-delete/uuid/:uuid', softDeleteCustomer);

// REINSTATE customer by UUID
router.patch('/reinstate/uuid/:uuid', reinstateCustomer);

// HARD DELETE customer by UUID
router.delete('/hard-delete/uuid/:uuid', hardDeleteCustomer);

// LINK customer to business
router.patch('/:customer_uuid/link-business', linkCustomerToBusiness);



export default router;
