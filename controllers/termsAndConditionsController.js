import TermsAndConditions from "../models/TermsAndConditions.js";
import { generatePrefixedId } from "../util/util.js";
import { createChangeLogSafe } from "../util/createChangeLogSafe.js";
import { generateTermsPDF } from "../util/generateTermsPDF.js";
import { uploadTermsPDFBuffer, downloadTermsPDFBuffer, deleteTermsPDF  } from "../util/termsAndConditionsHelper.js";

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

// export const createTermsAndConditions = async (req, res) => {
//   try {
//     const {
//       version,
//       title,
//       content,
//       short_summary = null,
//       is_active = false,
//     } = req.body;

//     const actorUserUuid = req.user?.uuid || null;

//     if (!version) {
//       return res.status(400).json({ error: "Version is required" });
//     }

//     if (!title) {
//       return res.status(400).json({ error: "Title is required" });
//     }

//     if (!content) {
//       return res.status(400).json({ error: "Content is required" });
//     }

//     const existingVersion = await TermsAndConditions.findByVersion(version);
//     if (existingVersion) {
//       return res.status(409).json({
//         error: "A terms and conditions record with this version already exists",
//       });
//     }

//     if (is_active) {
//       const activeTerms = await TermsAndConditions.findActive();
//       if (activeTerms) {
//         await TermsAndConditions.updateByUUID(activeTerms.uuid, {
//           is_active: false,
//         });
//       }
//     }

//     const uuid = await generateUniqueTermsUUID();

//     // 1) generate PDF
//     const pdfBuffer = await generateTermsPDF(
//       content,
//       version,
//       // title,
//       // short_summary,
//     );

//     // 2) upload PDF
//     const safeVersion = String(version).replace(/[^a-zA-Z0-9._-]/g, "-");
//     const filePath = `terms-${safeVersion}.pdf`;

//     const uploadResult = await uploadTermsPDFBuffer({
//       buffer: pdfBuffer,
//       filePath,
//       contentType: "application/pdf",
//     });

//     // 3) save DB row with both url and storage path
//     const created = await TermsAndConditions.create({
//       uuid,
//       version,
//       title,
//       content,
//       short_summary,
//       pdf_url: uploadResult.publicUrl,
//       pdf_storage_path: uploadResult.storagePath,
//       is_active: Boolean(is_active),
//     });

//     await createChangeLogSafe({
//       table_name: "terms_and_conditions",
//       record_uuid: created.uuid,
//       user_uuid: actorUserUuid,
//       action: "create",
//       summary: `Created terms and conditions version ${created.version}`,
//       changed_fields: {
//         version: created.version,
//         title: created.title,
//         is_active: created.is_active,
//         pdf_url: created.pdf_url,
//         pdf_storage_path: created.pdf_storage_path,
//       },
//       source: "dashboard",
//     });

//     if (is_active) {
//       await createChangeLogSafe({
//         table_name: "terms_and_conditions",
//         record_uuid: created.uuid,
//         user_uuid: actorUserUuid,
//         action: "activate",
//         summary: `Activated terms and conditions version ${created.version}`,
//         changed_fields: {
//           is_active: {
//             from: false,
//             to: true,
//           },
//         },
//         source: "dashboard",
//       });
//     }

//     return res.status(201).json(created);
//   } catch (error) {
//     console.error("createTermsAndConditions error:", error);
//     return res.status(500).json({
//       error: error.message || "Failed to create terms and conditions",
//     });
//   }
// };

// export const createTermsAndConditions = async (req, res) => {
//   try {
//     const {
//       version,
//       title,
//       content,
//       short_summary = null,
//       is_active = false,
//       effective_date = null,
//     } = req.body;

//     const actorUserUuid = req.user?.uuid || null;

//     if (!version) {
//       return res.status(400).json({ error: "Version is required" });
//     }

//     if (!title) {
//       return res.status(400).json({ error: "Title is required" });
//     }

//     if (!content) {
//       return res.status(400).json({ error: "Content is required" });
//     }

//     const existingVersion = await TermsAndConditions.findByVersion(version);
//     console.log({ existingVersion });
//     if (existingVersion) {
//       return res.status(409).json({
//         error: "A terms and conditions record with this version already exists",
//       });
//     }

//     if (is_active) {
//       const activeTerms = await TermsAndConditions.findActive();
//       if (activeTerms) {
//         await TermsAndConditions.updateByUUID(activeTerms.uuid, {
//           is_active: false,
//         });
//       }
//     }

//     const uuid = await generateUniqueTermsUUID();

//     const pdfBuffer = await generateTermsPDF(
//       content,
//       version,
//     );

//     const safeVersion = String(version).replace(/[^a-zA-Z0-9._-]/g, "-");
//     const filePath = `terms/${uuid}-v${safeVersion}.pdf`;


//     const uploadResult = await uploadTermsPDFBuffer({
//       buffer: pdfBuffer,
//       filePath,
//       contentType: "application/pdf",
//     });

//     const created = await TermsAndConditions.create({
//       uuid,
//       version,
//       title,
//       content,
//       short_summary,
//       effective_date,
//       pdf_url: uploadResult.publicUrl,
//       pdf_storage_path: uploadResult.storagePath,
//       is_active: Boolean(is_active),
//     });

//     await createChangeLogSafe({
//       table_name: "terms_and_conditions",
//       record_uuid: created.uuid,
//       user_uuid: actorUserUuid,
//       action: "create",
//       summary: `Created terms and conditions version ${created.version}`,
//       changed_fields: {
//         version: created.version,
//         title: created.title,
//         effective_date: created.effective_date,
//         is_active: created.is_active,
//         pdf_url: created.pdf_url,
//         pdf_storage_path: created.pdf_storage_path,
//       },
//       source: "dashboard",
//     });

//     if (is_active) {
//       await createChangeLogSafe({
//         table_name: "terms_and_conditions",
//         record_uuid: created.uuid,
//         user_uuid: actorUserUuid,
//         action: "activate",
//         summary: `Activated terms and conditions version ${created.version}`,
//         changed_fields: {
//           is_active: {
//             from: false,
//             to: true,
//           },
//         },
//         source: "dashboard",
//       });
//     }

//     return res.status(201).json(created);
//   } catch (error) {
//     console.error("createTermsAndConditions error:", error);
//     return res.status(500).json({
//       error: error.message || "Failed to create terms and conditions",
//     });
//   }
// };
export const createTermsAndConditions = async (req, res) => {
  let uploadedStoragePath = null;

  try {
    const {
      version,
      title,
      content,
      short_summary = null,
      is_active = false,
      effective_date = null,
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

    console.log("1. validation passed");

    const existingVersion = await TermsAndConditions.findByVersion(version);
    console.log("2. existingVersion:", existingVersion);

    if (existingVersion) {
      return res.status(409).json({
        error: "A terms and conditions record with this version already exists",
      });
    }

    if (is_active) {
      const activeTerms = await TermsAndConditions.findActive();
      console.log("3. activeTerms:", activeTerms);

      if (activeTerms) {
        await TermsAndConditions.updateByUUID(activeTerms.uuid, {
          is_active: false,
        });
        console.log("4. old active terms deactivated");
      }
    }

    const uuid = await generateUniqueTermsUUID();
    console.log("5. generated uuid:", uuid);

    const pdfBuffer = await generateTermsPDF(content, version);
    console.log("6. pdf generated, size:", pdfBuffer?.length);

    const safeVersion = String(version).replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `terms/${uuid}-v${safeVersion}.pdf`;
    console.log("7. filePath:", filePath);

    const uploadResult = await uploadTermsPDFBuffer({
      buffer: pdfBuffer,
      filePath,
      contentType: "application/pdf",
    });
    console.log("8. uploadResult:", uploadResult);

    uploadedStoragePath = uploadResult.storagePath;

    const created = await TermsAndConditions.create({
      uuid,
      version,
      title,
      content,
      short_summary,
      effective_date,
      pdf_url: uploadResult.publicUrl,
      pdf_storage_path: uploadResult.storagePath,
      is_active: Boolean(is_active),
    });
    console.log("9. created record:", created);

    await createChangeLogSafe({
      table_name: "terms_and_conditions",
      record_uuid: created.uuid,
      user_uuid: actorUserUuid,
      action: "create",
      summary: `Created terms and conditions version ${created.version}`,
      changed_fields: {
        version: created.version,
        title: created.title,
        effective_date: created.effective_date,
        is_active: created.is_active,
        pdf_url: created.pdf_url,
        pdf_storage_path: created.pdf_storage_path,
      },
      source: "dashboard",
    });
    console.log("10. changelog created");

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
      console.log("11. activate changelog created");
    }

    return res.status(201).json(created);
  } catch (error) {
    console.error("createTermsAndConditions error:", error);

    if (uploadedStoragePath) {
      try {
        await deleteTermsPDF(uploadedStoragePath);
        console.log("cleanup: uploaded pdf deleted:", uploadedStoragePath);
      } catch (cleanupError) {
        console.error("cleanup failed:", cleanupError);
      }
    }

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
    console.log({active});
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

    const nextVersion = updates.version ?? existing.version;
    const nextTitle = updates.title ?? existing.title;
    const nextContent = updates.content ?? existing.content;
    const nextShortSummary =
      updates.short_summary !== undefined
        ? updates.short_summary
        : existing.short_summary;

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

    if (updates.is_active !== undefined && updates.is_active !== existing.is_active) {
      changedFields.is_active = {
        from: existing.is_active,
        to: updates.is_active,
      };
    }

    // regenerate PDF on update
    const pdfBuffer = await generateTermsPDF({
      version: nextVersion,
      title: nextTitle,
      content: nextContent,
      short_summary: nextShortSummary,
    });

    const safeVersion = String(nextVersion).replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `terms-${safeVersion}.pdf`;

    const uploadResult = await uploadTermsPDFBuffer({
      buffer: pdfBuffer,
      filePath,
      contentType: "application/pdf",
    });

    changedFields.pdf_url = {
      from: existing.pdf_url,
      to: uploadResult.publicUrl,
    };

    changedFields.pdf_storage_path = {
      from: existing.pdf_storage_path,
      to: uploadResult.storagePath,
    };

    const updated = await TermsAndConditions.updateByUUID(uuid, {
      version: nextVersion,
      title: nextTitle,
      content: nextContent,
      short_summary: nextShortSummary,
      pdf_url: uploadResult.publicUrl,
      pdf_storage_path: uploadResult.storagePath,
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

export const getTermsByVersion = async (req, res) => {
  try {
    const { version } = req.params;
    if (!version) {
      return res.status(400).json({ error: "Version parameter is required" });
    }

    const terms = await TermsAndConditions.findByVersion(version);

    if (!terms) {
      return res.status(404).json({ error: "Terms not found" });
    }

    return res.status(200).json(terms);
  } catch (err) {
    console.error("getTermsByVersion error:", err);
    return res.status(500).json({ error: "Failed to fetch terms" });
  }
};