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

const createCustomer = async (req, res) => {

    const { firstName, lastName, mobile_phone, email, address, customerType, landline_phone } = req.body;

    if(!email){
        return res.status(400).json({ error: 'Customer email are required' });
    } 
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email' });

    if(!address){
        return res.status(400).json({ error: 'Customer address are required' });
    }
    if(!mobile_phone || !landline_phone){
        return res.status(400).json({ error: 'At least one phone number is required, mobile or landline' });
    }
    if(!firstName){
        return res.status(400).json({ error: 'Customer first name is required' });
    }
    try {

        let mobile_phone_number;
        let landline_phone_number;
        if(mobile_phone){
            mobile_phone_number = normalizeNZPhone(mobile_phone);
            const existsPhone = await Customer.findByPhone(mobile_phone_number, null);

            if (existsPhone) return res.status(400).json({ error: 'Mobile phone number already exists' });
        }
        if(landline_phone){
            landline_phone_number = normalizeNZPhone(landline_phone);
            const existsPhone = await Customer.findByPhone(null, landline_phone_number);

            if (existsPhone) return res.status(400).json({ error: 'Landline phone number already exists' });
        }

        const existsEmail = await Customer.findByEmail(email);
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
            last_name: lastName ? lastName : null,
            email,
            address,
            mobile_phone: mobile_phone_number ? mobile_phone_number : null,
            landline_phone: landline_phone_number ? landline_phone_number : null,
            customer_type: customerType || 'individual'
            };
                    
        const newCustomer = await Customer.create(newCustomerData);
        if(!newCustomer){
            return res.status(400).json({ error: 'Customer could not be created' });
        }
        return res.status(201).json(newCustomer);
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
            return res.status(404).json({ error: `Customer not found with UUID ${uuid}` });
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
        const customerFound = await Customer.softDelete(uuid);
        if (!customerFound) {
            return res.status(404).json({ error: `Customer not found with UUID ${uuid}` });
        }
        // const softDeletedCustomer = await Customer.findByUUID(uuid);
        return res.status(200).json(customerFound);
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

const updateCustomerById = async (req, res) => {
    const { id } = req.params;
    const updates = { ...req.body };
    try {
        // Email validation only if email is provided
        if (updates.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(updates.email)) {
                return res.status(400).json({ error: 'Invalid email' });
            }
            // Optionally check if email is already in use
            const existsEmail = await Customer.findByEmail(updates.email);
            if (existsEmail && existsEmail.id !== parseInt(id)) {
                return res.status(400).json({ error: 'Email already exists' });
            }
        }
        // Phone validation/normalization only if phone is provided
        if (updates.phone) {
            updates.phone = normalizeNZPhone(updates.phone);
            const existsPhone = await Customer.findByPhone(updates.phone);
            if (existsPhone && existsPhone.id !== parseInt(id)) {
                return res.status(400).json({ error: 'Phone number already exists' });
            }
        }
        const updated = await Customer.findByIdAndUpdate(id, updates);
        return res.status(200).json(updated);

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

const updateCustomerByUUID = async (req, res) => {
    const { uuid } = req.params;
    let updates = { ...req.body };

    try {
        const foundCustomer = await Customer.findByUUID(uuid);
        
        if (!foundCustomer) {
            return res.status(404).json({ error: `Customer not found with UUID ${uuid}` });
        }
        // let updatedCustomer = { ...foundCustomer, ...updates };
        // Email validation only if email is provided
        if (updates.email && updates.email !== foundCustomer.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(updates.email)) {
                return res.status(400).json({ error: 'Invalid email' });
            }
            // Optionally check if email is already in use
            const existsEmail = await Customer.findByEmail(updates.email);
            if (existsEmail && existsEmail.uuid !== foundCustomer.uuid) {
                return res.status(400).json({ error: 'Email already exists' });
            }
     
            // updates = { ...updates, email: updates.email };
        }
        // Phone validation/normalization only if phone is provided
        // ------------------ MOBILE ------------------
        if (updates.mobile_phone && updates.mobile_phone !== foundCustomer.mobile_phone) {
            updates.mobile_phone = normalizeNZPhone(updates.mobile_phone);

            const existsMobile = await Customer.findByPhone(updates.mobile_phone, null);
            if (existsMobile && existsMobile.uuid !== foundCustomer.uuid) {
                return res.status(400).json({ error: 'Mobile phone already exists' });
            }
        }

        // ------------------ LANDLINE ------------------
        if (updates.landline_phone && updates.landline_phone !== foundCustomer.landline_phone) {
            updates.landline_phone = normalizeNZPhone(updates.landline_phone);

            const existsLandline = await Customer.findByPhone(null, updates.landline_phone);
            if (existsLandline && existsLandline.uuid !== foundCustomer.uuid) {
                return res.status(400).json({ error: 'Landline phone already exists' });
            }
        }

        if(updates.address && foundCustomer.address !== updates.address){
            updates = { ...updates, address: updates.address };
        } 
        
        console.log({updates})
        const updated = await Customer.findByUUIDAndUpdate(uuid, updates);
        return res.status(200).json({message: 'Customer successfully updated', data: updated});
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
    console.log({customer_uuid});
    console.log({business_uuid});
    if (!customer_uuid || !business_uuid) {
        return res.status(400).json({
            error: 'Missing customer_uuid or business_uuid'
        });
    }

    try {

        const customerExistsChecks = await Customer.findByUUID(customer_uuid);
        console.log({customerExistsChecks})
        if (!customerExistsChecks) {
            return res.status(404).json({
                error: `Customer not found with UUID ${customer_uuid}`
            });
        }
         const businessExistsChecks = await Business.findByUUID(business_uuid);
        console.log({businessExistsChecks})
        if (!businessExistsChecks) {
             return res.status(404).json({
                error: `Business not found with UUID ${business_uuid}`
            });
        }

        if (customerExistsChecks.business_uuid === business_uuid) {
            return res.status(200).json({
                message: 'Customer already linked to this business',
                data: customerExistsChecks
            });
        }

        const customer = {
            ...customerExistsChecks,
            business_uuid
        }

        const updatedCustomer = await Customer.findByUUIDAndUpdate( customer_uuid, customer);
        console.log({updatedCustomer})
        if (!updatedCustomer) {
        return res.status(404).json({
            error: `Customer with UUID ${customer_uuid} not found`
            });
        }

        return res.status(200).json({ message: 'Customer linked to business successfully', data: updatedCustomer });
    } catch (error) {
        return res.status(500).json({
        error: `Error linking customer to business: ${error.message}`
    });
    }
};

//works fine 9/01/2025
const getCustomerByPhone = async (req, res) => {
    const { landline_phone, mobile_phone } = req.body || {};

    // Require at least one phone
    if (!mobile_phone && !landline_phone) {
        return res.status(400).json({ error: 'At least one phone number is required' });
    }

    try {
        // Normalize numbers that exist
        const normalizedMobile = mobile_phone ? normalizeNZPhone(mobile_phone) : null;
        const normalizedLandline = landline_phone ? normalizeNZPhone(landline_phone) : null;

        // Search both columns
        const customer = await Customer.findByPhone(normalizedMobile, normalizedLandline);

        if (!customer) {
            return res.status(404).json({ 
                error: `Customer not found with phone ${mobile_phone || landline_phone}` 
            });
        }

        // Determine which column matched
        let matchedType = null;
        if (normalizedMobile && customer.mobile_phone === normalizedMobile) matchedType = 'mobile';
        else if (normalizedLandline && customer.landline_phone === normalizedLandline) matchedType = 'landline';

        return res.status(200).json({ customer, matchedType });
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


// const getAllCustomersWithDetails = async (req, res) => {
//     const page = parseInt(req.query.page) || 1;
//     const pageSize = parseInt(req.query.pageSize) || 20;
//     const from = (page - 1) * pageSize;
//     const to = from + pageSize - 1;

//     try {
//         const { data, error, count } = await supabase
//             .from('customers')
//             .select(`
//                 *,
//                 businesses (*),
//                 quotes (*),
//                 jobs (*),
//                 invoices (*),
//                 payments (*)
//             `, { count: 'exact' })
//             .range(from, to)
//             .order('created_at', { ascending: true });

//         if (error) throw error;

//         return res.status(200).json({
//             page,
//             pageSize,
//             total: count,
//             totalPages: Math.ceil(count / pageSize),
//             data
//         });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// };


// const getAllCustomersWithDetails = async (req, res) => {

//     try {
//         const customers = await Customer.findAllCustomerWithDetails();
//         if (!customers) {
//             return res.status(404).json({ error: 'Customer not found' });
//         }

//         return res.status(200).json(customers);
//     } catch (error) {
//         return res.status(500).json({ error: error.message });
//     }
// }

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