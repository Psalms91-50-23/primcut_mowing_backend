import Customer from "../models/Customer.js";
import CustomerContact from "../models/CustomerContact.js";
import { generatePrefixedId, normalizeNZPhone, generateUniqueChangeLogUUID } from "../util/util.js";
import { createChangeLogSafe } from "../util/createChangeLogSafe.js";

const normalizeEmail = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim().toLowerCase();
  return trimmed || null;
};

const cleanText = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
};

export const createCustomerContact = async (req, res) => {
  const { uuid } = req.params;
  const actorUserUuid = req.user?.uuid || null;

  try {
    if (!uuid) {
      return res.status(400).json({ error: "Customer UUID is required" });
    }

    const customer = await Customer.findByUUID(uuid);
    if (!customer || customer.is_deleted) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const {
      first_name,
      last_name,
      email,
      mobile_phone,
      landline_phone,
      role,
      notes,
      is_primary = false,
      is_billing_contact = false,
      is_site_contact = false,
    } = req.body || {};

    if (!cleanText(first_name)) {
      return res.status(400).json({ error: "First name is required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedMobile = normalizeNZPhone(mobile_phone);
    const normalizedLandline = normalizeNZPhone(landline_phone);

    if (!normalizedEmail && !normalizedMobile && !normalizedLandline) {
      return res.status(400).json({
        error: "At least one contact method is required (email, mobile, or landline)",
      });
    }

    if (is_primary) {
      await CustomerContact.clearPrimaryForCustomer(uuid);
    }

    const contact = await CustomerContact.create({
      uuid: generatePrefixedId("CC", 7),
      customer_uuid: uuid,
      first_name: cleanText(first_name),
      last_name: cleanText(last_name),
      email: normalizedEmail,
      mobile_phone: normalizedMobile,
      landline_phone: normalizedLandline,
      role: cleanText(role),
      notes: cleanText(notes),
      is_primary: Boolean(is_primary),
      is_billing_contact: Boolean(is_billing_contact),
      is_site_contact: Boolean(is_site_contact),
      created_by_uuid: actorUserUuid,
    });

    const changeLogUUID = await generateUniqueChangeLogUUID();

    await createChangeLogSafe({
      uuid: changeLogUUID,
      table_name: "customer_contacts",
      record_uuid: contact.uuid,
      user_uuid: actorUserUuid,
      action: "create",
      summary: `Created customer contact ${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ""}`,
      changed_fields: {
        customer_uuid: contact.customer_uuid,
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
        mobile_phone: contact.mobile_phone,
        landline_phone: contact.landline_phone,
        role: contact.role,
        is_primary: contact.is_primary,
        is_billing_contact: contact.is_billing_contact,
        is_site_contact: contact.is_site_contact,
      },
      source: "dashboard",
    });

    return res.status(201).json({
      message: "Customer contact created successfully",
      contact,
    });
  } catch (err) {
    console.error("createCustomerContact error:", err);
    return res.status(500).json({
      error: err.message || "Failed to create customer contact",
    });
  }
};

export const getCustomerContacts = async (req, res) => {
  const { uuid } = req.params;

  if (!uuid) {
    return res.status(400).json({ error: "Customer UUID is required" });
  }

  try {
    const contacts = await CustomerContact.findContactsByCustomerUUID(uuid);
    return res.status(200).json({
      contacts: contacts || [],
    });
  } catch (err) {
    console.error("getCustomerContacts error:", err);
    return res.status(500).json({ error: "Failed to fetch contacts" });
  }
};

export const getCustomerContactByUUID = async (req, res) => {
  const { uuid } = req.params;

  try {
    if (!uuid) {
      return res.status(400).json({ error: "Contact UUID is required" });
    }

    const contact = await CustomerContact.findAllByCustomerUUID(uuid);
    if (!contact) {
      return res.status(404).json({ error: "Customer contact not found" });
    }

    return res.status(200).json({ contact });
  } catch (err) {
    console.error("getCustomerContactByUUID error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch customer contact" });
  }
};

export const findAllByCustomerUUIDIncDelete = async (req, res) => {
  const { uuid } = req.params;

  try {
    if (!uuid) {
      return res.status(400).json({ error: "Contact UUID is required" });
    }

    const contact = await CustomerContact.findAllByCustomerUUIDIncDelete(uuid);
    if (!contact) {
      return res.status(404).json({ error: "Customer contact not found" });
    }

    return res.status(200).json({ contact });
  } catch (err) {
    console.error("getCustomerContactByUUID error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch customer contact" });
  }
};

export const updateCustomerContact = async (req, res) => {
  const { uuid } = req.params;
  const actorUserUuid = req.user?.uuid || null;

  try {
    if (!uuid) {
      return res.status(400).json({ error: "Contact UUID is required" });
    }

    const existing = await CustomerContact.findByUUID(uuid);
    if (!existing) {
      return res.status(404).json({ error: "Customer contact not found" });
    }

    const {
      first_name,
      last_name,
      email,
      mobile_phone,
      landline_phone,
      role,
      notes,
      internal_notes,
      is_primary,
      is_billing_contact,
      is_site_contact,
    } = req.body || {};

    const updates = {};

    if (first_name !== undefined) updates.first_name = cleanText(first_name);
    if (last_name !== undefined) updates.last_name = cleanText(last_name);
    if (email !== undefined) updates.email = normalizeEmail(email);
    if (mobile_phone !== undefined) updates.mobile_phone = normalizeNZPhone(mobile_phone);
    if (landline_phone !== undefined) updates.landline_phone = normalizeNZPhone(landline_phone);
    if (role !== undefined) updates.role = cleanText(role);
    if (notes !== undefined) updates.notes = cleanText(notes);
    if (internal_notes !== undefined) updates.internal_notes = cleanText(internal_notes);
    if (is_primary !== undefined) updates.is_primary = Boolean(is_primary);
    if (is_billing_contact !== undefined) {
      updates.is_billing_contact = Boolean(is_billing_contact);
    }
    if (is_site_contact !== undefined) {
      updates.is_site_contact = Boolean(is_site_contact);
    }

    const nextEmail =
      updates.email !== undefined ? updates.email : existing.email;
    const nextMobile =
      updates.mobile_phone !== undefined ? updates.mobile_phone : existing.mobile_phone;
    const nextLandline =
      updates.landline_phone !== undefined ? updates.landline_phone : existing.landline_phone;

    if (!nextEmail && !nextMobile && !nextLandline) {
      return res.status(400).json({
        error: "At least one contact method is required (email, mobile, or landline)",
      });
    }

    if (updates.first_name !== undefined && !updates.first_name) {
      return res.status(400).json({ error: "First name is required" });
    }

    if (updates.is_primary === true) {
      await CustomerContact.clearPrimaryForCustomer(existing.customer_uuid, uuid);
    }

    const updated = await CustomerContact.updateByUUID(uuid, updates);
    const changeLogUUID = await generateUniqueChangeLogUUID();

    await createChangeLogSafe({
      uuid: changeLogUUID,
      table_name: "customer_contacts",
      record_uuid: updated.uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: `Updated customer contact ${updated.first_name}${
        updated.last_name ? ` ${updated.last_name}` : ""
      }`,
      changed_fields: updates,
      source: "dashboard",
    });

    return res.status(200).json({
      message: "Customer contact updated successfully",
      contact: updated,
    });
  } catch (err) {
    console.error("updateCustomerContact error:", err);
    return res.status(500).json({
      error: err.message || "Failed to update customer contact",
    });
  }
};

export const deleteCustomerContact = async (req, res) => {
  const { uuid } = req.params;
  const actorUserUuid = req.user?.uuid || null;
  const actorRole = req.user?.role || null;
  const actorCustomerUuid = req.user?.customer_uuid || null;

  try {
    if (!uuid) {
      return res.status(400).json({ error: "Contact UUID is required" });
    }

    const existing = await CustomerContact.findByUUID(uuid);

    if (!existing) {
      return res.status(404).json({ error: "Customer contact not found" });
    }

    if (existing.is_deleted) {
      return res.status(400).json({ error: "Customer contact is already deleted" });
    }

    // If the logged-in user is a customer, only allow deleting contacts
    // connected to their own customer record.
    if (actorRole === "customer") {
      if (!actorCustomerUuid || existing.customer_uuid !== actorCustomerUuid) {
        return res.status(403).json({
          error: "You are not allowed to delete this customer contact",
        });
      }
    }

    // Optional safety rule:
    // if (existing.is_primary) {
    //   return res.status(400).json({
    //     error: "Primary contact cannot be deleted until another primary contact is set",
    //   });
    // }

    const deleteResult = await CustomerContact.softDeleteByUUID(uuid);

    // Fallback for silent no-op updates
    if (!deleteResult.success || !deleteResult.contact) {
      const recheck = await CustomerContact.findByUUID(uuid);

      // Another request may have already deleted it
      if (recheck?.is_deleted) {
        return res.status(200).json({
          message: "Customer contact already deleted",
          contact: recheck,
        });
      }

      return res.status(500).json({
        error:
          deleteResult.error ||
          "Failed to delete customer contact",
      });
    }

    const deleted = deleteResult.contact;
    const changeLogUUID = await generateUniqueChangeLogUUID();
    await createChangeLogSafe({
      uuid: changeLogUUID,
      table_name: "customer_contacts",
      record_uuid: deleted.uuid,
      user_uuid: actorUserUuid,
      action: "delete",
      summary: `Deleted customer contact ${existing.first_name}${
        existing.last_name ? ` ${existing.last_name}` : ""
      }`,
      changed_fields: {
        is_deleted: true,
        deleted_at: deleted.deleted_at,
      },
      source: "dashboard",
    });

    return res.status(200).json({
      message: "Customer contact deleted successfully",
      contact: deleted,
    });
  } catch (err) {
    console.error("deleteCustomerContact error:", err);
    return res.status(500).json({
      error: err.message || "Failed to delete customer contact",
    });
  }
};