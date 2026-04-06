import Business from "../models/Business.js";
import Customer from "../models/Customer.js";
import { createChangeLogSafe } from "../util/createChangeLogSafe.js";
import {
  normalizeNZPhone,
  generatePrefixedId,
  generateUniqueChangeLogUUID,
} from "../util/util.js";

const getAllBusinesses = async (req, res) => {
  try {
    const businesses = await Business.findAll();

    if (!businesses || businesses.length === 0) {
      return res.status(200).json({ message: "No businesses found", data: [] });
    }

    return res.status(200).json(businesses);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// works fine 9/01/2026
const getBusinessByUUID = async (req, res) => {
  const { uuid } = req.params;

  if (!uuid) {
    return res.status(400).json({ error: "Missing business UUID" });
  }

  try {
    const business = await Business.findByUUID(uuid);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    return res.status(200).json(business);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const createBusiness = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;

  const {
    name,
    business_mobile_phone,
    business_landline_phone,
    email,
    address,
    customer_uuid,
  } = req.body;

  console.log(req.body, " creating a business");

  const normalizedEmail = email?.trim().toLowerCase();
  const trimmedName = name?.trim();
  const trimmedAddress = address?.trim();

  if (!normalizedEmail) {
    return res.status(400).json({ error: "Business email is required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  if (!trimmedName) {
    return res.status(400).json({ error: "Business name is required" });
  }

  if (!business_mobile_phone) {
    return res.status(400).json({ error: "Business phone is required" });
  }

  if (!trimmedAddress) {
    return res.status(400).json({ error: "Business address is required" });
  }

  const mobileNormalizedPhone = business_mobile_phone
    ? normalizeNZPhone(business_mobile_phone)
    : null;

  const landlineNormalizedPhone = business_landline_phone
    ? normalizeNZPhone(business_landline_phone)
    : null;

  let uuid;
  let exists;

  try {
    do {
      uuid = generatePrefixedId("B", 8);
      exists = await Business.findByUUID(uuid);
    } while (exists);

    let linkedCustomerBefore = null;
    let linkedCustomerAfter = null;

    if (customer_uuid) {
      const customer = await Customer.findByUUID(customer_uuid);

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      linkedCustomerBefore = customer;

      linkedCustomerAfter = await Customer.findByUUIDAndUpdate(customer_uuid, {
        customer_type: "business",
      });

      console.log({ linkedCustomerAfter });
    }

    const newBusinessData = {
      uuid,
      name: trimmedName,
      business_mobile_phone: mobileNormalizedPhone || null,
      business_landline_phone: landlineNormalizedPhone || null,
      email: normalizedEmail,
      address: trimmedAddress,
      customer_uuid: customer_uuid || null,
    };

    const newBusiness = await Business.create(newBusinessData);

    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "businesses",
      record_uuid: newBusiness.uuid,
      user_uuid: actorUserUuid,
      action: "create",
      summary: "Business created.",
      changed_fields: {
        uuid: newBusiness.uuid,
        name: newBusiness.name,
        business_mobile_phone: newBusiness.business_mobile_phone,
        business_landline_phone: newBusiness.business_landline_phone,
        email: newBusiness.email,
        address: newBusiness.address,
        customer_uuid: newBusiness.customer_uuid,
      },
      oldData: null,
      newData: newBusiness,
      source: "dashboard",
    });

    if (customer_uuid && linkedCustomerBefore) {
      await createChangeLogSafe({
        uuid: await generateUniqueChangeLogUUID(),
        table_name: "customers",
        record_uuid: customer_uuid,
        user_uuid: actorUserUuid,
        action: "update",
        summary: "Customer linked to business and customer type updated to business.",
        changed_fields: {
          customer_type: {
            old: linkedCustomerBefore.customer_type ?? null,
            new: linkedCustomerAfter?.customer_type ?? "business",
          },
          linked_business_uuid: {
            old: null,
            new: newBusiness.uuid,
          },
        },
        oldData: linkedCustomerBefore,
        newData: linkedCustomerAfter || {
          ...linkedCustomerBefore,
          customer_type: "business",
        },
        source: "dashboard",
      });
    }

    return res.status(201).json({
      message: "Business created successfully",
      data: newBusiness,
    });
  } catch (error) {
    console.error("Error creating business:", error);
    return res.status(500).json({ error: error.message });
  }
};

const updateBusinessByUUID = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;
  const { uuid } = req.params;
  let updates = { ...req.body };

  if (!uuid) {
    return res.status(400).json({ error: "Missing business UUID" });
  }

  try {
    const foundBusiness = await Business.findByUUID(uuid);

    if (!foundBusiness) {
      return res.status(404).json({ error: "Business not found" });
    }

    if (updates.email) {
      updates.email = updates.email.trim().toLowerCase();
    }

    if (updates.name) {
      updates.name = updates.name.trim();
    }

    if (updates.address) {
      updates.address = updates.address.trim();
    }

    if (updates.email && updates.email !== foundBusiness.email) {
      const emailExists = await Business.findeByEmail(updates.email);
      if (emailExists) {
        return res.status(400).json({ error: "Email already exists" });
      }
    }

    if (
      updates.business_landline_phone &&
      updates.business_landline_phone !== foundBusiness.business_landline_phone
    ) {
      updates.business_landline_phone = normalizeNZPhone(
        updates.business_landline_phone
      );

      const existsLandline = await Customer.findByPhone(
        null,
        updates.business_landline_phone
      );

      if (existsLandline && existsLandline.uuid !== foundBusiness.uuid) {
        return res.status(400).json({ error: "Landline phone already exists" });
      }
    }

    if (
      updates.business_mobile_phone &&
      updates.business_mobile_phone !== foundBusiness.business_mobile_phone
    ) {
      updates.business_mobile_phone = normalizeNZPhone(
        updates.business_mobile_phone
      );

      const existsMobile = await Customer.findByPhone(
        updates.business_mobile_phone,
        null
      );

      if (existsMobile && existsMobile.uuid !== foundBusiness.uuid) {
        return res.status(400).json({ error: "Mobile phone already exists" });
      }
    }

    const updated = await Business.findByUUIDAndUpdate(uuid, updates);

    const changedFields = {};

    for (const key of Object.keys(updates)) {
      changedFields[key] = {
        old: foundBusiness[key] ?? null,
        new: updated?.[key] ?? updates[key] ?? null,
      };
    }

    if (Object.keys(changedFields).length > 0) {
      await createChangeLogSafe({
        uuid: await generateUniqueChangeLogUUID(),
        table_name: "businesses",
        record_uuid: uuid,
        user_uuid: actorUserUuid,
        action: "update",
        summary: "Business updated.",
        changed_fields: changedFields,
        oldData: foundBusiness,
        newData: updated,
        source: "dashboard",
      });
    }

    return res.status(200).json({ ...updated });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const softDeleteBusiness = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;
  const { uuid } = req.params;

  if (!uuid) {
    return res.status(400).json({ error: "Business UUID is required" });
  }

  try {
    const business = await Business.findByUUID(uuid);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const deleted = await Business.softDelete(uuid);
    console.info(`Business ${uuid} soft-deleted at ${new Date().toISOString()}`);

    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "businesses",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "delete",
      summary: "Business soft deleted.",
      changed_fields: {
        is_deleted: {
          old: business.is_deleted ?? false,
          new: deleted.is_deleted ?? true,
        },
        deleted_at: {
          old: business.deleted_at ?? null,
          new: deleted.deleted_at ?? new Date().toISOString(),
        },
      },
      oldData: business,
      newData: deleted,
      source: "dashboard",
    });

    return res.status(200).json({
      message: "Business soft-deleted successfully",
      data: deleted,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const reinstateBusiness = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;
  const { uuid } = req.params;

  if (!uuid) {
    return res.status(400).json({ error: "Business UUID is required" });
  }

  try {
    const foundBusiness = await Business.findByUUID(uuid);

    if (!foundBusiness) {
      return res.status(404).json({ error: "Business not found" });
    }

    const businessReinstated = await Business.reinstate(uuid);
    console.info(
      `Business ${uuid} reinstated by user ${
        req.user?.id || "unknown"
      } at ${new Date().toISOString()}`
    );

    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "businesses",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "Business reinstated.",
      changed_fields: {
        is_deleted: {
          old: foundBusiness.is_deleted ?? true,
          new: businessReinstated.is_deleted ?? false,
        },
        deleted_at: {
          old: foundBusiness.deleted_at ?? null,
          new: businessReinstated.deleted_at ?? null,
        },
      },
      oldData: foundBusiness,
      newData: businessReinstated,
      source: "dashboard",
    });

    return res.status(200).json({
      message: "Business reinstated successfully",
      data: businessReinstated,
    });
  } catch (error) {
    console.error(`Error reinstating business ${uuid}:`, error);
    return res.status(500).json({ error: error.message });
  }
};

const hardDeleteBusiness = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;
  const { uuid } = req.params;

  if (!uuid) {
    return res.status(400).json({ error: "Business UUID is required" });
  }

  try {
    const foundBusiness = await Business.findByUUID(uuid);

    if (!foundBusiness) {
      return res.status(404).json({ error: "Business not found" });
    }

    const deleted = await Business.delete(uuid);
    console.log({ deleted });

    if (!deleted) {
      return res.status(500).json({ error: "Failed to delete business" });
    }

    await createChangeLogSafe({
      uuid: await generateUniqueChangeLogUUID(),
      table_name: "businesses",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "delete",
      summary: "Business hard deleted.",
      changed_fields: {
        deleted_record: {
          old: {
            uuid: foundBusiness.uuid,
            name: foundBusiness.name,
            business_mobile_phone: foundBusiness.business_mobile_phone,
            business_landline_phone: foundBusiness.business_landline_phone,
            email: foundBusiness.email,
            address: foundBusiness.address,
            customer_uuid: foundBusiness.customer_uuid,
          },
          new: null,
        },
      },
      oldData: foundBusiness,
      newData: null,
      source: "dashboard",
    });

    return res.status(200).json({
      message: "Business deleted successfully",
      data: deleted,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getBusinessByName = async (req, res) => {
  const { name } = req.params;

  if (!name) {
    return res.status(400).json({ error: "Missing business name" });
  }

  try {
    const business = await Business.findByName(name);

    if (!business) {
      return res
        .status(404)
        .json({ error: `Business not found with name "${name}"` });
    }

    return res.status(200).json(business);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getBusinessByEmail = async (req, res) => {
  const { email } = req.params;

  if (!email) {
    return res.status(400).json({ error: "Missing business email" });
  }

  try {
    const business = await Business.findeByEmail(email.trim().toLowerCase());

    if (!business || business.length === 0) {
      return res
        .status(404)
        .json({ error: `Business not found with email ${email}` });
    }

    return res.status(200).json(business);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export {
  getAllBusinesses,
  getBusinessByUUID,
  createBusiness,
  updateBusinessByUUID,
  softDeleteBusiness,
  reinstateBusiness,
  hardDeleteBusiness,
  getBusinessByName,
  getBusinessByEmail,
};