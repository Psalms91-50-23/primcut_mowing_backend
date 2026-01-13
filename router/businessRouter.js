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
} from '../controller/businessController.js';

const router = express.Router();

// GET all businesses
router.get('/all', getAllBusinesses);

// GET business by UUID
router.get('/uuid/:uuid', getBusinessByUUID);

// GET business by name
router.get('/name/:name', getBusinessByName);

// CREATE business
router.post('/', createBusiness);

// UPDATE business by UUID
router.patch('/uuid/:uuid', updateBusinessByUUID);

// SOFT DELETE business by UUID
router.delete('/soft-delete/uuid/:uuid', softDeleteBusiness);

// REINSTATE business by UUID
router.patch('/reinstate/uuid/:uuid', reinstateBusiness);

// HARD DELETE business by UUID
router.delete('/hard-delete/uuid/:uuid', hardDeleteBusiness);

export default router;
