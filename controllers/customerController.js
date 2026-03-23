import Customer from "../models/Customer.js";
import Business from "../models/Business.js";
import { createChangeLogSafe }  from "../util/createChangeLogSafe.js";
import { normalizeNZPhone, generatePrefixedId } from "../util/util.js";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[a-zA-Z0-9]{9}$/;

function validateUUID(uuid) {
  const id = String(uuid || "").trim();

  if (!id) throw new Error("Customer UUID is required");
  if (!UUID_REGEX.test(id)) throw new Error("UUID must be exactly 9 letters or numbers");

  return id;
}

/**
 * GET /api/customers/:uuid/summary
 */
const getCustomerSummaryByUUID = async (req, res) => {
  try {
    const uuid = validateUUID(req.params.uuid);

    const customer = await Customer.findSummaryByUUID(uuid);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    return res.status(200).json({ customer });
  } catch (err) {
    console.error("getCustomerSummaryByUUID error:", err);
    return res.status(400).json({ error: err.message || "Failed to fetch customer summary" });
  }
};

/**
 * GET /api/customers/:uuid
 */
 const getCustomerDetailedByUUID = async (req, res) => {
  try {
    const uuid = validateUUID(req.params.uuid);

    const customer = await Customer.findDetailedByUUID(uuid);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    return res.status(200).json({ customer });
  } catch (err) {
    console.error("error:", err);
    return res.status(400).json({ error: err.message || "Failed to fetch customer" });
  }
};

// works fine 9/01/2025
const getAllCustomers = async (req, res) => {
  try {
    const includeBusiness = req.query.include === "business";

    let isDeleted;
    if (req.query.isDeleted === "true") isDeleted = true;
    else if (req.query.isDeleted === "false") isDeleted = false;
    else isDeleted = undefined;

    const customers = await Customer.findAll({
      includeBusiness,
      isDeleted,
    });

    return res.status(200).json(customers);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// works fine 12/01/2025
const createCustomer = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;
  const { firstName, lastName, mobilePhone, email, address, customerType, landlinePhone } = req.body;

  if (!email) return res.status(400).json({ error: "Customer email is required" });
  if (!firstName) return res.status(400).json({ error: "Customer first name is required" });
  if (!address) return res.status(400).json({ error: "Customer address is required" });
  if (!mobilePhone && !landlinePhone) {
    return res.status(400).json({ error: "At least one phone number is required" });
  }

  if (!emailRegex.test(email)) return res.status(400).json({ error: "Invalid email" });

  try {
    const mobilePhoneNumber = mobilePhone ? normalizeNZPhone(mobilePhone) : null;
    const landlinePhoneNumber = landlinePhone ? normalizeNZPhone(landlinePhone) : null;

    const [existsMobile, existsLandline, existsEmail] = await Promise.all([
      mobilePhoneNumber ? Customer.findByPhone(mobilePhoneNumber, null) : null,
      landlinePhoneNumber ? Customer.findByPhone(null, landlinePhoneNumber) : null,
      Customer.findByEmail(email),
    ]);

    if (existsMobile) return res.status(400).json({ error: "Mobile phone number already exists" });
    if (existsLandline) return res.status(400).json({ error: "Landline phone number already exists" });
    if (existsEmail) return res.status(400).json({ error: "Email already exists" });

    const validTypes = ["individual", "business"];
    if (customerType && !validTypes.includes(customerType)) {
      return res.status(400).json({ error: "Invalid customer type" });
    }

    let uuid;
    let exists;
    do {
      uuid = generatePrefixedId("C", 7);
      exists = await Customer.findByUUID(uuid);
    } while (exists);

    const newCustomerData = {
      uuid,
      first_name: firstName,
      last_name: lastName ?? null,
      email,
      address,
      mobile_phone: mobilePhoneNumber ?? null,
      landline_phone: landlinePhoneNumber ?? null,
      customer_type: customerType || "individual",
    };

    const newCustomer = await Customer.create(newCustomerData);
    if (!newCustomer) {
      return res.status(400).json({ error: "Customer could not be created" });
    }

    await createChangeLogSafe({
      table_name: "customers",
      record_uuid: newCustomer.uuid,
      user_uuid: actorUserUuid,
      action: "create",
      summary: "Customer created.",
      changed_fields: {
        uuid: newCustomer.uuid,
        first_name: newCustomer.first_name,
        last_name: newCustomer.last_name,
        email: newCustomer.email,
        address: newCustomer.address,
        mobile_phone: newCustomer.mobile_phone,
        landline_phone: newCustomer.landline_phone,
        customer_type: newCustomer.customer_type,
      },
      source: "dashboard",
    });

    return res.status(201).json({
      message: "Customer created successfully",
      data: newCustomer,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getCustomerById = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Missing customer ID" });
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
};

const getCustomerByUUID = async (req, res) => {
  const { uuid } = req.params;
  console.log({ uuid }, " get cust by uuid");

  if (!uuid) {
    return res.status(400).json({ error: "Missing customer UUID" });
  }

  try {
    const customer = await Customer.findByUUID(uuid);
    console.log({ customer });

    if (!customer) {
      return res.status(404).json({ error: `Customer not found with uuid ${uuid}` });
    }

    return res.status(200).json(customer);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getCustomerByEmail = async (req, res) => {
  const { email } = req.params;
  if (!email) {
    return res.status(400).json({ error: "Missing customer email" });
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
};

const getCustomerByAddress = async (req, res) => {
  const { address } = req.params;
  if (!address) {
    return res.status(400).json({ error: "Missing customer address" });
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
};

const hardDeleteCustomer = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;
  const { uuid } = req.params;

  if (!uuid) {
    return res.status(400).json({ error: "Missing customer UUID" });
  }

  console.log({ uuid });

  try {
    const tempDeletedCustomerHolder = await Customer.findByUUID(uuid);
    console.log({ tempDeletedCustomerHolder });

    if (!tempDeletedCustomerHolder) {
      return res.status(404).json({ error: `Customer not found with UUID ${uuid}` });
    }

    const deleted = await Customer.delete(uuid);
    console.log({ deleted });

    if (!deleted) {
      return res.status(404).json({ error: `Customer not deleted failed with UUID: ${uuid}` });
    }

    await createChangeLogSafe({
      table_name: "customers",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "delete",
      summary: "Customer hard deleted.",
      changed_fields: {
        deleted_record: {
          uuid: tempDeletedCustomerHolder.uuid,
          first_name: tempDeletedCustomerHolder.first_name,
          last_name: tempDeletedCustomerHolder.last_name,
          email: tempDeletedCustomerHolder.email,
          address: tempDeletedCustomerHolder.address,
          mobile_phone: tempDeletedCustomerHolder.mobile_phone,
          landline_phone: tempDeletedCustomerHolder.landline_phone,
          customer_type: tempDeletedCustomerHolder.customer_type,
        },
      },
      source: "dashboard",
    });

    return res.status(200).json({ message: "Customer successfully deleted", data: deleted });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// works fine 9/01/2025
const softDeleteCustomer = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;
  const { uuid } = req.params;

  try {
    const existingCustomer = await Customer.findByUUID(uuid);
    if (!existingCustomer) {
      return res.status(404).json({ error: `Customer not found with UUID ${uuid}` });
    }

    const softDeletedCustomer = await Customer.softDelete(uuid);
    if (!softDeletedCustomer) {
      return res.status(404).json({ error: `Customer not found with UUID ${uuid}` });
    }

    await createChangeLogSafe({
      table_name: "customers",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "delete",
      summary: "Customer soft deleted.",
      changed_fields: {
        is_deleted: {
          old: existingCustomer.is_deleted ?? false,
          new: softDeletedCustomer.is_deleted ?? true,
        },
        deleted_at: {
          old: existingCustomer.deleted_at ?? null,
          new: softDeletedCustomer.deleted_at ?? new Date().toISOString(),
        },
      },
      source: "dashboard",
    });

    return res.status(200).json({
      message: "Customer soft-deleted successfully",
      data: softDeletedCustomer,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const reinstateCustomer = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;
  const { uuid } = req.params;

  try {
    const existingCustomer = await Customer.findByUUID(uuid);
    if (!existingCustomer) {
      return res.status(404).json({ error: `Customer not found with UUID ${uuid}` });
    }

    const reinstated = await Customer.reinstateCustomer(uuid);
    if (!reinstated) {
      return res.status(404).json({ error: `Customer not found with UUID ${uuid}` });
    }

    await createChangeLogSafe({
      table_name: "customers",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "Customer reinstated.",
      changed_fields: {
        is_deleted: {
          old: existingCustomer.is_deleted ?? true,
          new: reinstated.is_deleted ?? false,
        },
        deleted_at: {
          old: existingCustomer.deleted_at ?? null,
          new: reinstated.deleted_at ?? null,
        },
      },
      source: "dashboard",
    });

    return res.status(200).json(reinstated);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// have to test this 14/01/2025
const updateCustomerById = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;
  const { id } = req.params;
  const updates = {};
  console.log(req.body);

  try {
    const foundCustomer = await Customer.findById(id);
    if (!foundCustomer) {
      return res.status(404).json({ error: `Customer not found with ID ${id}` });
    }

    if ("firstName" in req.body) updates.first_name = req.body.firstName;
    if ("lastName" in req.body) updates.last_name = req.body.lastName;
    if ("email" in req.body) updates.email = req.body.email;
    if ("mobilePhone" in req.body) updates.mobile_phone = req.body.mobilePhone;
    if ("landlinePhone" in req.body) updates.landline_phone = req.body.landlinePhone;
    if ("address" in req.body) updates.address = req.body.address;

    if ("email" in updates && updates.email !== foundCustomer.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        return res.status(400).json({ error: "Invalid email" });
      }

      const existsEmail = await Customer.findByEmail(updates.email);
      if (existsEmail && existsEmail.uuid !== foundCustomer.uuid) {
        return res.status(400).json({ error: "Email already exists" });
      }
    }

    if ("mobile_phone" in updates && updates.mobile_phone !== foundCustomer.mobile_phone) {
      updates.mobile_phone = normalizeNZPhone(updates.mobile_phone);

      const existsMobile = await Customer.findByPhone(updates.mobile_phone, null);
      if (existsMobile && existsMobile.uuid !== foundCustomer.uuid) {
        return res.status(400).json({ error: "Mobile phone already exists" });
      }
    }

    if ("landline_phone" in updates && updates.landline_phone !== foundCustomer.landline_phone) {
      updates.landline_phone = normalizeNZPhone(updates.landline_phone);

      const existsLandline = await Customer.findByPhone(null, updates.landline_phone);
      if (existsLandline && existsLandline.uuid !== foundCustomer.uuid) {
        return res.status(400).json({ error: "Landline phone already exists" });
      }
    }

    if ("address" in updates && updates.address === foundCustomer.address) {
      delete updates.address;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    updates.updated_at = new Date().toISOString();

    const updated = await Customer.findByIdAndUpdate(id, updates);

    const changedFields = {};
    for (const key of Object.keys(updates)) {
      if (key === "updated_at") continue;

      changedFields[key] = {
        old: foundCustomer[key] ?? null,
        new: updated[key] ?? updates[key] ?? null,
      };
    }

    if (Object.keys(changedFields).length > 0) {
      await createChangeLogSafe({
        table_name: "customers",
        record_uuid: updated.uuid,
        user_uuid: actorUserUuid,
        action: "update",
        summary: "Customer updated by ID.",
        changed_fields: changedFields,
        source: "dashboard",
      });
    }

    return res.status(200).json({
      message: "Customer successfully updated",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const updateCustomerByUUID = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;
  const { uuid } = req.params;
  const updates = {};
  console.log(req.body);

  try {
    const foundCustomer = await Customer.findByUUID(uuid);
    if (!foundCustomer) {
      return res.status(404).json({ error: `Customer not found with UUID ${uuid}` });
    }

    if ("firstName" in req.body) updates.first_name = req.body.firstName;
    if ("lastName" in req.body) updates.last_name = req.body.lastName;
    if ("email" in req.body) updates.email = req.body.email;
    if ("mobilePhone" in req.body) updates.mobile_phone = req.body.mobilePhone;
    if ("landlinePhone" in req.body) updates.landline_phone = req.body.landlinePhone;
    if ("address" in req.body) updates.address = req.body.address;

    if ("email" in updates && updates.email !== foundCustomer.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        return res.status(400).json({ error: "Invalid email" });
      }

      const existsEmail = await Customer.findByEmail(updates.email);
      if (existsEmail && existsEmail.uuid !== foundCustomer.uuid) {
        return res.status(400).json({ error: "Email already exists" });
      }
    }

    if ("mobile_phone" in updates && updates.mobile_phone !== foundCustomer.mobile_phone) {
      updates.mobile_phone = normalizeNZPhone(updates.mobile_phone);

      const existsMobile = await Customer.findByPhone(updates.mobile_phone, null);
      if (existsMobile && existsMobile.uuid !== foundCustomer.uuid) {
        return res.status(400).json({ error: "Mobile phone already exists" });
      }
    }

    if ("landline_phone" in updates && updates.landline_phone !== foundCustomer.landline_phone) {
      updates.landline_phone = normalizeNZPhone(updates.landline_phone);

      const existsLandline = await Customer.findByPhone(null, updates.landline_phone);
      if (existsLandline && existsLandline.uuid !== foundCustomer.uuid) {
        return res.status(400).json({ error: "Landline phone already exists" });
      }
    }

    if ("address" in updates && updates.address === foundCustomer.address) {
      delete updates.address;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    updates.updated_at = new Date().toISOString();

    const updated = await Customer.findByUUIDAndUpdate(uuid, updates);

    const changedFields = {};
    for (const key of Object.keys(updates)) {
      if (key === "updated_at") continue;

      changedFields[key] = {
        old: foundCustomer[key] ?? null,
        new: updated[key] ?? updates[key] ?? null,
      };
    }

    if (Object.keys(changedFields).length > 0) {
      await createChangeLogSafe({
        table_name: "customers",
        record_uuid: uuid,
        user_uuid: actorUserUuid,
        action: "update",
        summary: "Customer updated by UUID.",
        changed_fields: changedFields,
        source: "dashboard",
      });
    }

    return res.status(200).json({
      message: "Customer successfully updated",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getCustomersByBusinessUUID = async (req, res) => {
  const { business_uuid } = req.params;
  if (!business_uuid) {
    return res.status(400).json({ error: "Missing business UUID" });
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
};

const linkCustomerToBusiness = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;
  const { customer_uuid } = req.params;
  const { business_uuid } = req.body;

  if (!customer_uuid) {
    return res.status(400).json({
      error: "Missing customer_uuid",
    });
  }

  if (!business_uuid) {
    return res.status(400).json({
      error: "Missing business_uuid",
    });
  }

  try {
    const customer = await Customer.findByUUID(customer_uuid);
    console.log({ customer });

    if (!customer) {
      return res.status(404).json({
        error: `Customer not found with UUID ${customer_uuid}`,
      });
    }

    const business = await Business.findByUUID(business_uuid);
    if (!business) {
      return res.status(404).json({
        error: `Business not found with UUID ${business_uuid}`,
      });
    }

    if (business.customer_uuid === customer_uuid) {
      return res.status(200).json({
        message: "Customer already linked to this business",
        customer: customer,
        business: business,
      });
    }

    const updatedBusiness = await Business.findByUUIDAndUpdate(business_uuid, {
      customer_uuid: customer_uuid,
    });

    const updatedCustomer = await Customer.findByUUIDAndUpdate(customer_uuid, {
      customer_type: "business",
    });

    await createChangeLogSafe({
      table_name: "businesses",
      record_uuid: business_uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "Business linked to customer.",
      changed_fields: {
        customer_uuid: {
          old: business.customer_uuid ?? null,
          new: customer_uuid,
        },
      },
      source: "dashboard",
    });

    await createChangeLogSafe({
      table_name: "customers",
      record_uuid: customer_uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "Customer linked to business and marked as business customer.",
      changed_fields: {
        customer_type: {
          old: customer.customer_type ?? null,
          new: updatedCustomer.customer_type ?? "business",
        },
        linked_business_uuid: business_uuid,
      },
      source: "dashboard",
    });

    return res.status(200).json({
      message: "Customer linked to business successfully",
      customer: updatedCustomer,
      business: updatedBusiness,
    });
  } catch (error) {
    return res.status(500).json({
      error: `Error linking customer to business: ${error.message}`,
    });
  }
};

// works fine 9/01/2025
const getCustomerByPhone = async (req, res) => {
  const { landlinePhone, mobilePhone } = req.body || {};

  if (!mobilePhone && !landlinePhone) {
    return res.status(400).json({ error: "At least one phone number is required" });
  }

  try {
    const normalizedMobile = mobilePhone ? normalizeNZPhone(mobilePhone.trim()) : null;
    const normalizedLandline = landlinePhone ? normalizeNZPhone(landlinePhone.trim()) : null;

    const result = await Customer.findByPhone(normalizedMobile, normalizedLandline);

    if (!result) {
      return res.status(404).json({
        error: `Customer not found with phone ${mobilePhone || landlinePhone}`,
      });
    }

    const { data, matchedType } = result;

    return res.status(200).json({ data, matchedType });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getOneCustomersWithDetails = async (req, res) => {
  const { uuid } = req.params;
  if (!uuid) {
    return res.status(400).json({ error: "Missing customer UUID" });
  }

  try {
    const customer = await Customer.findOneCustomerWithDetails(uuid);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    return res.status(200).json(customer);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getMyCustomer = async (req, res) => {
  try {
    const authUser = req.user;
    
    if (!authUser?.uuid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    if (authUser.customer_uuid) {
      return res.status(404).json({ error: "Customer not found" });
    }
  
    const customer = await Customer.findByUUID(authUser.customer_uuid);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    return res.status(200).json({ customer });
  } catch (err) {
    console.error("getMyCustomer error:", err);
    return res.status(500).json({ error: "Failed to fetch customer" });
  }
};

// works fine 13/01/2025
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
      data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getCustomerQuotes = async (req, res) => {
  const { uuid } = req.params;
  if (!uuid) {
    return res.status(400).json({ error: "Missing customer UUID" });
  }

  try {
    const quotes = await Customer.findQuotesByCustomerUUID(uuid);
    if (!quotes) {
      return res.status(404).json({ error: "Customer or quotes not found" });
    }
    return res.status(200).json(quotes);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

}

const getCustomerJobsAndRecurrences = async (req, res) => {
  const { uuid } = req.params;
  if (!uuid) {
    return res.status(400).json({ error: "Missing customer UUID" });
  }

  try {
    const jobs = await Customer.findJobsByCustomerUUID(uuid);
    if (!jobs) {
      return res.status(404).json({ error: "Customer or jobs not found" });
    }
    return res.status(200).json(jobs);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

}

const getCustomerContacts = async (req, res) => {
  const { uuid } = req.params;
  if (!uuid) {
    return res.status(400).json({ error: "Missing customer UUID" });
  }

  try {
    const contacts = await Customer.findContactsByCustomerUUID(uuid);
    if (!contacts) {
      return res.status(404).json({ error: "Customer or contacts not found" });
    }
    return res.status(200).json(contacts);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

}

const getCustomerFullProfileByUUID = async (req, res) => {
  try {
    const { uuid } = req.params;

    if (!uuid) {
      return res.status(400).json({ error: "Customer UUID is required" });
    }

    const customer = await Customer.findFullProfileByUUID(uuid);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    return res.status(200).json({
      message: "Customer profile fetched successfully",
      data: customer,
    });
  } catch (error) {
    console.error("getCustomerFullProfileByUUID error:", error);
    return res.status(500).json({
      error: "Failed to fetch customer profile",
      details: error?.message || "Unknown error",
    });
  }
};

export {
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
  getAllCustomersWithDetails,
  getCustomerSummaryByUUID,
  getCustomerDetailedByUUID,
  getCustomerQuotes,
  getCustomerJobsAndRecurrences,
  getCustomerContacts,
  getCustomerFullProfileByUUID
};