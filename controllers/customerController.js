import Customer from "../models/Customer.js";
import Business from "../models/Business.js";
import { generateShortId, normalizeNZPhone } from "../util/util.js";

//works fine 9/01/2025
const getAllCustomers = async (req, res) => {
  try {
    const includeBusiness = req.query.include === 'business';

    let isDeleted;
    if (req.query.isDeleted === 'true') isDeleted = true;
    else if (req.query.isDeleted === 'false') isDeleted = false;
    else isDeleted = undefined; // "all"

    const customers = await Customer.findAll({
      includeBusiness,
      isDeleted
    });

    return res.status(200).json(customers);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// works fine 12/01/2025
const createCustomer = async (req, res) => {

    const { firstName, lastName, mobilePhone, email, address, customerType, landlinePhone } = req.body;

    if (!email) return res.status(400).json({ error: 'Customer email is required' });
    if (!firstName) return res.status(400).json({ error: 'Customer first name is required' });
    if (!address) return res.status(400).json({ error: 'Customer address is required' });
    if (!mobilePhone && !landlinePhone) return res.status(400).json({ error: 'At least one phone number is required' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email' });

    try {

        const mobilePhoneNumber = mobilePhone ? normalizeNZPhone(mobilePhone) : null;
        const landlinePhoneNumber = landlinePhone ? normalizeNZPhone(landlinePhone) : null;

        const [existsMobile, existsLandline, existsEmail] = await Promise.all([
            mobilePhoneNumber ? Customer.findByPhone(mobilePhoneNumber, null) : null,
            landlinePhoneNumber ? Customer.findByPhone(null, landlinePhoneNumber) : null,
            Customer.findByEmail(email)
        ]);

        if (existsMobile) return res.status(400).json({ error: 'Mobile phone number already exists' });
        if (existsLandline) return res.status(400).json({ error: 'Landline phone number already exists' });
        if (existsEmail) return res.status(400).json({ error: 'Email already exists' });

        const validTypes = ['individual', 'business'];
        if (customerType && !validTypes.includes(customerType)) {
            return res.status(400).json({ error: 'Invalid customer type' });
        }

        let uuid;
        let exists;
        do {
            uuid = generateShortId(9);
            exists = await Customer.findByUUID(uuid);
        } while (exists);

        const newCustomerData = {
            uuid,
            first_name: firstName,
            last_name: lastName ??  null,
            email,
            address,
            mobile_phone: mobilePhoneNumber ?? null,
            landline_phone: landlinePhoneNumber ?? null,
            customer_type: customerType || 'individual'
            };
                    
        const newCustomer = await Customer.create(newCustomerData);
        if(!newCustomer){
            return res.status(400).json({ error: 'Customer could not be created' });
        }
        return res.status(201).json({
            message: 'Customer created successfully',
            data: newCustomer
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

const getCustomerById = async (req, res) => {
    const { id } = req.params;
    if(!id){
        return res.status(400).json({ error: 'Missing customer ID' });
    }
    try {
        const customer = await Customer.findById(id);
        if (!customer) {
            return res.status(404).json({ error: `Customer not found with id ${id}` });
        }

        return res.status(200).json(customer);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

const getCustomerByUUID = async (req, res) => {
    const { uuid } = req.params;
    if(!uuid){
        return res.status(400).json({ error: 'Missing customer UUID' });
    }
    try {
        const customer = await Customer.findByUUID(uuid);
        console.log({customer});
        if (!customer) {
            return res.status(404).json({ error: `Customer not found with uuid ${uuid}` });
        }
        return res.status(200).json(customer);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

const getCustomerByEmail = async (req, res) => {
    const { email } = req.params;
    if(!email){
        return res.status(400).json({ error: 'Missing customer email' });
    }

    try {
        const customer = await Customer.findByEmail(email);
        if (!customer) {
            return res.status(404).json({ error: `Customer not found with email ${email}` });
        }
        return res.status(200).json(customer);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

const getCustomerByAddress = async (req, res) => {
    const { address } = req.params;
    if(!address){
        return res.status(400).json({ error: 'Missing customer address' });
    }

    try {
        const customer = await Customer.findByAddress(address);
        if (!customer) {
            return res.status(404).json({ error: `Customer not found with address ${address}` });
        }
        return res.status(200).json(customer);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}   

const hardDeleteCustomer = async (req, res) => {
    const { uuid } = req.params;
    if(!uuid){
        return res.status(400).json({ error: 'Missing customer UUID' });
    }
    console.log({uuid})
    try {
        const tempDeletedCustomerHolder = await Customer.findByUUID(uuid);
        console.log({tempDeletedCustomerHolder})
        if (!tempDeletedCustomerHolder) {
            return res.status(404).json({ error: `Customer not found with UUID ${uuid}` });
        }
        const deleted = await Customer.delete(uuid);
        console.log({deleted})
        if (!deleted) {
            return res.status(404).json({ error: `Customer not deleted failed with UUID: ${uuid}` });
        }
        return res.status(200).json({ message: 'Customer successfully deleted', data: deleted });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

//works fine 9/01/2025
const softDeleteCustomer = async (req, res) => {
    const { uuid } = req.params;
    try {
        const softDeletedCustomer  = await Customer.softDelete(uuid);
        if (!softDeletedCustomer ) {
            return res.status(404).json({ error: `Customer not found with UUID ${uuid}` });
        }
        // const softDeletedCustomer = await Customer.findByUUID(uuid);
        return res.status(200).json({
            message: 'Customer soft-deleted successfully',
            data: softDeletedCustomer
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

const reinstateCustomer = async (req, res) => {
    const { uuid } = req.params;
    try {
        const reinstated = await Customer.reinstateCustomer(uuid);
        if (!reinstated) {
            return res.status(404).json({ error: `Customer not found with UUID ${uuid}` });
        }
        return res.status(200).json(reinstated);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

//have to test this 14/01/2025
const updateCustomerById = async (req, res) => {
    const { id } = req.params;
    const updates = {};
    console.log(req.body)

  try {
    const foundCustomer = await Customer.findById(id);
    if (!foundCustomer) {
      return res.status(404).json({ error: `Customer not found with UUID ${uuid}` });
    }

    // ---------- WHITELIST & MAPPING ----------
    if ('firstName' in req.body) updates.first_name = req.body.firstName;
    if ('lastName' in req.body) updates.last_name = req.body.lastName;
    if ('email' in req.body) updates.email = req.body.email;
    if ('mobilePhone' in req.body) updates.mobile_phone = req.body.mobilePhone;
    if ('landlinePhone' in req.body) updates.landline_phone = req.body.landlinePhone;
    if ('address' in req.body) updates.address = req.body.address;

    // ---------- EMAIL VALIDATION ----------
    if ('email' in updates && updates.email !== foundCustomer.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        return res.status(400).json({ error: 'Invalid email' });
      }

      const existsEmail = await Customer.findByEmail(updates.email);
      if (existsEmail && existsEmail.uuid !== foundCustomer.uuid) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // ---------- MOBILE PHONE ----------
    if ('mobile_phone' in updates && updates.mobile_phone !== foundCustomer.mobile_phone) {
      updates.mobile_phone = normalizeNZPhone(updates.mobile_phone);

      const existsMobile = await Customer.findByPhone(updates.mobile_phone, null);
      if (existsMobile && existsMobile.uuid !== foundCustomer.uuid) {
        return res.status(400).json({ error: 'Mobile phone already exists' });
      }
    }

    // ---------- LANDLINE PHONE ----------
    if ('landline_phone' in updates && updates.landline_phone !== foundCustomer.landline_phone) {
      updates.landline_phone = normalizeNZPhone(updates.landline_phone);

      const existsLandline = await Customer.findByPhone(null, updates.landline_phone);
      if (existsLandline && existsLandline.uuid !== foundCustomer.uuid) {
        return res.status(400).json({ error: 'Landline phone already exists' });
      }
    }

    // ---------- ADDRESS ----------
    if ('address' in updates && updates.address === foundCustomer.address) {
      // no change, remove to avoid unnecessary DB update
      delete updates.address;
    }

    // ---------- EMPTY UPDATE GUARD ----------
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.updated_at = new Date().toISOString();
    // ---------- UPDATE ----------
    const updated = await Customer.findByIdAndUpdate(id, updates);

    return res.status(200).json({
      message: 'Customer successfully updated',
      data: updated
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const updateCustomerByUUID = async (req, res) => {
  const { uuid } = req.params;
  const updates = {};
  console.log(req.body)

  try {
    const foundCustomer = await Customer.findByUUID(uuid);
    if (!foundCustomer) {
      return res.status(404).json({ error: `Customer not found with UUID ${uuid}` });
    }

    // ---------- WHITELIST & MAPPING ----------
    if ('firstName' in req.body) updates.first_name = req.body.firstName;
    if ('lastName' in req.body) updates.last_name = req.body.lastName;
    if ('email' in req.body) updates.email = req.body.email;
    if ('mobilePhone' in req.body) updates.mobile_phone = req.body.mobilePhone;
    if ('landlinePhone' in req.body) updates.landline_phone = req.body.landlinePhone;
    if ('address' in req.body) updates.address = req.body.address;

    // ---------- EMAIL VALIDATION ----------
    if ('email' in updates && updates.email !== foundCustomer.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        return res.status(400).json({ error: 'Invalid email' });
      }

      const existsEmail = await Customer.findByEmail(updates.email);
      if (existsEmail && existsEmail.uuid !== foundCustomer.uuid) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // ---------- MOBILE PHONE ----------
    if ('mobile_phone' in updates && updates.mobile_phone !== foundCustomer.mobile_phone) {
      updates.mobile_phone = normalizeNZPhone(updates.mobile_phone);

      const existsMobile = await Customer.findByPhone(updates.mobile_phone, null);
      if (existsMobile && existsMobile.uuid !== foundCustomer.uuid) {
        return res.status(400).json({ error: 'Mobile phone already exists' });
      }
    }

    // ---------- LANDLINE PHONE ----------
    if ('landline_phone' in updates && updates.landline_phone !== foundCustomer.landline_phone) {
      updates.landline_phone = normalizeNZPhone(updates.landline_phone);

      const existsLandline = await Customer.findByPhone(null, updates.landline_phone);
      if (existsLandline && existsLandline.uuid !== foundCustomer.uuid) {
        return res.status(400).json({ error: 'Landline phone already exists' });
      }
    }

    // ---------- ADDRESS ----------
    if ('address' in updates && updates.address === foundCustomer.address) {
      // no change, remove to avoid unnecessary DB update
      delete updates.address;
    }

    // ---------- EMPTY UPDATE GUARD ----------
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.updated_at = new Date().toISOString();
    // ---------- UPDATE ----------
    const updated = await Customer.findByUUIDAndUpdate(uuid, updates);

    return res.status(200).json({
      message: 'Customer successfully updated',
      data: updated
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getCustomersByBusinessUUID = async (req, res) => {
    const { business_uuid } = req.params;
    if(!business_uuid){
        return res.status(400).json({ error: 'Missing business UUID' });
    }
    try {
        const customer = await Customer.findByBusinessUUID(business_uuid);
        if (!customer) {
            return res.status(404).json({ error: `Business not found with business uuid ${business_uuid}` });
        }
        return res.status(200).json(customer);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

const linkCustomerToBusiness = async (req, res) => {
    const { customer_uuid } = req.params;
    const { business_uuid } = req.body;

    if (!customer_uuid) {
        return res.status(400).json({
            error: 'Missing customer_uuid'
        });
    }

    if (!business_uuid) {
        return res.status(400).json({
            error: 'Missing business_uuid'
        });
    }

    try {

        const customer  = await Customer.findByUUID(customer_uuid);
        console.log({customer});
        if (!customer) {
            return res.status(404).json({
                error: `Customer not found with UUID ${customer_uuid}`
            });
        }
         const business = await Business.findByUUID(business_uuid);

        if (!business) {
             return res.status(404).json({
                error: `Business not found with UUID ${business_uuid}`
            });
        }

        if (business.customer_uuid === customer_uuid) {
            return res.status(200).json({
                message: 'Customer already linked to this business',
                customer: customer,
                business: business
            });
        }

        const updatedBusiness = await Business.findByUUIDAndUpdate( business_uuid, { customer_uuid: customer_uuid });

        const updatedCustomer = await Customer.findByUUIDAndUpdate( customer_uuid, { customer_type: 'business' });

        return res.status(200).json({ message: 'Customer linked to business successfully', customer: updatedCustomer, business: updatedBusiness });
    } catch (error) {
        return res.status(500).json({
        error: `Error linking customer to business: ${error.message}`
    });
    }
};

//works fine 9/01/2025
const getCustomerByPhone = async (req, res) => {
    const { landlinePhone, mobilePhone } = req.body || {};

    // Require at least one phone
    if (!mobilePhone && !landlinePhone) {
        return res.status(400).json({ error: 'At least one phone number is required' });
    }

    try {
        // Normalize numbers that exist
        const normalizedMobile = mobilePhone ? normalizeNZPhone(mobilePhone.trim()) : null;
        const normalizedLandline = landlinePhone ? normalizeNZPhone(landlinePhone.trim()) : null;

        const result = await Customer.findByPhone(normalizedMobile, normalizedLandline);

        if (!result) {
            return res.status(404).json({
                error: `Customer not found with phone ${mobilePhone || landlinePhone}`
            });
        }

        const { data, matchedType } = result;
        // const customer = {
        //     uuid: data.uuid,
        //     firstName: data.first_name,
        //     lastName: data.last_name,
        //     email: data.email,
        //     address: data.address,
        //     mobilePhone: data.mobile_phone,
        //     landlinePhone: data.landline_phone,
        //     customerType: data.customer_type,
        //     isDeleted: data.is_deleted,
        //     createdAt: data.created_at,
        //     updatedAt: data.updated_at,
        //     deletedAt: data.deleted_at
        // };

        // if (!customer) {
        //     return res.status(404).json({ 
        //         error: `Customer not found with phone ${mobilePhone || landlinePhone}` 
        //     });
        // }

        return res.status(200).json({ data, matchedType });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

const getOneCustomersWithDetails = async (req, res) => {

    const { uuid } = req.params;
    if(!uuid){
        return res.status(400).json({ error: 'Missing customer UUID' });
    }
    try {
        const customer = await Customer.findOneCustomerWithDetails(uuid);
        if(!customer) {    
            return res.status(404).json({ error: 'Customer not found' });
        }
        return res.status(200).json(customer);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

//works fine 13/01/2025
const getAllCustomersWithDetails = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;

    try {
        const { data, count } = await Customer.findAllWithDetails({ page, pageSize });

        return res.status(200).json({
            page,
            pageSize,
            total: count,
            totalPages: Math.ceil(count / pageSize),
            data
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export  { 
    getAllCustomers,
    createCustomer,
    getCustomerByUUID,
    getCustomerById,
    getCustomerByEmail,
    hardDeleteCustomer,
    softDeleteCustomer,
    reinstateCustomer,
    updateCustomerById,
    updateCustomerByUUID,
    getCustomerByAddress,
    getCustomersByBusinessUUID,
    linkCustomerToBusiness,
    getCustomerByPhone,
    getOneCustomersWithDetails,
    getAllCustomersWithDetails

 }