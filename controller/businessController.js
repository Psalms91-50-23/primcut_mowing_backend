import Business from '../models/Business.js';
import Customer from '../models/Customer.js';
import { generateShortId, normalizeNZPhone } from "../util/util.js";

const getAllBusinesses = async (req, res) => {
  try {
    const businesses = await Business.findAll();
    if (!businesses || businesses.length === 0) {
      return res.status(200).json({ message: 'No businesses found', data: [] });
    }
    return res.status(200).json(businesses);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

//works fine 9/01/2026
const getBusinessByUUID = async (req, res) => {
  const { uuid } = req.params;
  if (!uuid) return res.status(400).json({ error: 'Missing business UUID' });
  try {
    const business = await Business.findByUUID(uuid);
    if (!business) return res.status(404).json({ error: 'Business not found' });
    return res.status(200).json(business);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const createBusiness = async (req, res) => {
  const { name, business_mobile_phone, business_landline_phone, email, address, customer_uuid } = req.body;
  console.log(req.body, " creating a business");

  if(!email){
    return res.status(400).json({ error: 'Business email are required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if(!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

  if(!name){
    return res.status(400).json({ error: 'Business name are required' });
  }
  if(!business_mobile_phone){
    return res.status(400).json({ error: 'Business phone are required' });
  }

  // ---- Normalize phones ----
  const mobileNormalizedPhone = business_mobile_phone
    ? normalizeNZPhone(business_mobile_phone)
    : null;

  const landlineNormalizedPhone = business_landline_phone
    ? normalizeNZPhone(business_landline_phone)
    : null;


  if(!address){
    return res.status(400).json({ error: 'Business address are required' });
  }

  let uuid;
  let exists;
  try {

    do {
      uuid = generateShortId(9);
      exists = await Business.findByUUID(uuid);
    } while (exists);

    const newBusinessData = {
      uuid,
      name,
      business_mobile_phone: mobileNormalizedPhone ? mobileNormalizedPhone : null,
      business_landline_phone: landlineNormalizedPhone ? landlineNormalizedPhone : null,
      email,
      address,
      customer_uuid: customer_uuid ? customer_uuid : null
    };

    const newBusiness = await Business.create(newBusinessData);

    if (customer_uuid) {
      const customer = await Customer.findByUUID(customer_uuid);
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      // Update customer with business UUID
      // await Customer.findByUUIDAndUpdate(customer_uuid, { business_uuid: uuid });
    }

    return res.status(201).json(newBusiness);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const updateBusinessByUUID = async (req, res) => {
  const { uuid } = req.params;
  let updates = {...req.body};

  if (!uuid) return res.status(400).json({ error: 'Missing business UUID' });

  try {

    const foundBusiness = await Business.findByUUID(uuid);
    if (!foundBusiness) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if(updates.email && updates.email !== foundBusiness.email){
      const emailExists = await Business.findeByEmail(updates.email);
      if(emailExists) return res.status(400).json({ error: 'Email already exists' });
    }

    if(updates.business_landline_phone && updates.business_landline_phone !== foundBusiness.business_landline_phone){

      updates.business_landline_phone = normalizeNZPhone(updates.business_landline_phone);

       const existsLandline = await Customer.findByPhone(null, updates.business_landline_phone);
        if (existsLandline && existsLandline.uuid !== foundBusiness.uuid) {
            return res.status(400).json({ error: 'Landline phone already exists' });
        }

    } 

    if(updates.business_mobile_phone && updates.business_mobile_phone !== foundBusiness.business_mobile_phone){
      updates.business_mobile_phone = normalizeNZPhone(updates.business_mobile_phone);

       const existsMobile = await Customer.findByPhone(updates.business_mobile_phone, null);
        if (existsMobile && existsMobile.uuid !== foundBusiness.uuid) { 
            return res.status(400).json({ error: 'Mobile phone already exists' });
        }

    } 

    const updated = await Business.findByUUIDAndUpdate(uuid, updates);
    return res.status(200).json({...updated});
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const softDeleteBusiness = async (req, res) => {
  const { uuid } = req.params;
  try {
    const deleted = await Business.softDelete(uuid);
    if (!deleted) return res.status(404).json({ error: 'Business not found' });
    return res.status(200).json(deleted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const reinstateBusiness = async (req, res) => {
  const { uuid } = req.params;
  try {
    const reinstated = await Business.reinstate(uuid);
    if (!reinstated) return res.status(404).json({ error: 'Business not found' });
    return res.status(200).json(reinstated);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const hardDeleteBusiness = async (req, res) => {
  const { uuid } = req.params;
  try {
    const foundBusiness = await Business.findByUUID(uuid);
    if (!foundBusiness) {
      return res.status(404).json({ error: 'Business not found' });
    }
   const deleted = await Business.delete(uuid);
   console.log({deleted})
    if (!deleted) {
      return res.status(500).json({ error: 'Failed to delete business' });
    }
    return res.status(200).json({ message: 'Business deleted successfully', data: deleted });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getBusinessByName = async (req, res) => {
  const { name } = req.params;
  if (!name) return res.status(400).json({ error: 'Missing business name' });

  try {
    const business = await Business.findByName(name);
    if (!business) return res.status(404).json({ error: `Business not found with name "${name}"` });
    return res.status(200).json(business);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getBusinessByEmail = async (req, res) => {
    const { email } = req.params;
    if (!email) {
        return res.status(400).json({ error: 'Missing business email' });
    }
    try {
        const business = await Business.findeByEmail(email);
        if (!business || business.length === 0) {
            return res.status(404).json({ error: `Business not found with email ${email}` });
        }
        return res.status(200).json(business);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}


export {
  getAllBusinesses,
  getBusinessByUUID,
  createBusiness,
  updateBusinessByUUID,
  softDeleteBusiness,
  reinstateBusiness,
  hardDeleteBusiness,
  getBusinessByName,
  getBusinessByEmail
};
