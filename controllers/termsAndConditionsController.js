import TermsAndConditions from "../models/TermsAndConditions.js";
import { generatePrefixedId } from "../util/util.js";
import { createChangeLogSafe } from "../util/createChangeLogSafe.js";

async function generateUniqueTermsUUID() {
  let generatedUUID = null;
  let exists = true;

  while (exists) {
    generatedUUID = generatePrefixedId("TC", 7);
    const existing = await TermsAndConditions.findByUUID(generatedUUID);
    if (!existing) {
      exists = false;
    }
  }

  return generatedUUID;
}

export const createTermsAndConditions = async (req, res) => {
  try {
    const {
      version,
      title,
      content,
      short_summary = null,
      pdf_url = null,
      is_active = false,
    } = req.body;

    const actorUserUuid = req.user?.uuid || null;

    if (!version) {
      return res.status(400).json({ error: "Version is required" });
    }

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const existingVersion = await TermsAndConditions.findByVersion(version);
    if (existingVersion) {
      return res.status(409).json({
        error: "A terms and conditions record with this version already exists",
      });
    }

    if (is_active) {
      const activeTerms = await TermsAndConditions.findActive();

      if (activeTerms) {
        await TermsAndConditions.updateByUUID(activeTerms.uuid, {
          is_active: false,
        });
      }
    }

    const uuid = await generateUniqueTermsUUID();

    const created = await TermsAndConditions.create({
      uuid,
      version,
      title,
      content,
      short_summary,
      pdf_url,
      is_active: Boolean(is_active),
    });

    await createChangeLogSafe({
      table_name: "terms_and_conditions",
      record_uuid: created.uuid,
      user_uuid: actorUserUuid,
      action: "create",
      summary: `Created terms and conditions version ${created.version}`,
      changed_fields: {
        version: created.version,
        title: created.title,
        is_active: created.is_active,
      },
      source: "dashboard",
    });

    if (is_active) {
      await createChangeLogSafe({
        table_name: "terms_and_conditions",
        record_uuid: created.uuid,
        user_uuid: actorUserUuid,
        action: "activate",
        summary: `Activated terms and conditions version ${created.version}`,
        changed_fields: {
          is_active: {
            from: false,
            to: true,
          },
        },
        source: "dashboard",
      });
    }

    return res.status(201).json(created);
  } catch (error) {
    console.error("createTermsAndConditions error:", error);
    return res.status(500).json({
      error: error.message || "Failed to create terms and conditions",
    });
  }
};

export const getAllTermsAndConditions = async (_req, res) => {
  try {
    const records = await TermsAndConditions.findAll();
    return res.status(200).json(records);
  } catch (error) {
    console.error("getAllTermsAndConditions error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch terms and conditions",
    });
  }
};

export const getActiveTermsAndConditions = async (_req, res) => {
  try {
    const active = await TermsAndConditions.findActive();

    if (!active) {
      return res.status(404).json({
        error: "No active terms and conditions found",
      });
    }

    return res.status(200).json(active);
  } catch (error) {
    console.error("getActiveTermsAndConditions error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch active terms and conditions",
    });
  }
};

export const getTermsAndConditionsByUUID = async (req, res) => {
  try {
    const { uuid } = req.params;

    if (!uuid) {
      return res.status(400).json({ error: "UUID is required" });
    }

    const record = await TermsAndConditions.findByUUID(uuid);

    if (!record) {
      return res.status(404).json({ error: "Terms and conditions not found" });
    }

    return res.status(200).json(record);
  } catch (error) {
    console.error("getTermsAndConditionsByUUID error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch terms and conditions",
    });
  }
};

export const updateTermsAndConditions = async (req, res) => {
  try {
    const { uuid } = req.params;
    const updates = req.body || {};
    const actorUserUuid = req.user?.uuid || null;

    if (!uuid) {
      return res.status(400).json({ error: "UUID is required" });
    }

    const existing = await TermsAndConditions.findByUUID(uuid);
    if (!existing) {
      return res.status(404).json({ error: "Terms and conditions not found" });
    }

    if (updates.version && updates.version !== existing.version) {
      const existingVersion = await TermsAndConditions.findByVersion(updates.version);
      if (existingVersion) {
        return res.status(409).json({
          error: "A terms and conditions record with this version already exists",
        });
      }
    }

    const changedFields = {};

    if (updates.version !== undefined && updates.version !== existing.version) {
      changedFields.version = {
        from: existing.version,
        to: updates.version,
      };
    }

    if (updates.title !== undefined && updates.title !== existing.title) {
      changedFields.title = {
        from: existing.title,
        to: updates.title,
      };
    }

    if (updates.content !== undefined && updates.content !== existing.content) {
      changedFields.content = "updated";
    }

    if (
      updates.short_summary !== undefined &&
      updates.short_summary !== existing.short_summary
    ) {
      changedFields.short_summary = {
        from: existing.short_summary,
        to: updates.short_summary,
      };
    }

    if (updates.pdf_url !== undefined && updates.pdf_url !== existing.pdf_url) {
      changedFields.pdf_url = {
        from: existing.pdf_url,
        to: updates.pdf_url,
      };
    }

    if (updates.is_active !== undefined && updates.is_active !== existing.is_active) {
      changedFields.is_active = {
        from: existing.is_active,
        to: updates.is_active,
      };
    }

    const updated = await TermsAndConditions.updateByUUID(uuid, {
      version: updates.version,
      title: updates.title,
      content: updates.content,
      short_summary: updates.short_summary,
      pdf_url: updates.pdf_url,
      is_active:
        updates.is_active === undefined ? existing.is_active : updates.is_active,
    });

    let finalRecord = updated;

    if (Object.keys(changedFields).length > 0) {
      await createChangeLogSafe({
        table_name: "terms_and_conditions",
        record_uuid: uuid,
        user_uuid: actorUserUuid,
        action: "update",
        summary: `Updated terms and conditions version ${updated.version}`,
        changed_fields: changedFields,
        source: "dashboard",
      });
    }

    if (updates.is_active === true && !existing.is_active) {
      finalRecord = await TermsAndConditions.setActiveByUUID(uuid);

      await createChangeLogSafe({
        table_name: "terms_and_conditions",
        record_uuid: uuid,
        user_uuid: actorUserUuid,
        action: "activate",
        summary: `Activated terms and conditions version ${finalRecord.version}`,
        changed_fields: {
          is_active: {
            from: false,
            to: true,
          },
        },
        source: "dashboard",
      });
    }

    return res.status(200).json(finalRecord);
  } catch (error) {
    console.error("updateTermsAndConditions error:", error);
    return res.status(500).json({
      error: error.message || "Failed to update terms and conditions",
    });
  }
};

export const setActiveTermsAndConditions = async (req, res) => {
  try {
    const { uuid } = req.params;
    const actorUserUuid = req.user?.uuid || null;

    if (!uuid) {
      return res.status(400).json({ error: "UUID is required" });
    }

    const existing = await TermsAndConditions.findByUUID(uuid);
    if (!existing) {
      return res.status(404).json({ error: "Terms and conditions not found" });
    }

    const updated = await TermsAndConditions.setActiveByUUID(uuid);

    await createChangeLogSafe({
      table_name: "terms_and_conditions",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "activate",
      summary: `Activated terms and conditions version ${updated.version}`,
      changed_fields: {
        is_active: {
          from: existing.is_active,
          to: updated.is_active,
        },
      },
      source: "dashboard",
    });

    return res.status(200).json({
      message: "Terms and conditions set as active successfully",
      data: updated,
    });
  } catch (error) {
    console.error("setActiveTermsAndConditions error:", error);
    return res.status(500).json({
      error: error.message || "Failed to set active terms and conditions",
    });
  }
};

export const deleteTermsAndConditions = async (req, res) => {
  try {
    const { uuid } = req.params;
    const actorUserUuid = req.user?.uuid || null;

    if (!uuid) {
      return res.status(400).json({ error: "UUID is required" });
    }

    const existing = await TermsAndConditions.findByUUID(uuid);
    if (!existing) {
      return res.status(404).json({ error: "Terms and conditions not found" });
    }

    const deleted = await TermsAndConditions.deleteByUUID(uuid);

    await createChangeLogSafe({
      table_name: "terms_and_conditions",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "delete",
      summary: `Deleted terms and conditions version ${existing.version}`,
      changed_fields: {
        version: existing.version,
        title: existing.title,
      },
      source: "dashboard",
    });

    return res.status(200).json({
      message: "Terms and conditions deleted successfully",
      data: deleted || existing,
    });
  } catch (error) {
    console.error("deleteTermsAndConditions error:", error);
    return res.status(500).json({
      error: error.message || "Failed to delete terms and conditions",
    });
  }
};