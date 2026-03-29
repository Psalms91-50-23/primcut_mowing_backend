import Quote from "../models/Quote.js";
import Customer from "../models/Customer.js";
import Service from "../models/Service.js";
import QuoteAccessToken from "../models/QuoteAccessToken.js";
import Job from "../models/Job.js";
import User from "../models/User.js";
import TermsAndConditions from "../models/TermsAndConditions.js";
import crypto from "crypto";
import {
  generatePrefixedId,
  normalizeNZPhone,
  formatExpiry,
  formatFullName,
  hashToken,
  obfuscateName,
  // generateQuotePDF,
} from "../util/util.js";

import { generateQuotePDF } from "../util/generateQuotePDF.js";
import { createQuoteTermsAcceptanceRecord } from "../util/createQuoteTermsAcceptanceRecord.js";
import { generateTermsPDF } from "../util/generateTermsPDF.js";
import { createChangeLogSafe } from "../util/createChangeLogSafe.js";
import { downloadTermsPDFBuffer, uploadTermsPDFBuffer, downloadStorageFileBuffer } from "../util/termsAndConditionsHelper.js";
import {
  sendQuoteToBusiness,
  sendQuoteAccepted,
  sendQuoteRejected,
  sendQuoteToClient,
  sendQuoteAcceptedToBusiness
} from "../lib/email/index.js";
import supabase from "../config/db.js";
import { uploadImageToBucket, removeUploadedFiles, parseJSONField } from "../util/uploadHelpers.js";

const QUOTE_IMAGES_BUCKET = "quote-images";
const URGENT_FEE_AMOUNT = 200;
const MIN_EXPIRY_DAYS = 3;
const UUID_REGEX = /^[a-zA-Z0-9]{9}$/;

function assertUUID(uuid) {
  const u = String(uuid || "").trim();
  if (!u) throw new Error("Quote UUID is required");
  if (!UUID_REGEX.test(u)) throw new Error("UUID must be exactly 9 letters or numbers.");
  return u;
}

const sanitizeFileName = (name = "image") => {
  return String(name)
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
};

const getExtensionFromMime = (mimetype = "") => {
  const map = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
  };

  return map[mimetype] || "";
};

// GET /api/quotes/summary/:uuid
export const getQuoteSummaryByUUID = async (req, res) => {
  try {
    const uuid = assertUUID(req.params.uuid);

    const quote = await Quote.findSummaryByUUID(uuid);
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    return res.status(200).json({ quote });
  } catch (err) {
    console.error("getQuoteSummaryByUUID error:", err);
    return res.status(400).json({ error: err.message || "Failed to fetch quote summary" });
  }
};

// GET /api/quotes/detailed/:uuid
export const getQuoteDetailedByUUID = async (req, res) => {
  try {
    const uuid = assertUUID(req.params.uuid);

    const quote = await Quote.findDetailedByUUID(uuid);
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    return res.status(200).json({ quote });
  } catch (err) {
    console.error("getQuoteDetailedByUUID error:", err);
    return res.status(400).json({ error: err.message || "Failed to fetch quote" });
  }
};

export const getLimitedQuoteByUUID = async (req, res) => {
  const { uuid } = req.params;
  if (!uuid) {
    return res.status(400).json({ error: "Quote uuid is required." });
  }

  try {
    const quote = await Quote.findByUUID(uuid);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    const limitedQuote = {
      uuid: quote.uuid,
      contact_first_name: obfuscateName(quote.contact_first_name),
      contact_last_name: obfuscateName(quote.contact_last_name),
      responded_at: quote.responded_at,
      expiry_end: quote.expiry_end,
      services: Array.isArray(quote.services)
        ? quote.services.map((s) => ({ label: s.label, quantity: s.quantity }))
        : [],
      status: quote.status,
      subtotal_amount: quote.subtotal_amount,
      gst_amount: quote.gst_amount,
      total_amount: quote.total_amount,
      limited: true,
      has_urgent_fee: quote.has_urgent_fee ? true : false,
      urgent_fee_amount: quote.urgent_fee_amount || 0,
    };

    return res.status(200).json({ quote: limitedQuote });
  } catch (error) {
    console.error("getLimitedQuoteByUUID error:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getQuotes = async (req, res) => {
  try {
    const { status = "draft", limit = 10, page = 1, olderThan } = req.query;

    const limitNum = Math.min(Number(limit) || 10, 100);
    const pageNum = Math.max(Number(page) || 1, 1);

    let olderThanNum;
    if (olderThan !== undefined && olderThan !== "") {
      olderThanNum = Math.max(Number(olderThan) || 0, 0);
    } else if (status === "expired") {
      olderThanNum = 7;
    }

    const { quotes, count } = await Quote.findAllWithPagination({
      page: pageNum,
      limit: limitNum,
      status,
      olderThan: olderThanNum,
    });

    return res.status(200).json({
      quotes,
      page: pageNum,
      limit: limitNum,
      total: count,
      totalPages: Math.max(1, Math.ceil((count || 0) / limitNum)),
    });
  } catch (error) {
    console.error("getQuotes error:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Get all quotes
export const getAllQuotes = async (req, res) => {
  try {
    const quotes = await Quote.findAll();
    return res.status(200).json(quotes);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Get quote by ID
export const getQuoteById = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Quote ID is required" });
  }

  try {
    const quote = await Quote.findById(id);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }
    return res.status(200).json(quote);
  } catch (error) {
    return res.status(404).json({ error: error.message });
  }
};

export const getQuotesByCustomerUUID = async (req, res) => {
  const { customerUuid } = req.params;
  const actorUserUuid = req.user?.uuid || null;

  if (!customerUuid) {
    return res.status(400).json({ error: "Customer UUID is required" });
  }

  try {
    const quotes = await Quote.findByCustomerUUID(customerUuid);

    return res.status(200).json({
      quotes,
      count: quotes.length,
      customer_uuid: customerUuid,
      actor_user_uuid: actorUserUuid,
    });
  } catch (error) {
    console.error("getQuotesByCustomerUUID error:", error);
    return res.status(500).json({
      error: "Failed to fetch quotes for customer",
    });
  }
};

// Get quote by UUID
export const getQuoteByUUID = async (req, res) => {
  const { uuid } = req.params;
  if (!uuid) {
    return res.status(400).json({ error: "Quote UUID is required" });
  }

  try {
    const quote = await Quote.findByUUID(uuid);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }
    return res.status(200).json({ quote });
  } catch (error) {
    return res.status(404).json({ error: error.message });
  }
};


// export const createQuote = async (req, res) => {
//   let newQuote = null;
//   let quoteAccessToken = null;

//   try {
//     const {
//       customer_uuid,
//       services,
//       images,
//       first_name,
//       last_name,
//       mobile,
//       landline,
//       preferred_contact_method,
//       email,
//       message,
//       address,
//       recurrence_frequency,
//       urgent,
//     } = req.body;

//     const isUrgentRequested = urgent === true || urgent === "true";
//     const actorUserUuid = req.user?.uuid || null;

//     let actorUser = null;
//     let actorCustomer = null;
//     let existingCustomer = null;

//     let source = "public_form";

//     if (actorUserUuid) {
//       actorUser = await User.findByUUID(actorUserUuid);

//       if (actorUser?.role === "customer") {
//         source = "customer_portal";

//         if (actorUser.customer_uuid) {
//           actorCustomer = await Customer.findByUUID(actorUser.customer_uuid);
//         }
//       } else {
//         source = "dashboard";
//       }
//     }

//     const resolvedFirstName = (
//       first_name?.trim() ||
//       actorCustomer?.first_name ||
//       actorUser?.first_name ||
//       ""
//     ).trim();

//     const resolvedLastName = (
//       last_name?.trim() ||
//       actorCustomer?.last_name ||
//       actorUser?.last_name ||
//       ""
//     ).trim();

//     const resolvedEmail = (
//       email?.trim().toLowerCase() ||
//       actorCustomer?.email ||
//       actorUser?.email ||
//       null
//     );

//     const resolvedMobile =
//       mobile?.trim() || actorCustomer?.mobile_phone || null;

//     const resolvedLandline =
//       landline?.trim() || actorCustomer?.landline_phone || null;

//     const resolvedAddress = (
//       address?.trim() ||
//       actorCustomer?.address ||
//       ""
//     ).trim();

//     const allowedRecurrenceFrequencies = [
//       "one_off",
//       "weekly",
//       "fortnightly",
//       "monthly",
//     ];

//     const normalizedRecurrenceFrequency = allowedRecurrenceFrequencies.includes(
//       recurrence_frequency
//     )
//       ? recurrence_frequency
//       : "one_off";

//     if (!resolvedFirstName || !resolvedLastName) {
//       return res.status(400).json({
//         error: "First name and last name are required",
//       });
//     }

//     if (!resolvedMobile && !resolvedLandline) {
//       return res.status(400).json({
//         error: "Please provide either a mobile or landline number",
//       });
//     }

//     if (!Array.isArray(services) || services.length === 0) {
//       return res.status(400).json({
//         error: "At least one service is required",
//       });
//     }

//     if (!resolvedAddress) {
//       return res.status(400).json({
//         error: "Address is required",
//       });
//     }

//     if (resolvedEmail) {
//       existingCustomer = await Customer.findByEmail(resolvedEmail);

//       if (existingCustomer?.is_blacklisted) {
//         return res.status(403).json({
//           error: "We are unable to process this request at this time.",
//           code: "CUSTOMER_BLACKLISTED",
//         });
//       }
//     }

//     const resolvedCustomerUuid =
//       customer_uuid ||
//       actorCustomer?.uuid ||
//       actorUser?.customer_uuid ||
//       existingCustomer?.uuid ||
//       null;

//     const cleanedServices = services
//       .map((service) => {
//         if (!service || typeof service !== "object") return null;

//         const service_uuid =
//           typeof service.service_uuid === "string"
//             ? service.service_uuid.trim()
//             : null;

//         const code =
//           typeof service.code === "string" ? service.code.trim() : null;

//         const label =
//           typeof service.label === "string" ? service.label.trim() : null;

//         const description =
//           typeof service.description === "string" && service.description.trim()
//             ? service.description.trim()
//             : null;

//         const quantity =
//           service.quantity !== undefined && service.quantity !== null
//             ? Number(service.quantity)
//             : null;

//         const unit =
//           typeof service.unit === "string" ? service.unit.trim() : null;

//         const unit_price =
//           service.unit_price !== undefined && service.unit_price !== null
//             ? Number(service.unit_price)
//             : null;

//         const line_total =
//           service.line_total !== undefined && service.line_total !== null
//             ? Number(service.line_total)
//             : null;

//         if (!service_uuid && !code && !label) return null;

//         return {
//           service_uuid,
//           code,
//           label,
//           description,
//           quantity,
//           unit,
//           unit_price,
//           line_total,
//         };
//       })
//       .filter(Boolean);

//     if (cleanedServices.length === 0) {
//       return res.status(400).json({
//         error: "At least one valid service is required",
//       });
//     }

//     if (isUrgentRequested && cleanedServices.length !== 1) {
//       return res.status(400).json({
//         error:
//           "Only 1 urgent request can be done per job. Please select one urgent-eligible service only.",
//       });
//     }

//     if (isUrgentRequested) {
//       const selectedService = cleanedServices[0];

//       let dbService = null;

//       try {
//         if (selectedService.service_uuid) {
//           dbService = await Service.getByUUID(selectedService.service_uuid);
//         }

//         if (!dbService && selectedService.code) {
//           dbService = await Service.getByCode(selectedService.code);
//         }
//       } catch (serviceError) {
//         console.error("Service validation failed:", serviceError);
//         return res.status(400).json({
//           error: "Selected service could not be validated.",
//         });
//       }

//       if (!dbService) {
//         return res.status(400).json({
//           error: "Selected service could not be validated.",
//         });
//       }

//       if (!dbService.is_active || dbService.is_deleted) {
//         return res.status(400).json({
//           error: "Selected service is not currently available.",
//         });
//       }

//       if (!dbService.urgent_allowed) {
//         return res.status(400).json({
//           error: "Urgent booking is not available for the selected service.",
//         });
//       }
//     }

//     const cleanedImages = (images || [])
//       .map((img) => {
//         if (typeof img === "string") {
//           return { url: img.trim() };
//         }

//         if (img && typeof img.url === "string") {
//           return {
//             url: img.url.trim(),
//             ...(img.label ? { label: img.label.trim() } : {}),
//           };
//         }

//         return null;
//       })
//       .filter(Boolean);

//     const normalizedMobile = resolvedMobile
//       ? normalizeNZPhone(resolvedMobile)
//       : null;

//     const normalizedLandline = resolvedLandline
//       ? normalizeNZPhone(resolvedLandline)
//       : null;

//     const allowedMethods = ["mobile", "landline", "email"];

//     const normalizedPreferredContactMethod = allowedMethods.includes(
//       preferred_contact_method
//     )
//       ? preferred_contact_method
//       : normalizedMobile
//       ? "mobile"
//       : normalizedLandline
//       ? "landline"
//       : "email";

//     let uuid;
//     let exists;

//     do {
//       uuid = generatePrefixedId("Q", 8);
//       exists = await Quote.findByUUID(uuid);
//     } while (exists);

//     const actionToken = crypto.randomBytes(32).toString("hex");
//     const actionTokenHash = crypto
//       .createHash("sha256")
//       .update(actionToken)
//       .digest("hex");

//     const tokenExpiresAt = new Date();
//     tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 2);

//     const newQuoteData = {
//       uuid,
//       customer_uuid: resolvedCustomerUuid,
//       contact_first_name: resolvedFirstName,
//       contact_last_name: resolvedLastName,
//       contact_mobile: normalizedMobile,
//       contact_landline: normalizedLandline,
//       preferred_contact_method: normalizedPreferredContactMethod,
//       contact_email: resolvedEmail,
//       message: message?.trim() || null,
//       services: cleanedServices,
//       subtotal_amount: 0,
//       gst_amount: 0,
//       total_amount: 0,
//       status: "draft",
//       has_urgent_fee: isUrgentRequested,
//       urgent_fee_amount: isUrgentRequested ? URGENT_FEE_AMOUNT : 0,
//       is_quote_sent_to_client: false,
//       quote_sent_at: null,
//       address: resolvedAddress,
//       images: cleanedImages,
//       responded_at: null,
//       sent_by_user_uuid: actorUserUuid,
//       recurrence_frequency: normalizedRecurrenceFrequency,
//     };

//     newQuote = await Quote.create(newQuoteData);

//     if (!newQuote) {
//       return res.status(500).json({ error: "Failed to create quote" });
//     }

//     await createChangeLogSafe({
//       table_name: "quotes",
//       record_uuid: newQuote.uuid,
//       user_uuid: actorUserUuid,
//       action: "create",
//       summary: actorUserUuid
//         ? `Quote ${newQuote.uuid} created by logged-in user`
//         : `Quote ${newQuote.uuid} created from public form`,
//       changed_fields: {
//         uuid: { old: null, new: newQuote.uuid },
//         customer_uuid: { old: null, new: resolvedCustomerUuid },
//         contact_first_name: { old: null, new: resolvedFirstName },
//         contact_last_name: { old: null, new: resolvedLastName },
//         contact_mobile: { old: null, new: normalizedMobile },
//         contact_landline: { old: null, new: normalizedLandline },
//         preferred_contact_method: {
//           old: null,
//           new: normalizedPreferredContactMethod,
//         },
//         contact_email: { old: null, new: resolvedEmail },
//         message: { old: null, new: message?.trim() || null },
//         address: { old: null, new: resolvedAddress },
//         services: { old: null, new: cleanedServices },
//         images: { old: null, new: cleanedImages },
//         status: { old: null, new: "draft" },
//         is_quote_sent_to_client: { old: null, new: false },
//         sent_by_user_uuid: { old: null, new: actorUserUuid },
//         recurrence_frequency: {
//           old: null,
//           new: normalizedRecurrenceFrequency,
//         },
//         has_urgent_fee: { old: null, new: isUrgentRequested },
//         urgent_fee_amount: {
//           old: null,
//           new: isUrgentRequested ? URGENT_FEE_AMOUNT : 0,
//         },
//       },
//       source,
//     });

//     let tokenUuid;
//     let existsToken;

//     do {
//       tokenUuid = generatePrefixedId("QT", 7);
//       existsToken = await QuoteAccessToken.findByUUID(tokenUuid);
//     } while (existsToken);

//     quoteAccessToken = await QuoteAccessToken.create({
//       quote_uuid: newQuote.uuid,
//       token_hash: actionTokenHash,
//       expires_at: tokenExpiresAt,
//       uuid: tokenUuid,
//     });

//     const employeeLink = `${process.env.CLIENT_URL}/employee/quotes/${uuid}`;
//     const subjectHeader = `New Quote Request from ${formatFullName(
//       resolvedFirstName,
//       resolvedLastName,
//       false
//     )} Quote #${uuid}`;

//     await sendQuoteToBusiness({
//       quoteUuid: uuid,
//       firstName: formatFullName(resolvedFirstName, null, true),
//       lastName: formatFullName(null, resolvedLastName, true),
//       mobile: normalizedMobile ?? "-",
//       landline: normalizedLandline ?? "-",
//       email: resolvedEmail,
//       message: message?.trim() || null,
//       services: cleanedServices,
//       images: cleanedImages,
//       employeeLink,
//       address: resolvedAddress,
//       recurrenceFrequency: normalizedRecurrenceFrequency,
//       subjectHeader,
//       has_urgent_fee: isUrgentRequested,
//       urgent_fee_amount: isUrgentRequested ? URGENT_FEE_AMOUNT : 0,
//     });

//     return res.status(201).json({ data: newQuote });
//   } catch (error) {
//     console.error(error);

//     if (quoteAccessToken?.uuid) {
//       try {
//         await QuoteAccessToken.revokeToken(quoteAccessToken.uuid);
//       } catch (err) {
//         console.error("Rollback token failed:", err);
//       }
//     }

//     if (newQuote?.uuid) {
//       try {
//         await Quote.hardDelete(newQuote.uuid);
//       } catch (err) {
//         console.error("Rollback quote failed:", err);
//       }
//     }

//     return res.status(500).json({ error: "Server error" });
//   }
// };

// Update by UUID


export const createQuote = async (req, res) => {
  let newQuote = null;
  let quoteAccessToken = null;
  let uploadedImages = [];

  try {
    const files = Array.isArray(req.files) ? req.files : [];

    const {
      customer_uuid,
      first_name,
      last_name,
      mobile,
      landline,
      preferred_contact_method,
      email,
      message,
      address,
      recurrence_frequency,
      urgent,
    } = req.body;

    const services = Array.isArray(req.body.services)
      ? req.body.services
      : parseJSONField(req.body.services, []);

    const imageLabels = Array.isArray(req.body.image_labels)
      ? req.body.image_labels
      : req.body.image_labels
      ? [req.body.image_labels]
      : [];

    const isUrgentRequested = urgent === true || urgent === "true";
    const actorUserUuid = req.user?.uuid || null;

    let actorUser = null;
    let actorCustomer = null;
    let existingCustomer = null;

    let source = "public_form";

    if (actorUserUuid) {
      actorUser = await User.findByUUID(actorUserUuid);

      if (actorUser?.role === "customer") {
        source = "customer_portal";

        if (actorUser.customer_uuid) {
          actorCustomer = await Customer.findByUUID(actorUser.customer_uuid);
        }
      } else {
        source = "dashboard";
      }
    }

    const resolvedFirstName = (
      first_name?.trim() ||
      actorCustomer?.first_name ||
      actorUser?.first_name ||
      ""
    ).trim();

    const resolvedLastName = (
      last_name?.trim() ||
      actorCustomer?.last_name ||
      actorUser?.last_name ||
      ""
    ).trim();

    const resolvedEmail = (
      email?.trim().toLowerCase() ||
      actorCustomer?.email ||
      actorUser?.email ||
      null
    );

    const resolvedMobile =
      mobile?.trim() || actorCustomer?.mobile_phone || null;

    const resolvedLandline =
      landline?.trim() || actorCustomer?.landline_phone || null;

    const resolvedAddress = (
      address?.trim() ||
      actorCustomer?.address ||
      ""
    ).trim();

    const allowedRecurrenceFrequencies = [
      "one_off",
      "weekly",
      "fortnightly",
      "monthly",
    ];

    const normalizedRecurrenceFrequency = allowedRecurrenceFrequencies.includes(
      recurrence_frequency
    )
      ? recurrence_frequency
      : "one_off";

    if (!resolvedFirstName || !resolvedLastName) {
      return res.status(400).json({
        error: "First name and last name are required",
      });
    }

    if (!resolvedMobile && !resolvedLandline) {
      return res.status(400).json({
        error: "Please provide either a mobile or landline number",
      });
    }

    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({
        error: "At least one service is required",
      });
    }

    if (!resolvedAddress) {
      return res.status(400).json({
        error: "Address is required",
      });
    }

    if (resolvedEmail) {
      existingCustomer = await Customer.findByEmail(resolvedEmail);

      if (existingCustomer?.is_blacklisted) {
        return res.status(403).json({
          error: "We are unable to process this request at this time.",
          code: "CUSTOMER_BLACKLISTED",
        });
      }
    }

    const resolvedCustomerUuid =
      customer_uuid ||
      actorCustomer?.uuid ||
      actorUser?.customer_uuid ||
      existingCustomer?.uuid ||
      null;

    const cleanedServices = services
      .map((service) => {
        if (!service || typeof service !== "object") return null;

        const service_uuid =
          typeof service.service_uuid === "string"
            ? service.service_uuid.trim()
            : null;

        const code =
          typeof service.code === "string" ? service.code.trim() : null;

        const label =
          typeof service.label === "string" ? service.label.trim() : null;

        const description =
          typeof service.description === "string" && service.description.trim()
            ? service.description.trim()
            : null;

        const quantity =
          service.quantity !== undefined && service.quantity !== null
            ? Number(service.quantity)
            : null;

        const unit =
          typeof service.unit === "string" ? service.unit.trim() : null;

        const unit_price =
          service.unit_price !== undefined && service.unit_price !== null
            ? Number(service.unit_price)
            : null;

        const line_total =
          service.line_total !== undefined && service.line_total !== null
            ? Number(service.line_total)
            : null;

        if (!service_uuid && !code && !label) return null;

        return {
          service_uuid,
          code,
          label,
          description,
          quantity,
          unit,
          unit_price,
          line_total,
        };
      })
      .filter(Boolean);

    if (cleanedServices.length === 0) {
      return res.status(400).json({
        error: "At least one valid service is required",
      });
    }

    if (isUrgentRequested && cleanedServices.length !== 1) {
      return res.status(400).json({
        error:
          "Only 1 urgent request can be done per job. Please select one urgent-eligible service only.",
      });
    }

    if (isUrgentRequested) {
      const selectedService = cleanedServices[0];

      let dbService = null;

      try {
        if (selectedService.service_uuid) {
          dbService = await Service.getByUUID(selectedService.service_uuid);
        }

        if (!dbService && selectedService.code) {
          dbService = await Service.getByCode(selectedService.code);
        }
      } catch (serviceError) {
        console.error("Service validation failed:", serviceError);
        return res.status(400).json({
          error: "Selected service could not be validated.",
        });
      }

      if (!dbService) {
        return res.status(400).json({
          error: "Selected service could not be validated.",
        });
      }

      if (!dbService.is_active || dbService.is_deleted) {
        return res.status(400).json({
          error: "Selected service is not currently available.",
        });
      }

      if (!dbService.urgent_allowed) {
        return res.status(400).json({
          error: "Urgent booking is not available for the selected service.",
        });
      }
    }

    const normalizedMobile = resolvedMobile
      ? normalizeNZPhone(resolvedMobile)
      : null;

    const normalizedLandline = resolvedLandline
      ? normalizeNZPhone(resolvedLandline)
      : null;

    const allowedMethods = ["mobile", "landline", "email"];

    const normalizedPreferredContactMethod = allowedMethods.includes(
      preferred_contact_method
    )
      ? preferred_contact_method
      : normalizedMobile
      ? "mobile"
      : normalizedLandline
      ? "landline"
      : "email";

    let uuid;
    let exists;

    do {
      uuid = generatePrefixedId("Q", 8);
      exists = await Quote.findByUUID(uuid);
    } while (exists);

    if (files.length > 10) {
      return res.status(400).json({
        error: "You can upload a maximum of 10 images.",
      });
    }

    uploadedImages = [];

    for (let i = 0; i < files.length; i += 1) {
      const uploaded = await uploadImageToBucket({
        bucket: QUOTE_IMAGES_BUCKET,
        folder: `quotes/${uuid}`,
        file: files[i],
        index: i,
      });

      uploadedImages.push({
        label:
          typeof imageLabels[i] === "string" && imageLabels[i].trim()
            ? imageLabels[i].trim()
            : `Image ${i + 1}`,
        url: uploaded.url,
        path: uploaded.path,
        file_name: uploaded.file_name,
        mime_type: uploaded.mime_type,
        size: uploaded.size,
        uploaded_at: uploaded.uploaded_at,
      });
    }

    const actionToken = crypto.randomBytes(32).toString("hex");
    const actionTokenHash = crypto
      .createHash("sha256")
      .update(actionToken)
      .digest("hex");

    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 2);

    const newQuoteData = {
      uuid,
      customer_uuid: resolvedCustomerUuid,
      contact_first_name: resolvedFirstName,
      contact_last_name: resolvedLastName,
      contact_mobile: normalizedMobile,
      contact_landline: normalizedLandline,
      preferred_contact_method: normalizedPreferredContactMethod,
      contact_email: resolvedEmail,
      message: message?.trim() || null,
      services: cleanedServices,
      subtotal_amount: 0,
      gst_amount: 0,
      total_amount: 0,
      status: "draft",
      has_urgent_fee: isUrgentRequested,
      urgent_fee_amount: isUrgentRequested ? URGENT_FEE_AMOUNT : 0,
      is_quote_sent_to_client: false,
      quote_sent_at: null,
      address: resolvedAddress,
      images: uploadedImages,
      responded_at: null,
      sent_by_user_uuid: actorUserUuid,
      recurrence_frequency: normalizedRecurrenceFrequency,
    };

    newQuote = await Quote.create(newQuoteData);

    if (!newQuote) {
      throw new Error("Failed to create quote");
    }

    await createChangeLogSafe({
      table_name: "quotes",
      record_uuid: newQuote.uuid,
      user_uuid: actorUserUuid,
      action: "create",
      summary: actorUserUuid
        ? `Quote ${newQuote.uuid} created by logged-in user`
        : `Quote ${newQuote.uuid} created from public form`,
      changed_fields: {
        uuid: { old: null, new: newQuote.uuid },
        customer_uuid: { old: null, new: resolvedCustomerUuid },
        contact_first_name: { old: null, new: resolvedFirstName },
        contact_last_name: { old: null, new: resolvedLastName },
        contact_mobile: { old: null, new: normalizedMobile },
        contact_landline: { old: null, new: normalizedLandline },
        preferred_contact_method: {
          old: null,
          new: normalizedPreferredContactMethod,
        },
        contact_email: { old: null, new: resolvedEmail },
        message: { old: null, new: message?.trim() || null },
        address: { old: null, new: resolvedAddress },
        services: { old: null, new: cleanedServices },
        images: { old: null, new: uploadedImages },
        status: { old: null, new: "draft" },
        is_quote_sent_to_client: { old: null, new: false },
        sent_by_user_uuid: { old: null, new: actorUserUuid },
        recurrence_frequency: {
          old: null,
          new: normalizedRecurrenceFrequency,
        },
        has_urgent_fee: { old: null, new: isUrgentRequested },
        urgent_fee_amount: {
          old: null,
          new: isUrgentRequested ? URGENT_FEE_AMOUNT : 0,
        },
      },
      source,
    });

    let tokenUuid;
    let existsToken;

    do {
      tokenUuid = generatePrefixedId("QT", 7);
      existsToken = await QuoteAccessToken.findByUUID(tokenUuid);
    } while (existsToken);

    quoteAccessToken = await QuoteAccessToken.create({
      quote_uuid: newQuote.uuid,
      token_hash: actionTokenHash,
      expires_at: tokenExpiresAt,
      uuid: tokenUuid,
    });

    const employeeLink = `${process.env.CLIENT_URL}/employee/quotes/${uuid}`;
    const subjectHeader = `New Quote Request from ${formatFullName(
      resolvedFirstName,
      resolvedLastName,
      false
    )} Quote #${uuid}`;

    await sendQuoteToBusiness({
      quoteUuid: uuid,
      firstName: formatFullName(resolvedFirstName, null, true),
      lastName: formatFullName(null, resolvedLastName, true),
      mobile: normalizedMobile ?? "-",
      landline: normalizedLandline ?? "-",
      email: resolvedEmail,
      message: message?.trim() || null,
      services: cleanedServices,
      images: uploadedImages,
      employeeLink,
      address: resolvedAddress,
      recurrenceFrequency: normalizedRecurrenceFrequency,
      subjectHeader,
      has_urgent_fee: isUrgentRequested,
      urgent_fee_amount: isUrgentRequested ? URGENT_FEE_AMOUNT : 0,
    });

    return res.status(201).json({ data: newQuote });
  } catch (error) {
    console.error("createQuote error:", error);

    if (quoteAccessToken?.uuid) {
      try {
        await QuoteAccessToken.revokeToken(quoteAccessToken.uuid);
      } catch (err) {
        console.error("Rollback token failed:", err);
      }
    }

    if (newQuote?.uuid) {
      try {
        await Quote.hardDelete(newQuote.uuid);
      } catch (err) {
        console.error("Rollback quote failed:", err);
      }
    }

    if (uploadedImages.length) {
      await removeUploadedFiles({
        bucket: QUOTE_IMAGES_BUCKET,
        files: uploadedImages,
      });
    }

    return res.status(500).json({ error: "Server error" });
  }
};

export const updateQuoteByUUID = async (req, res) => {
  const { uuid } = req.params;
  
  if (!uuid) {
    return res.status(400).json({ message: "Quote uuid is required" });
  }
  
  const actorUserUuid = req.user?.uuid || null;
  try {
    const existingQuote = await Quote.findByUUID(uuid);

    if (!existingQuote) {
      return res.status(404).json({ message: "Quote not found" });
    }

    const {
      services,
      status,
      preferred_contact_method,
      contact_first_name,
      contact_last_name,
      contact_mobile,
      contact_landline,
      contact_email,
      expiry_end,
      employer_message,
    } = req.body;

    const allowedStatus = ["draft", "sent", "accepted", "expired", "rejected"];
    const allowedContact = ["mobile", "landline", "email"];

    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    if (
      preferred_contact_method &&
      !allowedContact.includes(preferred_contact_method)
    ) {
      return res.status(400).json({ message: "Invalid preferred contact method" });
    }

    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ message: "Services are required" });
    }

    for (const s of services) {
      if (typeof s.unit_price !== "number" || s.unit_price < 0) {
        return res.status(400).json({ message: "Invalid unit price" });
      }

      if (typeof s.quantity !== "number" || s.quantity <= 0) {
        return res.status(400).json({ message: "Invalid quantity" });
      }
    }

    const subtotal_amount = parseFloat(
      services.reduce((sum, s) => sum + s.unit_price * s.quantity, 0).toFixed(2)
    );
    const gst_amount = parseFloat((subtotal_amount * 0.15).toFixed(2));
    const total_amount = parseFloat((subtotal_amount + gst_amount).toFixed(2));

    const updateData = {
      services,
      subtotal_amount,
      gst_amount,
      total_amount,
      contact_first_name: contact_first_name ?? existingQuote.contact_first_name,
      contact_last_name: contact_last_name ?? existingQuote.contact_last_name,
      contact_mobile: contact_mobile ?? existingQuote.contact_mobile,
      contact_landline: contact_landline ?? existingQuote.contact_landline,
      contact_email: contact_email ?? existingQuote.contact_email,
      employer_message: employer_message ?? "",
    };

    if (status) {
      updateData.status = status;
    }

    if (preferred_contact_method) {
      updateData.preferred_contact_method = preferred_contact_method;
    }

    if (expiry_end) {
      updateData.expiry_end = new Date(expiry_end).toISOString();
    }

    const updated = await Quote.updateByUUID(uuid, updateData);

    if (!updated) {
      return res.status(400).json({
        message: `Failed to update quote with uuid: ${uuid}`,
      });
    }

    const changed_fields = {};

    for (const key of Object.keys(updateData)) {
      if (
        JSON.stringify(existingQuote?.[key] ?? null) !==
        JSON.stringify(updated?.[key] ?? null)
      ) {
        changed_fields[key] = {
          old: existingQuote?.[key] ?? null,
          new: updated?.[key] ?? null,
        };
      }
    }

    if (Object.keys(changed_fields).length > 0) {
      await createChangeLogSafe({
        table_name: "quotes",
        record_uuid: uuid,
        user_uuid: actorUserUuid,
        action: "update",
        summary: "Quote updated in database only.",
        changed_fields,
        source: "dashboard",
      });
    }

    return res.status(200).json({ quote: updated });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const updateQuoteByUUIDEmployee = async (req, res) => {
  const { uuid } = req.params;

  if (!uuid) {
    return res.status(400).json({ message: "Quote uuid is required" });
  }

  const actorUserUuid = req.user?.uuid || null;
  console.log({ actorUserUuid });

  let existingQuote;
  let quoteSnapshot = null;
  let filePath = null;

  try {
    existingQuote = await Quote.findByUUID(uuid);

    if (!existingQuote) {
      return res.status(404).json({
        message: `Quote not found with uuid: ${uuid}`,
      });
    }

    quoteSnapshot = JSON.parse(JSON.stringify(existingQuote));

    if (existingQuote.status !== "draft") {
      return res.status(400).json({
        message: "Quote cannot be dispatched in current state",
      });
    }

    if (existingQuote.is_quote_sent_to_client) {
      return res.status(400).json({
        message: "Quote has already been sent to client",
      });
    }

    const {
      services,
      subtotal_amount,
      gst_amount,
      total_amount,
      preferred_contact_method,
      contact_first_name,
      contact_last_name,
      contact_mobile,
      contact_landline,
      expiry_end,
      sent_by_user_uuid,
      employer_message,
      has_urgent_fee,
      urgent_fee_amount,
    } = req.body;

    const allowedContact = ["mobile", "landline", "email"];

    if (
      preferred_contact_method &&
      !allowedContact.includes(preferred_contact_method)
    ) {
      return res.status(400).json({
        message: "Invalid preferred contact method",
      });
    }

    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({
        message: "Services must be a non-empty array",
      });
    }

    for (const s of services) {
      if (typeof s.unit_price !== "number" || s.unit_price < 0) {
        return res.status(400).json({
          message: "Unit price must be a positive number",
        });
      }

      if (typeof s.quantity !== "number" || s.quantity <= 0) {
        return res.status(400).json({
          message: "Quantity must be greater than zero",
        });
      }
    }

    const servicesSubtotal = parseFloat(
      services.reduce((sum, s) => sum + s.unit_price * s.quantity, 0).toFixed(2)
    );

    const safeHasUrgentFee = Boolean(has_urgent_fee);
    const safeUrgentFee = safeHasUrgentFee
      ? parseFloat(Number(urgent_fee_amount ?? 0).toFixed(2))
      : 0;

    if (safeUrgentFee < 0) {
      return res.status(400).json({
        message: "Urgent fee must be zero or greater",
      });
    }

    const calcSubtotal = parseFloat((servicesSubtotal + safeUrgentFee).toFixed(2));
    const calcGST = parseFloat((calcSubtotal * 0.15).toFixed(2));
    const calcTotal = parseFloat((calcSubtotal + calcGST).toFixed(2));

    if (parseFloat(Number(subtotal_amount).toFixed(2)) !== calcSubtotal) {
      return res.status(400).json({
        message: "Subtotal mismatch",
        expected: calcSubtotal,
        received: subtotal_amount,
      });
    }

    if (parseFloat(Number(gst_amount).toFixed(2)) !== calcGST) {
      return res.status(400).json({
        message: "GST mismatch",
        expected: calcGST,
        received: gst_amount,
      });
    }

    if (parseFloat(Number(total_amount).toFixed(2)) !== calcTotal) {
      return res.status(400).json({
        message: "Total mismatch",
        expected: calcTotal,
        received: total_amount,
      });
    }

    const sentAt = new Date();

    const exactMinExpiryDate = new Date(
      sentAt.getTime() + MIN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    const allowCustomFromDate = new Date(
      sentAt.getTime() + (MIN_EXPIRY_DAYS + 1) * 24 * 60 * 60 * 1000
    );

    let expiry_end_date;

    if (expiry_end) {
      if (
        typeof expiry_end === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(expiry_end)
      ) {
        const [year, month, day] = expiry_end.split("-").map(Number);

        expiry_end_date = new Date(sentAt);
        expiry_end_date.setFullYear(year, month - 1, day);
      } else {
        expiry_end_date = new Date(expiry_end);
      }
    } else {
      expiry_end_date = new Date(exactMinExpiryDate);
    }

    if (Number.isNaN(expiry_end_date.getTime())) {
      return res.status(400).json({
        message: "Invalid expiry date",
      });
    }

    if (expiry_end_date < allowCustomFromDate) {
      expiry_end_date = new Date(exactMinExpiryDate);
    }

    const quoteSentAt = sentAt.toISOString();

    const activeTerms = await TermsAndConditions.findActive();

    if (!activeTerms) {
      return res.status(400).json({
        message: "No active terms and conditions found",
      });
    }

    if (!activeTerms.pdf_storage_path) {
      return res.status(400).json({
        message: "Active terms and conditions PDF is missing",
      });
    }

    const updatePayload = {
      services,
      subtotal_amount: calcSubtotal,
      gst_amount: calcGST,
      total_amount: calcTotal,
      has_urgent_fee: safeHasUrgentFee,
      urgent_fee_amount: safeUrgentFee,
      expiry_end: expiry_end_date.toISOString(),
      status: "sent",
      is_quote_sent_to_client: true,
      quote_sent_at: quoteSentAt,
      sent_by_user_uuid: sent_by_user_uuid ?? null,
      preferred_contact_method,
      contact_mobile,
      contact_landline,
      contact_first_name,
      contact_last_name,
      employer_message: employer_message ?? "",
      quote_version_reason: "employee_sent",
      terms_uuid: activeTerms.uuid,
      terms_version: activeTerms.version,
      terms_pdf_url: activeTerms.pdf_url ?? null,
    };

    let logoBuffer = null;

    try {
      const logoPath = path.join(process.cwd(), "assets", "happy-house-header.png");
      logoBuffer = fs.readFileSync(logoPath);
    } catch (err) {
      console.error("Logo load failed:", err.message);
    }

    const pdfBuffer = await generateQuotePDF(
      {
        ...existingQuote,
        ...updatePayload,
      },
      null,
      logoBuffer
    );

    const result = await Quote.dispatchQuote(uuid, { ...updatePayload }, pdfBuffer);
    const finalQuote = result.updated;
    filePath = result.filePath;

    const recipientEmail = finalQuote.contact_email?.trim().toLowerCase();

    if (!recipientEmail) {
      return res.status(400).json({
        message: "Contact email is required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(recipientEmail)) {
      return res.status(400).json({
        message: "Contact email is invalid",
      });
    }

    const termsPdfBuffer = await downloadTermsPDFBuffer(activeTerms.pdf_storage_path);

    await QuoteAccessToken.revokeAllForQuote(finalQuote.uuid);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const token_hash = hashToken(rawToken);

    let tokenUUID;
    let exists;

    do {
      tokenUUID = generatePrefixedId("QT", 7);
      exists = await QuoteAccessToken.findByUUID(tokenUUID);
    } while (exists);

    await QuoteAccessToken.create({
      quote_uuid: finalQuote.uuid,
      token_hash,
      expires_at: new Date(finalQuote.expiry_end).toISOString(),
      uuid: tokenUUID,
    });

    const quoteLink = `${process.env.CLIENT_URL}/quotes/view/${finalQuote.uuid}?token=${rawToken}`;

    await sendQuoteToClient({
      to: recipientEmail,
      subject: `Your Quote #${finalQuote.uuid} ${formatFullName(
        finalQuote.contact_first_name,
        finalQuote.contact_last_name,
        false
      )} is Ready`,
      data: {
        quoteUUID: finalQuote.uuid,
        name: formatFullName(
          finalQuote.contact_first_name,
          finalQuote.contact_last_name,
          false
        ),
        mobile: finalQuote.contact_mobile ?? "",
        landline: finalQuote.contact_landline ?? "",
        message: finalQuote.message ?? "",
        email: recipientEmail,
        subtotal: finalQuote.subtotal_amount,
        gst: finalQuote.gst_amount,
        total: finalQuote.total_amount,
        services: finalQuote.services,
        images: finalQuote.images,
        quoteLink,
        quotePdfUrl: finalQuote.quote_pdf_url ?? "",
        expiry: formatExpiry(finalQuote.expiry_end),
        employer_message: finalQuote.employer_message ?? "",
        has_urgent_fee: finalQuote.has_urgent_fee,
        urgent_fee_amount: finalQuote.urgent_fee_amount,
        termsVersion: activeTerms.version ?? "",
        termsTitle: activeTerms.title ?? "",
        termsUrl: activeTerms.pdf_url ?? "",
        termsSummary: activeTerms.short_summary ?? "",
      },
      pdfBuffer,
      termsPdfBuffer,
      termsFileName: `terms-and-conditions-${activeTerms.version}.pdf`,
    });

    const fieldsToTrack = [
      "services",
      "subtotal_amount",
      "gst_amount",
      "total_amount",
      "expiry_end",
      "status",
      "is_quote_sent_to_client",
      "quote_sent_at",
      "sent_by_user_uuid",
      "preferred_contact_method",
      "contact_mobile",
      "contact_landline",
      "contact_first_name",
      "contact_last_name",
      "employer_message",
      "quote_version_reason",
      "quote_pdf_url",
      "quote_pdf_storage_path",
      "pdf_version",
      "quote_pdf_version",
      "terms_uuid",
      "terms_version",
      "terms_pdf_url",
      "has_urgent_fee",
      "urgent_fee_amount",
    ];

    const changed_fields = {};

    for (const field of fieldsToTrack) {
      const beforeValue = quoteSnapshot?.[field] ?? null;
      const afterValue = finalQuote?.[field] ?? null;

      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
        changed_fields[field] = {
          old: beforeValue,
          new: afterValue,
        };
      }
    }

    await createChangeLogSafe({
      table_name: "quotes",
      record_uuid: finalQuote.uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary:
        "Employee updated draft quote, generated PDF, attached T&C PDF, and sent quote to client",
      changed_fields,
      source: "dashboard",
    });

    return res.status(200).json({
      message: "Quote updated and sent successfully",
      quote: finalQuote,
    });
  } catch (error) {
    console.error(error);

    if (quoteSnapshot) {
      try {
        await Quote.updateByUUID(uuid, quoteSnapshot);
      } catch (rollbackError) {
        console.error("Database rollback failed:", rollbackError);
      }
    }

    try {
      await QuoteAccessToken.revokeAllForQuote(uuid);
    } catch (e) {
      console.error("Token rollback failed:", e);
    }

    if (filePath) {
      try {
        await supabase.storage.from("quotes-pdf").remove([filePath]);
      } catch (storageError) {
        console.error("Storage rollback failed:", storageError);
      }
    }

    return res.status(500).json({
      error: error.message || "Failed to finalize quote",
    });
  }
};

// Update by ID
export const updateQuoteById = async (req, res) => {
  const { id } = req.params;
  const actorUserUuid = req.user?.uuid || null;

  try {
    const existing = await Quote.findById(id);
    if (!existing) {
      return res.status(404).json({ error: "Quote not found" });
    }

    const updated = await Quote.updateById(id, req.body);

    const changed_fields = {};
    for (const key of Object.keys(req.body || {})) {
      if (JSON.stringify(existing?.[key] ?? null) !== JSON.stringify(updated?.[key] ?? null)) {
        changed_fields[key] = {
          old: existing?.[key] ?? null,
          new: updated?.[key] ?? null,
        };
      }
    }

    if (Object.keys(changed_fields).length > 0) {
      await createChangeLogSafe({
        table_name: "quotes",
        record_uuid: updated.uuid,
        user_uuid: actorUserUuid,
        action: "update",
        summary: "Quote updated by ID.",
        changed_fields,
        source: "dashboard",
      });
    }

    return res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Soft delete
export const softDeleteQuote = async (req, res) => {
  const { uuid } = req.params;
  const actorUserUuid = req.user?.uuid || null;

  if (!uuid) {
    return res.status(400).json({ error: "Quote UUID is required" });
  }

  try {
    const quote = await Quote.findByUUID(uuid);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    if (quote.is_deleted || quote.deleted_at) {
      return res.status(200).json({
        message: "Quote already deleted",
        data: quote,
      });
    }

    const deleted = await Quote.softDelete(uuid);

    await createChangeLogSafe({
      table_name: "quotes",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "delete",
      summary: "Quote soft deleted.",
      changed_fields: {
        is_deleted: {
          old: quote.is_deleted ?? false,
          new: deleted.is_deleted ?? true,
        },
        deleted_at: {
          old: quote.deleted_at ?? null,
          new: deleted.deleted_at ?? new Date().toISOString(),
        },
        previous_status: {
          old: quote.previous_status ?? null,
          new: deleted.previous_status ?? quote.status ?? null,
        },
      },
      source: "dashboard",
    });

    return res.status(200).json({
      message: "Quote soft-deleted",
      data: deleted,
    });
  } catch (error) {
    console.error("Soft delete quote failed:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const restoreQuote = async (req, res) => {
  const { uuid } = req.params;
  const actorUserUuid = req.user?.uuid || null;

  if (!uuid) {
    return res.status(400).json({ error: "Quote UUID is required" });
  }

  try {
    const quote = await Quote.findByUUID(uuid);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    if (!quote.is_deleted && !quote.deleted_at) {
      return res.status(400).json({
        error: "Quote is not deleted, nothing to restore",
      });
    }

    const restored = await Quote.restore(uuid);

    await createChangeLogSafe({
      table_name: "quotes",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "Quote restored.",
      changed_fields: {
        is_deleted: {
          old: quote.is_deleted ?? true,
          new: restored.is_deleted ?? false,
        },
        deleted_at: {
          old: quote.deleted_at ?? null,
          new: restored.deleted_at ?? null,
        },
        status: {
          old: quote.status ?? null,
          new: restored.status ?? quote.previous_status ?? null,
        },
      },
      source: "dashboard",
    });

    return res.status(200).json({
      message: "Quote restored successfully",
      data: restored,
    });
  } catch (error) {
    console.error("Restore quote failed:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

export const reinstateQuote = async (req, res) => {
  const { uuid } = req.params;
  const actorUserUuid = req.user?.uuid || null;

  try {
    const existing = await Quote.findByUUID(uuid);
    if (!existing) {
      return res.status(404).json({ error: "Quote not found" });
    }

    const reinstated = await Quote.reinstate(uuid);

    await createChangeLogSafe({
      table_name: "quotes",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "Quote reinstated.",
      changed_fields: {
        is_deleted: {
          old: existing.is_deleted ?? true,
          new: reinstated.is_deleted ?? false,
        },
        deleted_at: {
          old: existing.deleted_at ?? null,
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

export const hardDeleteQuote = async (req, res) => {
  const { uuid } = req.params;
  const actorUserUuid = req.user?.uuid || null;

  if (!uuid) {
    return res.status(400).json({ error: "Quote UUID is required" });
  }

  try {
    const quote = await Quote.findByUUID(uuid);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    const deleted = await Quote.hardDelete(uuid);

    await createChangeLogSafe({
      table_name: "quotes",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "delete",
      summary: "Quote permanently deleted.",
      changed_fields: {
        deleted_record: {
          uuid: quote.uuid,
          customer_uuid: quote.customer_uuid,
          status: quote.status,
          contact_first_name: quote.contact_first_name,
          contact_last_name: quote.contact_last_name,
          contact_email: quote.contact_email,
          total_amount: quote.total_amount,
          quote_pdf_url: quote.quote_pdf_url,
        },
      },
      source: "dashboard",
    });

    return res.status(200).json({
      message: "Quote permanently deleted",
      data: deleted,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};


// export const acceptQuote = async (req, res) => {
//   const { uuid } = req.params;
//   const { token, customer_uuid } = req.body;

//   const actorUserUuid = req.user?.uuid || null;

//   if (!uuid) {
//     return res.status(400).json({ error: "Quote UUID is required" });
//   }

//   if (!token) {
//     return res.status(401).json({ error: "Token required" });
//   }

//   let customerCreated = false;
//   let jobCreated = false;
//   let customer = null;
//   let job = null;

//   try {
//     const quote = await Quote.findByUUID(uuid);

//     if (!quote) {
//       return res.status(404).json({ error: "Quote not found" });
//     }

//     if (quote.responded_at) {
//       return res.status(400).json({
//         error: "Quote already responded to",
//         responded_at: quote.responded_at,
//       });
//     }

//     if (!quote.terms_uuid || !quote.terms_version) {
//       return res.status(400).json({
//         error: "Quote terms reference is missing",
//       });
//     }

//     const tokenHash = hashToken(token);
//     const tokenRecord = await QuoteAccessToken.findByTokenHash(tokenHash);

//     if (!tokenRecord || tokenRecord.quote_uuid !== quote.uuid) {
//       return res.status(401).json({ error: "Invalid token" });
//     }

//     if (new Date(tokenRecord.expires_at) < new Date()) {
//       return res.status(401).json({ error: "Token expired" });
//     }

//     if (!quote.contact_email?.trim()) {
//       return res.status(400).json({ error: "Quote email is required" });
//     }

//     const email = quote.contact_email.trim().toLowerCase();

//     // ---------------- CUSTOMER ----------------

//     if (customer_uuid) {
//       const selectedCustomer = await Customer.findByUUID(customer_uuid);

//       if (!selectedCustomer) {
//         return res.status(404).json({
//           error: "Customer not found",
//         });
//       }

//       customer = selectedCustomer;
//     } else {
//       customer = await Customer.findByEmail(email);

//       if (!customer) {
//         let customerUUID;

//         while (true) {
//           customerUUID = generatePrefixedId("C", 8);
//           const exists = await Customer.findByUUID(customerUUID);
//           if (!exists) break;
//         }

//         customer = await Customer.create({
//           uuid: customerUUID,
//           first_name: quote.contact_first_name ?? null,
//           last_name: quote.contact_last_name ?? null,
//           email,
//           mobile_phone: quote.contact_mobile ?? null,
//           landline_phone: quote.contact_landline ?? null,
//           address: quote.address ?? null,
//           created_by_uuid: actorUserUuid || null,
//           created_via: "quote_accept",
//         });

//         customerCreated = true;
//       }
//     }

//     // ---------------- JOB ----------------

//     const existingJob = await Job.findJobByQuoteUUID(quote.uuid);

//     if (existingJob) {
//       return res.status(400).json({
//         error: "A job already exists for this quote",
//         job_uuid: existingJob.uuid,
//       });
//     }

//     const normalizedRecurrenceFrequency = quote.recurrence_frequency || "one_off";

//     const isRecurring = normalizedRecurrenceFrequency !== "one_off";

//     const recurrenceInterval =
//       normalizedRecurrenceFrequency === "weekly"
//         ? 1
//         : normalizedRecurrenceFrequency === "fortnightly"
//         ? 2
//         : normalizedRecurrenceFrequency === "monthly"
//         ? 1
//         : null;

//     let jobUUID;

//     while (true) {
//       jobUUID = generatePrefixedId("J", 8);
//       const exists = await Job.findByUUID(jobUUID);
//       if (!exists) break;
//     }

//     job = await Job.createFromQuote({
//       quote,
//       uuid: jobUUID,
//       customer_uuid: customer.uuid,
//       scheduled_at: null,
//       is_recurring: isRecurring,
//       recurrence_interval: recurrenceInterval,
//       recurrence_frequency: normalizedRecurrenceFrequency,
//       recurrence_end_date: null,
//     });

//     jobCreated = true;

//     // ---------------- ACCEPT QUOTE ----------------

//     const acceptedAt = new Date().toISOString();

//     const acceptedQuote = await Quote.acceptQuote(uuid, customer.uuid, {
//       accepted_terms_at: acceptedAt,
//       terms_accepted_ip: req.ip || null,
//       terms_accepted_user_agent: req.headers["user-agent"] || null,
//     });

//     // ---------------- TERMS ACCEPTANCE ----------------

//     const acceptanceRecord = await createQuoteTermsAcceptanceRecord({
//       quote,
//       req,
//       acceptedAt,
//     });

//     // ---------------- RESPONSE ----------------

//     return res.status(200).json({
//       message: "Quote accepted successfully",
//       quote: acceptedQuote,
//       customer,
//       job,
//       terms_acceptance: acceptanceRecord,
//     });

//   } catch (error) {
//     console.error("Accept quote error:", error);

//     if (jobCreated && job?.uuid) {
//       await Job.deleteByUUID(job.uuid).catch(console.error);
//     }

//     if (customerCreated && customer?.uuid) {
//       await Customer.deleteByUUID(customer.uuid).catch(console.error);
//     }

//     return res.status(500).json({ error: error.message });
//   }
// };

// export const acceptQuote = async (req, res) => {
//   const { uuid } = req.params;
//   const { customer_uuid } = req.body;

//   const actorUserUuid = req.user?.uuid || null;
//   const sessionToken = req.cookies?.quote_session;

//   if (!uuid) {
//     return res.status(400).json({ error: "Quote UUID is required" });
//   }

//   if (!sessionToken) {
//     return res.status(401).json({ error: "No active quote session" });
//   }

//   let customerCreated = false;
//   let jobCreated = false;
//   let customer = null;
//   let job = null;

//   const clearQuoteSession = () => {
//     res.clearCookie("quote_session", {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "lax",
//       path: "/",
//     });
//   };

//   try {
//     const quote = await Quote.findByUUID(uuid);

//     if (!quote) {
//       clearQuoteSession();
//       return res.status(404).json({ error: "Quote not found" });
//     }

//     if (quote.responded_at) {
//       return res.status(400).json({
//         error: "Quote already responded to",
//         responded_at: quote.responded_at,
//       });
//     }

//     if (!quote.terms_uuid || !quote.terms_version) {
//       return res.status(400).json({
//         error: "Quote terms reference is missing",
//       });
//     }

//     const tokenHash = hashToken(sessionToken);
//     const tokenRecord = await QuoteAccessToken.findByTokenHash(tokenHash);

//     if (!tokenRecord) {
//       clearQuoteSession();
//       return res.status(401).json({ error: "Invalid or expired session" });
//     }

//     if (tokenRecord.quote_uuid !== quote.uuid) {
//       clearQuoteSession();
//       return res.status(403).json({
//         error: "Session does not match requested quote",
//       });
//     }

//     if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
//       clearQuoteSession();
//       return res.status(401).json({ error: "Session expired" });
//     }

//     const quoteExpiry = new Date(quote.expiry_end);
//     if (Number.isNaN(quoteExpiry.getTime()) || quoteExpiry < new Date()) {
//       clearQuoteSession();
//       return res.status(401).json({ error: "Quote expired" });
//     }

//     if (!quote.contact_email?.trim()) {
//       return res.status(400).json({ error: "Quote email is required" });
//     }

//     const email = quote.contact_email.trim().toLowerCase();

//     // ---------------- CUSTOMER ----------------

//     if (customer_uuid) {
//       const selectedCustomer = await Customer.findByUUID(customer_uuid);

//       if (!selectedCustomer) {
//         return res.status(404).json({
//           error: "Customer not found",
//         });
//       }

//       customer = selectedCustomer;
//     } else {
//       customer = await Customer.findByEmail(email);

//       if (!customer) {
//         let customerUUID;

//         while (true) {
//           customerUUID = generatePrefixedId("C", 8);
//           const exists = await Customer.findByUUID(customerUUID);
//           if (!exists) break;
//         }

//         customer = await Customer.create({
//           uuid: customerUUID,
//           first_name: quote.contact_first_name ?? null,
//           last_name: quote.contact_last_name ?? null,
//           email,
//           mobile_phone: quote.contact_mobile ?? null,
//           landline_phone: quote.contact_landline ?? null,
//           address: quote.address ?? null,
//           created_by_uuid: actorUserUuid || null,
//           created_via: "quote_accept",
//         });

//         customerCreated = true;
//       }
//     }

//     // ---------------- JOB ----------------

//     const existingJob = await Job.findJobByQuoteUUID(quote.uuid);

//     if (existingJob) {
//       return res.status(400).json({
//         error: "A job already exists for this quote",
//         job_uuid: existingJob.uuid,
//       });
//     }

//     const normalizedRecurrenceFrequency = quote.recurrence_frequency || "one_off";

//     const isRecurring = normalizedRecurrenceFrequency !== "one_off";

//     const recurrenceInterval =
//       normalizedRecurrenceFrequency === "weekly"
//         ? 1
//         : normalizedRecurrenceFrequency === "fortnightly"
//         ? 2
//         : normalizedRecurrenceFrequency === "monthly"
//         ? 1
//         : null;

//     let jobUUID;

//     while (true) {
//       jobUUID = generatePrefixedId("J", 8);
//       const exists = await Job.findByUUID(jobUUID);
//       if (!exists) break;
//     }

//     job = await Job.createFromQuote({
//       quote,
//       uuid: jobUUID,
//       customer_uuid: customer.uuid,
//       scheduled_at: null,
//       is_recurring: isRecurring,
//       recurrence_interval: recurrenceInterval,
//       recurrence_frequency: normalizedRecurrenceFrequency,
//       recurrence_end_date: null,
//     });

//     jobCreated = true;

//     // ---------------- ACCEPT QUOTE ----------------

//     const acceptedAt = new Date().toISOString();

//     const acceptedQuote = await Quote.acceptQuote(uuid, customer.uuid, {
//       accepted_terms_at: acceptedAt,
//       terms_accepted_ip: req.ip || null,
//       terms_accepted_user_agent: req.headers["user-agent"] || null,
//     });

//     // ---------------- TERMS ACCEPTANCE ----------------

//     const acceptanceRecord = await createQuoteTermsAcceptanceRecord({
//       quote,
//       req,
//       acceptedAt,
//     });

//     // optional: keep cookie until quote expiry, or clear it here if you want
//     // clearQuoteSession();

//     return res.status(200).json({
//       message: "Quote accepted successfully",
//       quote: acceptedQuote,
//       customer,
//       job,
//       terms_acceptance: acceptanceRecord,
//     });
//   } catch (error) {
//     console.error("Accept quote error:", error);

//     if (jobCreated && job?.uuid) {
//       await Job.deleteByUUID(job.uuid).catch(console.error);
//     }

//     if (customerCreated && customer?.uuid) {
//       await Customer.deleteByUUID(customer.uuid).catch(console.error);
//     }

//     return res.status(500).json({ error: error.message });
//   }
// };

export const acceptQuote = async (req, res) => {
  const { uuid } = req.params;
  const { customer_uuid } = req.body;

  const actorUserUuid = req.user?.uuid || null;
  const sessionToken = req.cookies?.quote_session;

  if (!uuid) {
    return res.status(400).json({ error: "Quote UUID is required" });
  }

  if (!sessionToken) {
    return res.status(401).json({ error: "No active quote session" });
  }

  let customerCreated = false;
  let jobCreated = false;
  let customer = null;
  let job = null;

  const clearQuoteSession = () => {
    res.clearCookie("quote_session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  };

  try {
    const quote = await Quote.findByUUID(uuid);

    if (!quote) {
      clearQuoteSession();
      return res.status(404).json({ error: "Quote not found" });
    }

    if (quote.responded_at) {
      return res.status(400).json({
        error: "Quote already responded to",
        responded_at: quote.responded_at,
      });
    }

    if (!quote.terms_uuid || !quote.terms_version) {
      return res.status(400).json({
        error: "Quote terms reference is missing",
      });
    }

    const tokenHash = hashToken(sessionToken);
    const tokenRecord = await QuoteAccessToken.findByTokenHash(tokenHash);

    if (!tokenRecord) {
      clearQuoteSession();
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    if (tokenRecord.quote_uuid !== quote.uuid) {
      clearQuoteSession();
      return res.status(403).json({
        error: "Session does not match requested quote",
      });
    }

    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      clearQuoteSession();
      return res.status(401).json({ error: "Session expired" });
    }

    const quoteExpiry = new Date(quote.expiry_end);
    if (Number.isNaN(quoteExpiry.getTime()) || quoteExpiry < new Date()) {
      clearQuoteSession();
      return res.status(401).json({ error: "Quote expired" });
    }

    if (!quote.contact_email?.trim()) {
      return res.status(400).json({ error: "Quote email is required" });
    }

    const email = quote.contact_email.trim().toLowerCase();

    // ---------------- CUSTOMER ----------------

    if (customer_uuid) {
      const selectedCustomer = await Customer.findByUUID(customer_uuid);

      if (!selectedCustomer) {
        return res.status(404).json({
          error: "Customer not found",
        });
      }

      customer = selectedCustomer;
    } else {
      customer = await Customer.findByEmail(email);

      if (!customer) {
        let customerUUID;

        while (true) {
          customerUUID = generatePrefixedId("C", 8);
          const exists = await Customer.findByUUID(customerUUID);
          if (!exists) break;
        }

        customer = await Customer.create({
          uuid: customerUUID,
          first_name: quote.contact_first_name ?? null,
          last_name: quote.contact_last_name ?? null,
          email,
          mobile_phone: quote.contact_mobile ?? null,
          landline_phone: quote.contact_landline ?? null,
          address: quote.address ?? null,
          created_by_uuid: actorUserUuid || null,
          created_via: "quote_accept",
        });

        customerCreated = true;
      }
    }

    // ---------------- JOB ----------------  
    const existingJob = await Job.findJobByQuoteUUID(quote.uuid);

    if (existingJob) {
      return res.status(400).json({
        error: "A job already exists for this quote",
        job_uuid: existingJob.uuid,
      });
    }

    const normalizedRecurrenceFrequency = quote.recurrence_frequency || "one_off";

    const isRecurring = normalizedRecurrenceFrequency !== "one_off";

    const recurrenceInterval =
      normalizedRecurrenceFrequency === "weekly"
        ? 1
        : normalizedRecurrenceFrequency === "fortnightly"
        ? 2
        : normalizedRecurrenceFrequency === "monthly"
        ? 1
        : null;

    let jobUUID;

    while (true) {
      jobUUID = generatePrefixedId("J", 8);
      const exists = await Job.findByUUID(jobUUID);
      if (!exists) break;
    }

    job = await Job.createFromQuote({
      quote,
      uuid: jobUUID,
      customer_uuid: customer.uuid,
      scheduled_at: null,
      is_recurring: isRecurring,
      recurrence_interval: recurrenceInterval,
      recurrence_frequency: normalizedRecurrenceFrequency,
      recurrence_end_date: null,
    });

    jobCreated = true;

    // ---------------- ACCEPT QUOTE ----------------

    const acceptedAt = new Date().toISOString();

    const acceptedQuote = await Quote.acceptQuote(uuid, customer.uuid, {
      accepted_terms_at: acceptedAt,
      terms_accepted_ip: req.ip || null,
      terms_accepted_user_agent: req.headers["user-agent"] || null,
    });

    // ---------------- TERMS ACCEPTANCE ----------------

    const acceptanceRecord = await createQuoteTermsAcceptanceRecord({
      quote,
      req,
      acceptedAt,
    });

    // ---------------- EMAIL BUSINESS TO SCHEDULE ----------------

    try {
      const employeeScheduleLink = `${process.env.CLIENT_URL}/employee/jobs/uuid/${job.uuid}`;

      await sendQuoteAcceptedToBusiness({
        quoteUuid: acceptedQuote.uuid,
        jobUuid: job.uuid,
        firstName: acceptedQuote.contact_first_name,
        lastName: acceptedQuote.contact_last_name,
        mobile: acceptedQuote.contact_mobile,
        landline: acceptedQuote.contact_landline,
        email: acceptedQuote.contact_email,
        message: acceptedQuote.message,
        services: acceptedQuote.services || [],
        images: acceptedQuote.images || [],
        address: acceptedQuote.address,
        recurrenceFrequency: acceptedQuote.recurrence_frequency,
        has_urgent_fee: Boolean(acceptedQuote.has_urgent_fee),
        acceptedAt,
        employeeScheduleLink,
      });
    } catch (emailError) {
      console.error("Failed to send quote accepted business email:", emailError);
      // do not fail quote acceptance just because email failed
    }

    // optional:
    // clearQuoteSession();

    return res.status(200).json({
      message: "Quote accepted successfully",
      quote: acceptedQuote,
      customer,
      job,
      terms_acceptance: acceptanceRecord,
    });
  } catch (error) {
    console.error("Accept quote error:", error);

    if (jobCreated && job?.uuid) {
      await Job.deleteByUUID(job.uuid).catch(console.error);
    }

    if (customerCreated && customer?.uuid) {
      await Customer.deleteByUUID(customer.uuid).catch(console.error);
    }

    return res.status(500).json({ error: error.message });
  }
};

export const rejectQuote = async (req, res) => {
  const { uuid } = req.params;
  const { token } = req.body;
  const actorUserUuid = req.user?.uuid || null;

  if (!uuid) {
    return res.status(400).json({ error: "Quote UUID is required" });
  }

  try {
    const quote = await Quote.findByUUID(uuid);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    if (quote.responded_at) {
      return res.status(400).json({
        error: "Quote already responded to",
        responded_at: quote.responded_at,
      });
    }

    const hasSession = req.session && req.session.quote_uuid === uuid;

    if (!hasSession) {
      if (!token) {
        return res.status(401).json({ error: "No session or token provided" });
      }

      const tokenHash = hashToken(token);
      const tokenRecord = await QuoteAccessToken.findByTokenHash(tokenHash);

      if (!tokenRecord || tokenRecord.quote_uuid !== quote.uuid) {
        return res.status(401).json({ error: "Invalid token" });
      }

      if (new Date(tokenRecord.expires_at) < new Date()) {
        return res.status(401).json({ error: "Token expired" });
      }
    }

    const rejectedQuote = await Quote.rejectQuote(uuid);

    await QuoteAccessToken.revokeAllForQuote(quote.uuid);

    if (req.session) {
      req.session.destroy((err) => {
        if (err) console.error("Error destroying session:", err);
      });
    }

    res.clearCookie("quote_session", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });

    await createChangeLogSafe({
      table_name: "quotes",
      record_uuid: rejectedQuote.uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "Quote rejected by customer.",
      changed_fields: {
        status: {
          old: quote.status ?? null,
          new: rejectedQuote.status ?? "rejected",
        },
        responded_at: {
          old: quote.responded_at ?? null,
          new: rejectedQuote.responded_at ?? null,
        },
      },
      source: "customer_portal",
    });

    try {
      await sendQuoteRejected({ to: quote.contact_email, quote: rejectedQuote });
    } catch (err) {
      console.error("Failed to send rejection email:", err);
    }

    return res.status(200).json({
      message: "Quote rejected successfully",
      quote: rejectedQuote,
    });
  } catch (error) {
    console.error("Reject quote error:", error);
    return res.status(500).json({ error: error.message });
  }
};
// Extend quote
export const extendQuoteController = async (req, res) => {
  const { uuid } = req.params;
  const { newDate, addDays } = req.body;
  const actorUserUuid = req.user?.uuid || null;

  try {
    if (!uuid) return res.status(400).json({ error: "Quote UUID is required" });

    const quoteExists = await Quote.findByUUID(uuid);
    if (!quoteExists) {
      return res.status(404).json({ error: "Quote not found" });
    }

    if (!newDate && !addDays) {
      return res.status(400).json({ error: "Provide either newDate or addDays" });
    }

    const updatedQuote = await Quote.extendQuote(uuid, { newDate, addDays });

    await createChangeLogSafe({
      table_name: "quotes",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "Quote expiry extended.",
      changed_fields: {
        expiry_end: {
          old: quoteExists.expiry_end ?? null,
          new: updatedQuote.expiry_end ?? null,
        },
      },
      source: "dashboard",
    });

    return res.status(200).json({
      message: "Quote extended successfully",
      data: updatedQuote,
    });
  } catch (error) {
    console.error("Error extending quote:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const updateQuoteAndSendEmail = async (req, res) => {
  const { uuid } = req.params;
  const { services, total_amount, status } = req.body;
  const actorUserUuid = req.user?.uuid || null;

  try {
    const quote = await Quote.findByUUID(uuid);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    const updatedQuote = await Quote.update(uuid, {
      services,
      total_amount,
      status: status || "finalized",
    });

    await createChangeLogSafe({
      table_name: "quotes",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "Quote updated and email dispatch triggered.",
      changed_fields: {
        services: {
          old: quote.services ?? [],
          new: updatedQuote.services ?? [],
        },
        total_amount: {
          old: quote.total_amount ?? null,
          new: updatedQuote.total_amount ?? null,
        },
        status: {
          old: quote.status ?? null,
          new: updatedQuote.status ?? null,
        },
      },
      source: "dashboard",
    });

    // keep your existing email function if it exists elsewhere
    await sendQuoteEmail(updatedQuote);

    return res.status(200).json({ data: updatedQuote });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

export const deleteAllFilesFromBucket = async (req, res) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(403).json({ message: "Forbidden in production" });
  }

  if (req.method !== "DELETE") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const bucketName = "quote-images";

    const { data: files, error: listError } = await supabase.storage
      .from(bucketName)
      .list("", { limit: 1000 });

    if (listError) throw listError;

    const filePaths = files.map((file) => file.name);

    const { error: deleteError } = await supabase.storage
      .from(bucketName)
      .remove(filePaths);

    if (deleteError) throw deleteError;

    return res.status(200).json({ message: "All quote images deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export async function viewQuoteByToken(req, res) {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: "Missing access token" });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const accessToken = await QuoteAccessToken.findByTokenHash(tokenHash);

    if (!accessToken) {
      return res.status(404).json({ error: "Invalid or expired link" });
    }

    if (accessToken.expires_at < new Date()) {
      return res.status(410).json({ error: "This link has expired" });
    }

    const quote = await Quote.findById(accessToken.quote_id);

    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    await QuoteAccessToken.markViewed(accessToken.id);

    if (!quote.client_viewed_at) {
      await Quote.markClientViewed(quote.id);
    }

    return res.json({
      uuid: quote.uuid,
      status: quote.status,
      subtotal: quote.subtotal,
      gst: quote.gst,
      total: quote.total,
      services: quote.services,
      notes: quote.notes,
      valid_until: quote.valid_until,
      sent_at: quote.quote_sent_at,
      viewed_at: quote.client_viewed_at,
    });
  } catch (err) {
    console.error("viewQuoteByToken error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export const autoExpireQuote = async (req, res) => {
  const actorUserUuid = req.user?.uuid || null;

  try {
    const { uuid } = req.params;

    if (!uuid) {
      return res.status(400).json({
        error: "Quote UUID is required",
      });
    }

    const existingQuote = await Quote.findByUUID(uuid);
    if (!existingQuote) {
      return res.status(404).json({
        error: "Quote not found",
      });
    }

    const quote = await Quote.autoExpire(uuid);

    if (!quote) {
      return res.status(400).json({
        error: "Quote could not be auto expired",
      });
    }

    await createChangeLogSafe({
      table_name: "quotes",
      record_uuid: uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "Quote auto expired.",
      changed_fields: {
        status: {
          old: existingQuote.status ?? null,
          new: quote.status ?? "expired",
        },
      },
      source: "system",
    });

    return res.status(200).json({
      message: "Quote auto expired successfully",
      quote,
    });
  } catch (error) {
    console.error("Auto expire controller error:", error.message);

    return res.status(400).json({
      error: error.message || "Auto expire failed",
    });
  }
};

export const linkCustomerToQuote = async (req, res) => {
  const { uuid } = req.params;

  const actorUserUuid = req.user?.uuid;

  if (!actorUserUuid) {
    return res.status(401).json({ error: "Login required" });
  }

  try {
    const quote = await Quote.findByUUID(uuid);

    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    if (quote.customer_uuid) {
      return res.status(200).json({ quote });
    }

    const customer = await Customer.findByUserUUID(actorUserUuid);

    if (!customer) {
      return res.status(404).json({
        error: "Customer profile not found",
      });
    }

    if (quote.contact_email?.toLowerCase() !== customer.email?.toLowerCase()) {
      return res.status(403).json({
        error: "Quote email does not match account",
      });
    }

    const updatedQuote = await Quote.update(uuid, {
      customer_uuid: customer.uuid,
    });

    await createChangeLogSafe({
      table_name: "quotes",
      record_uuid: updatedQuote.uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "Quote linked to customer account",
      changed_fields: {
        customer_uuid: {
          old: null,
          new: customer.uuid,
        },
      },
      source: "customer_portal",
    });

    return res.status(200).json({ quote: updatedQuote });
  } catch (err) {
    console.error("Link quote error:", err);
    return res.status(500).json({ error: err.message });
  }
};