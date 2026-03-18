import Quote from "../models/Quote.js";
import Customer from "../models/Customer.js";
import QuoteAccessToken from "../models/QuoteAccessToken.js";
import Job from "../models/Job.js";
import ChangeLog from "../models/ChangeLog.js";
import crypto from "crypto";
import {
  generatePrefixedId, normalizeNZPhone, generateShortId,
  formatExpiry, formatFullName, dispatchQuoteToClient, hashToken, 
  obfuscateName, obfuscateEmail, generateQuotePDF, normalizedEmail, EMAIL_REGEX
} from "../util/util.js";
import { sendQuoteToBusiness, sendQuoteAccepted, sendQuoteRejected, sendQuoteToClient } from "../lib/email/index.js"; // adjust path
import supabase from '../config/db.js';
const MIN_EXPIRY_DAYS = 2;

const UUID_REGEX = /^[a-zA-Z0-9]{9}$/;

function assertUUID(uuid) {
  const u = String(uuid || "").trim();
  if (!u) throw new Error("Quote UUID is required");
  if (!UUID_REGEX.test(u)) throw new Error("UUID must be exactly 9 letters or numbers.");
  return u;
}

// GET /api/quotes/summary/:uuid
export const getQuoteSummaryByUUID = async (req, res) => {
  try {
    const uuid = assertUUID(req.params.uuid);
    if(!uuid){
      return res.status(400).json({ error: `Quote uuid is required.`});
    }
    console.log({uuid})
    const quote = await Quote.findSummaryByUUID(uuid);

    if (!quote) return res.status(404).json({ error: "Quote not found" });
    console.log({quote})
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
    if(!uuid){
      return res.status(400).json({ error: `Quote uuid is required.`});
    }
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
  if(!uuid){
    return res.status(400).json({ error: `Quote uuid is required.`});
  }
  try {
    const quote = await Quote.findByUUID(uuid);
    if(!quote){
      return res.status(404).json({ error: `Quote note found`});
    }
    
    let limitedQuote = {
      uuid: quote.uuid,
      contact_first_name: obfuscateName(quote.contact_first_name),
      contact_last_name: obfuscateName(quote.contact_last_name),
      responded_at: quote.responded_at,
      expiry_end: quote.expiry_end,
      services: quote.services.map(s => ({ label: s.label, quantity: s.quantity })),
      status: quote.status,
      subtotal_amount: quote.subtotal_amount,
      gst_amount: quote.gst_amount,
      total_amount: quote.total_amount,
      limited: true
    }

    return res.status(200).json({ quote: limitedQuote })
  } catch (error) {
    console.error("getQuotes error:", error);
    return res.status(500).json({ error: error.message });
  }
}

export const getQuotes = async (req, res) => {
  try {
    const { status = "draft", limit = 10, page = 1, olderThan } = req.query;

    const limitNum = Math.min(Number(limit) || 10, 100);
    const pageNum = Math.max(Number(page) || 1, 1);

    // default olderThan ONLY for expired if you want that behavior
    let olderThanNum;
    if (olderThan !== undefined && olderThan !== "") {
      olderThanNum = Math.max(Number(olderThan) || 0, 0);
    } else if (status === "expired") {
      olderThanNum = 7; // your default
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
//works fine 09/01/2026
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

// Create quote
// export const createQuote = async (req, res) => {
 
//   let newQuote = null;
//   let quoteAccessToken = null;
//   let foundCustomer = null;
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
//     } = req.body;

//     // ===== VALIDATION =====
//     const normalizedEmail = email?.trim().toLowerCase() || null;
//     //re-add email when production ready, currently allowing same email for testing purposes
//     // if (normalizedEmail && !EMAIL_REGEX.test(normalizedEmail)) {
//     //   return res.status(400).json({
//     //     error: "Please provide a valid email address",
//     //   });
//     // }

//     if (!first_name || !last_name) {
//       return res.status(400).json({ error: "First name and last name are required" });
//     }

//     if (!mobile && !landline) {
//       return res.status(400).json({ error: "Please provide either a mobile or landline number" });
//     }

//     if (!services || !Array.isArray(services) || services.length === 0) {
//       return res.status(400).json({ error: "At least one service is required" });
//     }

//     if (!address) {
//       return res.status(400).json({ error: "Address is required" });
//     }
    
//     // foundCustomer = await Customer.findByEmail(normalizedEmail);
//     // ===== CLEAN IMAGES =====
//     const cleanedImages = (images || [])
//       .map(img => {
//         if (typeof img === "string") return { url: img };
//         if (img && typeof img.url === "string") return img;
//         return null;
//       })
//       .filter(Boolean);

//     // ===== GENERATE UNIQUE UUID =====
//     let uuid;
//     let exists;
//     do {
//       uuid = generatePrefixedId(8, "Q");
//       exists = await Quote.findByUUID(uuid);
//     } while (exists);

//     // ===== GENERATE SECURE ACTION TOKEN =====
//     const actionToken = crypto.randomBytes(32).toString("hex");
//     const actionTokenHash = crypto.createHash("sha256").update(actionToken).digest("hex");

//     const tokenExpiresAt = new Date();
//     tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 2); 

//     const newQuoteData = {
//       uuid,
//       // customer_uuid: foundCustomer?.uuid || null, //add again when production ready, currently allowing creation without customer for testing purposes
//       customer_uuid: customer_uuid || null,
//       contact_first_name: first_name.toLowerCase(),
//       contact_last_name: last_name.toLowerCase(),
//       contact_mobile: mobile ? normalizeNZPhone(mobile) : null,
//       contact_landline: landline ? normalizeNZPhone(landline) : null,
//       preferred_contact_method: preferred_contact_method || "email",
//       contact_email: normalizedEmail,
//       message: message || null,
//       services,
//       total_amount: 0,
//       status: "draft", 
//       is_quote_sent_to_client: false,
//       quote_sent_at: null,
//       address,
//       images: cleanedImages,
//       responded_at: null,
//     };

//     newQuote = await Quote.create(newQuoteData);

//     if (!newQuote) {
//       return res.status(404).json({ error: "Failed to create a quote" });
//     }

//     let tokenUuid;
//     let existsToken;
//     do {
//       // tokenUuid = generateShortId(9);
//       tokenUuid = generatePrefixedId(7, "QT");
//       existsToken = await QuoteAccessToken.findByUUID(tokenUuid);
//     } while (existsToken);

//      quoteAccessToken = await QuoteAccessToken.create({
//       quote_uuid: newQuote.uuid,
//       token_hash: actionTokenHash,
//       expires_at: tokenExpiresAt,
//       uuid: tokenUuid,
//     });

//     // ===== ADMIN LINK =====
//     const employeeLink = `${process.env.CLIENT_URL}/employee/quotes/${uuid}`;
//     // ===== EMAIL TO BUSINESS =====
//     await sendQuoteToBusiness({
//       quoteUuid: uuid,
//       firstName: formatFullName(first_name, null, true),
//       lastName: formatFullName(null, last_name, true),
//       mobile,
//       landline,
//       email,
//       message,
//       services,
//       images: cleanedImages,
//       employeeLink,
//     });

//     return res.status(201).json({ data: newQuote });

//   } catch (error) {
//     console.error(error);

//       // ===== ROLLBACK ACCESS TOKEN =====
//     if (quoteAccessToken?.uuid) {
//       try {
//         await QuoteAccessToken.revokeToken(quoteAccessToken.uuid);
//         console.log(`Rolled back quote access token ${quoteAccessToken.uuid}`);
//       } catch (deleteTokenError) {
//         console.error("Rollback token failed:", deleteTokenError);
//       }
//     }

//     if (newQuote?.uuid) {
//       try {
//         await Quote.hardDelete(newQuote.uuid);
//         console.log(`Rolled back quote ${newQuote.uuid}`);
//       } catch (deleteError) {
//         console.error("Rollback failed:", deleteError);
//       }
//     }
   
//     return res.status(500).json({ error: "Server error" });
//   }
// };
// Create quote
export const createQuote = async (req, res) => {
  let newQuote = null;
  let quoteAccessToken = null;

  try {
    const {
      customer_uuid,
      services,
      images,
      first_name,
      last_name,
      mobile,
      landline,
      preferred_contact_method,
      email,
      message,
      address,
    } = req.body;

    const actorUserUuid = req.user?.uuid || null;
    const source = actorUserUuid ? "dashboard" : "public_form";

    // ===== NORMALIZE INPUT =====
    const normalizedFirstName = first_name?.trim();
    const normalizedLastName = last_name?.trim();
    const normalizedEmail = email?.trim().toLowerCase() || null;
    const normalizedAddress = address?.trim();

    // ===== VALIDATION =====
    if (!normalizedFirstName || !normalizedLastName) {
      return res.status(400).json({
        error: "First name and last name are required",
      });
    }

    if (!mobile && !landline) {
      return res.status(400).json({
        error: "Please provide either a mobile or landline number",
      });
    }

    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({
        error: "At least one service is required",
      });
    }

    if (!normalizedAddress) {
      return res.status(400).json({
        error: "Address is required",
      });
    }

    // ===== CLEAN SERVICES =====
    const cleanedServices = services
      .map((service) => {
        if (!service || typeof service !== "object") return null;

        const service_uuid =
          typeof service.service_uuid === "string"
            ? service.service_uuid.trim()
            : null;

        const code =
          typeof service.code === "string"
            ? service.code.trim()
            : null;

        const label =
          typeof service.label === "string"
            ? service.label.trim()
            : null;

        const description =
          typeof service.description === "string" && service.description.trim()
            ? service.description.trim()
            : null;

        const quantity =
          service.quantity !== undefined && service.quantity !== null
            ? Number(service.quantity)
            : null;

        const unit =
          typeof service.unit === "string"
            ? service.unit.trim()
            : null;

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

    // ===== CLEAN IMAGES =====
    const cleanedImages = (images || [])
      .map((img) => {
        if (typeof img === "string") {
          return { url: img.trim() };
        }

        if (img && typeof img.url === "string") {
          return {
            url: img.url.trim(),
            ...(img.label ? { label: img.label.trim() } : {}),
          };
        }

        return null;
      })
      .filter(Boolean);

    // ===== PHONE NORMALIZATION =====
    const normalizedMobile = mobile ? normalizeNZPhone(mobile) : null;
    const normalizedLandline = landline ? normalizeNZPhone(landline) : null;

    // ===== CONTACT METHOD =====
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

    // ===== GENERATE UNIQUE QUOTE UUID =====
    let uuid;
    let exists;

    do {
      uuid = generatePrefixedId(8, "Q");
      exists = await Quote.findByUUID(uuid);
    } while (exists);

    // ===== GENERATE SECURE TOKEN =====
    const actionToken = crypto.randomBytes(32).toString("hex");
    const actionTokenHash = crypto
      .createHash("sha256")
      .update(actionToken)
      .digest("hex");

    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 2);

    // ===== CREATE QUOTE =====
    const newQuoteData = {
      uuid,
      customer_uuid: customer_uuid || null,
      contact_first_name: normalizedFirstName,
      contact_last_name: normalizedLastName,
      contact_mobile: normalizedMobile,
      contact_landline: normalizedLandline,
      preferred_contact_method: normalizedPreferredContactMethod,
      contact_email: normalizedEmail,
      message: message?.trim() || null,
      services: cleanedServices,
      subtotal_amount: 0,
      gst_amount: 0,
      total_amount: 0,
      status: "draft",
      is_quote_sent_to_client: false,
      quote_sent_at: null,
      address: normalizedAddress,
      images: cleanedImages,
      responded_at: null,
      sent_by_user_uuid: actorUserUuid,
    };

    newQuote = await Quote.create(newQuoteData);

    if (!newQuote) {
      return res.status(500).json({ error: "Failed to create quote" });
    }

    // ===== CHANGE LOG =====
    await ChangeLog.create({
      table_name: "quotes",
      record_uuid: newQuote.uuid,
      user_uuid: actorUserUuid,
      action: "create",
      summary: `Quote ${newQuote.uuid} created`,
      changed_fields: {
        created: {
          services: cleanedServices,
          address: normalizedAddress,
          contact_first_name: normalizedFirstName,
          contact_last_name: normalizedLastName,
        },
      },
      source,
    });

    // ===== ACCESS TOKEN =====
    let tokenUuid;
    let existsToken;

    do {
      tokenUuid = generatePrefixedId(7, "QT");
      existsToken = await QuoteAccessToken.findByUUID(tokenUuid);
    } while (existsToken);

    quoteAccessToken = await QuoteAccessToken.create({
      quote_uuid: newQuote.uuid,
      token_hash: actionTokenHash,
      expires_at: tokenExpiresAt,
      uuid: tokenUuid,
    });

    // ===== EMAIL BUSINESS =====
    const employeeLink = `${process.env.CLIENT_URL}/employee/quotes/${uuid}`;

    await sendQuoteToBusiness({
      quoteUuid: uuid,
      firstName: formatFullName(normalizedFirstName, null, true),
      lastName: formatFullName(null, normalizedLastName, true),
      mobile: normalizedMobile,
      landline: normalizedLandline,
      email: normalizedEmail,
      message: message?.trim() || null,
      services: cleanedServices,
      images: cleanedImages,
      employeeLink,
      address: normalizedAddress,
    });

    return res.status(201).json({ data: newQuote });

  } catch (error) {
    console.error(error);

    // ===== ROLLBACK TOKEN =====
    if (quoteAccessToken?.uuid) {
      try {
        await QuoteAccessToken.revokeToken(quoteAccessToken.uuid);
      } catch (err) {
        console.error("Rollback token failed:", err);
      }
    }

    // ===== ROLLBACK QUOTE =====
    if (newQuote?.uuid) {
      try {
        await Quote.hardDelete(newQuote.uuid);
      } catch (err) {
        console.error("Rollback quote failed:", err);
      }
    }

    return res.status(500).json({ error: "Server error" });
  }
};

// Update by UUID
export const updateQuoteByUUID = async (req, res) => {
  const { uuid } = req.params;
  if (!uuid) {
    return res.status(400).json({ message: "Quote uuid is required" });
  }

  try {
    const { services, status, preferred_contact_method } = req.body;

    const allowedStatus = ["draft", "sent", "accepted", "expired", "rejected"];
    const allowedContact = ["mobile", "landline", "email"];

    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    if (preferred_contact_method && !allowedContact.includes(preferred_contact_method)) {
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

    const total_amount = services.reduce((sum, s) => sum + s.unit_price * s.quantity, 0);

    const updateData = { services, total_amount };
    if (status) updateData.status = status;
    if (preferred_contact_method) updateData.preferred_contact_method = preferred_contact_method;

    const updated = await Quote.updateByUUID(uuid, updateData);

    if (!updated) {
      return res.status(400).json({ message: `Failed to update quote with uuid: ${uuid}` });
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

  let existingQuote;
  let quoteSnapshot = null;
  let filePath = null;

  try {
    // ==============================
    // Fetch Existing Quote
    // ==============================

    existingQuote = await Quote.findByUUID(uuid);

    if (!existingQuote) {
      return res.status(404).json({
        message: `Quote not found with uuid: ${uuid}`
      });
    }

    quoteSnapshot = JSON.parse(JSON.stringify(existingQuote));

    // State Guard
    if (existingQuote.status !== "draft") {
      return res.status(400).json({
        message: "Quote cannot be dispatched in current state"
      });
    }

    if (existingQuote.is_quote_sent_to_client) {
      return res.status(400).json({
        message: "Quote has already been sent to client"
      });
    }

    // ==============================
    // Extract Payload
    // ==============================

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
      employer_message
    } = req.body;

    const allowedContact = ["mobile", "landline", "email"];

    if (
      preferred_contact_method &&
      !allowedContact.includes(preferred_contact_method)
    ) {
      return res.status(400).json({
        message: "Invalid preferred contact method"
      });
    }

    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({
        message: "Services must be a non-empty array"
      });
    }

    for (const s of services) {
      if (typeof s.unit_price !== "number" || s.unit_price < 0) {
        return res.status(400).json({
          message: "Unit price must be a positive number"
        });
      }

      if (typeof s.quantity !== "number" || s.quantity <= 0) {
        return res.status(400).json({
          message: "Quantity must be greater than zero"
        });
      }
    }

    // ==============================
    // Totals Validation
    // ==============================

    const calcSubtotal = services.reduce(
      (sum, s) => sum + s.unit_price * s.quantity,
      0
    );

    const calcGST = parseFloat((calcSubtotal * 0.15).toFixed(2));
    const calcTotal = parseFloat((calcSubtotal + calcGST).toFixed(2));

    if (calcSubtotal !== subtotal_amount) {
      return res.status(400).json({ message: "Subtotal mismatch" });
    }

    if (calcGST !== gst_amount) {
      return res.status(400).json({ message: "GST mismatch" });
    }

    if (calcTotal !== total_amount) {
      return res.status(400).json({ message: "Total mismatch" });
    }

    // ==============================
    // Expiry Handling
    // ==============================

    let expiry_end_date;

    if (expiry_end) {
      expiry_end_date = new Date(expiry_end);
    } else {
      expiry_end_date = new Date();
    }

    const minExpiryDate = new Date();
    minExpiryDate.setUTCDate(
      minExpiryDate.getUTCDate() + MIN_EXPIRY_DAYS
    );
    minExpiryDate.setUTCHours(23, 59, 59, 999);

    if (expiry_end_date < minExpiryDate) {
      expiry_end_date = minExpiryDate;
    }

    // ==============================
    // Payload Preparation
    // ==============================

    const updatePayload = {
      services,
      subtotal_amount,
      gst_amount,
      total_amount,
      expiry_end: expiry_end_date.toISOString(),
      status: "sent",
      is_quote_sent_to_client: true,
      quote_sent_at: new Date().toISOString(),
      sent_by_user_uuid: sent_by_user_uuid ?? null,
      preferred_contact_method,
      contact_mobile,
      contact_landline,
      contact_first_name,
      contact_last_name,
      employer_message: employer_message ?? "",
      // quote_pdf_url: null,
      quote_version_reason: "employee_sent"
    };

    // ==============================
    // PDF Generation
    // ==============================

    const logoUrl =
      `${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png`;

    let logoBuffer = null;

    try {
      const response = await fetch(logoUrl);
      const arrayBuffer = await response.arrayBuffer();
      logoBuffer = Buffer.from(arrayBuffer);
    } catch (err) {
      console.error("Logo load failed:", err.message);
    }

    const pdfBuffer = await generateQuotePDF(
      {
        ...existingQuote,
        ...updatePayload
      },
      null,
      logoBuffer
    );

    // ==============================
    // Dispatch Pipeline (Model Handles Version + Path)
    // ==============================

    const result = await Quote.dispatchQuote(
      uuid,
      {
        ...updatePayload
      },
      pdfBuffer
    );
    const finalQuote = result.updated;
    filePath = result.filePath;
    // Token Rotation
    await QuoteAccessToken.revokeAllForQuote(finalQuote.uuid);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const token_hash = hashToken(rawToken);

    let tokenUUID;
    let exists;

    do {
      // tokenUUID = generateShortId(9);
      tokenUUID = generatePrefixedId(7, "QT");
      exists = await QuoteAccessToken.findByUUID(tokenUUID);
    } while (exists);

    await QuoteAccessToken.create({
      quote_uuid: finalQuote.uuid,
      token_hash,
      expires_at: new Date(finalQuote.expiry_end).toISOString(),
      uuid: tokenUUID
    });

    const quoteLink = `${process.env.CLIENT_URL}/quotes/view/${finalQuote.uuid}?token=${rawToken}`;

    // Email Dispatch
    await sendQuoteToClient({
      to: finalQuote.contact_email,
      subject: "Your Quote is Ready",
      data: {
        quoteUUID: finalQuote.uuid,
        name: formatFullName(
          finalQuote.contact_first_name,
          finalQuote.contact_last_name
        ),
        mobile: finalQuote.contact_mobile ?? "",
        landline: finalQuote.contact_landline ?? "",
        message: finalQuote.message ?? "",
        email: finalQuote.contact_email,
        subtotal: finalQuote.subtotal_amount,
        gst: finalQuote.gst_amount,
        total: finalQuote.total_amount,
        services: finalQuote.services,
        images: finalQuote.images,
        quoteLink,
        expiry: formatExpiry(finalQuote.expiry_end),
        employer_message: employer_message ?? ""
      },
      pdfBuffer
    });

    return res.status(200).json({
      message: "Quote updated and sent successfully",
      quote: finalQuote
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
        await supabase.storage
          .from("quotes-pdf")
          .remove([filePath]);
      } catch (storageError) {
        console.error("Storage rollback failed:", storageError);
      }
    }

    return res.status(500).json({
      error: error.message || "Failed to finalize quote"
    });
  }
};


// export const updateQuoteByUUIDEmployee = async (req, res) => {
//     const { uuid } = req.params;
//     if (!uuid) return res.status(400).json({ message: "Quote uuid is required" });

//     try {
      
//       // ===== Find quote =====
//       const quote = await Quote.findByUUID(uuid);
//       if (!quote)
//         return res.status(400).json({message: `Failed to find quote with uuid: ${uuid}`});
//        // ---------- State Guard ----------
//       if (quote.status !== "draft") {
//         return res.status(400).json({
//           message: "Quote can only be dispatched from draft status"
//         });
//       }

//       if (quote.is_quote_sent_to_client) {
//         return res.status(400).json({
//           message: "Quote has already been sent to client"
//         });
//       }

//       const {
//         services,
//         subtotal_amount,
//         gst_amount,
//         total_amount,
//         preferred_contact_method,
//         contact_first_name,
//         contact_last_name,
//         contact_mobile,
//         contact_landline,
//         // status,
//         expiry_end,
//         sent_by_user_uuid
//       } = req.body;

//       // ===== Validate preferred contact =====
//       const allowedContact = ["mobile", "landline", "email"];
//       if (preferred_contact_method && !allowedContact.includes(preferred_contact_method)) {
//         return res.status(400).json({ message: "Invalid preferred contact method" });
//       }

//       // ===== Validate services =====
//       if (!Array.isArray(services) || services.length === 0)
//         return res.status(400).json({ message: "Services are required and must be a non-empty array" });

//       for (const s of services) {
//         if (typeof s.unit_price !== "number" || s.unit_price < 0)
//           return res.status(400).json({ message: "Unit price is required, must be a number, and cannot be negative" });
//         if (typeof s.quantity !== "number" || s.quantity <= 0)
//           return res.status(400).json({ message: "Quantity is required, must be a number, and must be greater than zero" });
//       }

//       // ===== Validate totals =====
//       const calcSubtotal = services.reduce((sum, s) => sum + s.unit_price * s.quantity, 0);
//       const calcGST = parseFloat((calcSubtotal * 0.15).toFixed(2));
//       const calcTotal = parseFloat((calcSubtotal + calcGST).toFixed(2));

//       if (calcSubtotal !== subtotal_amount) return res.status(400).json({ message: "Subtotal mismatch" });
//       if (calcGST !== gst_amount) return res.status(400).json({ message: "GST mismatch" });
//       if (calcTotal !== total_amount) return res.status(400).json({ message: "Total Amount mismatch" });

//       // ===== Parse expiry =====
//       let expiry_end_date;
//       console.log({expiry_end}, " backend admin update")
//       if (expiry_end) {
//         if (/^\d{4}-\d{2}-\d{2}$/.test(expiry_end)) {
//           const [year, month, day] = expiry_end.split("-").map(Number);
//           expiry_end_date = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
//         } else {
//           expiry_end_date = new Date(expiry_end);
//         }
//       } else {
//         expiry_end_date = new Date();
//       }

//       //min is 2 days
//       // Check if expiry is at least 2 days from now
//       const minExpiryDate = new Date();
//       minExpiryDate.setUTCDate(minExpiryDate.getUTCDate() + MIN_EXPIRY_DAYS);
//       minExpiryDate.setUTCHours(23, 59, 59, 999);

//       if (expiry_end_date < minExpiryDate) {
//         // overwrite to 3 days from now if too soon
//         expiry_end_date = minExpiryDate;
//       }
//       // ===== Prepare updateData =====
//       const updateData = {
//         ...quote, // preserve existing fields
//         services,
//         subtotal_amount,
//         gst_amount,
//         total_amount,
//         expiry_end: expiry_end_date.toISOString(),
//         status: "sent",
//         is_quote_sent_to_client: true,
//         quote_sent_at: new Date().toISOString(),
//         sent_by_user_uuid: sent_by_user_uuid ?? null
//       };

//       // Optional contact updates
//       if (preferred_contact_method) updateData.preferred_contact_method = preferred_contact_method;
//       if (contact_mobile) updateData.contact_mobile = contact_mobile;
//       if (contact_landline) updateData.contact_landline = contact_landline;
//       if (contact_first_name) updateData.contact_first_name = contact_first_name;
//       if (contact_last_name) updateData.contact_last_name = contact_last_name;

//       // ===== Update quote =====
//       const updatedQuote = await Quote.updateByUUID(uuid, updateData);
//       if (!updatedQuote) return res.status(400).json({ message: `Failed to update quote with uuid: ${uuid}` });
//       console.log({expiry_end_date})
//       // ===== Create access token =====
//       let accessToken ;
      
//       try {
//           accessToken = await QuoteAccessToken.revokeAllForQuote(updatedQuote.uuid);
//           const rawToken = crypto.randomBytes(32).toString("hex");
//           const token_hash = hashToken(rawToken);

//           const expires_at = new Date(updatedQuote.expiry_end);

//         let tokenUUID;
//         let exists;
//         do {
//           tokenUUID = generatePrefixedId(9);
//          tokenUUID = generatePrefixedId(9);
//           exists = await QuoteAccessToken.findByUUID(tokenUUID);
//         } while (exists);

//           await QuoteAccessToken.create({
//           quote_uuid: updatedQuote.uuid,
//           token_hash,
//           expires_at: expires_at.toISOString(), // token expires with the quote
//           uuid: tokenUUID,
//         });

//           const quoteViewLink = `${process.env.CLIENT_URL}/quotes/view/${updatedQuote.uuid}?token=${rawToken}`;

//           const emailData = {
//           quoteUUID: updatedQuote.uuid,
//           name: formatFullName(updatedQuote.contact_first_name, updatedQuote.contact_last_name),
//           total: updatedQuote.total_amount,
//           subtotal: updatedQuote.subtotal_amount,
//           gst: updatedQuote.gst_amount,
//           services: updatedQuote.services,
//           quoteLink: quoteViewLink,
//           expiry: formatExpiry(expires_at), // display human-readable expiry
//         };
//           if (updatedQuote.contact_mobile) emailData.mobile = updatedQuote.contact_mobile;
//           if (updatedQuote.contact_landline) emailData.landline = updatedQuote.contact_landline;
//           if (updatedQuote.message) emailData.message = updatedQuote.message;
//           if (updatedQuote.contact_email) emailData.email = updatedQuote.contact_email;
//           if (updatedQuote.images && updatedQuote.images.length > 0) emailData.images = updatedQuote.images;

//           const filePath = `quotes/${uuid}/quote-${uuid}.pdf`;

//           const pdfBuffer = await generateQuotePDF(updatedQuote, null);
//           const { data , error: uploadError } = await supabase.storage
//           .from("quotes-pdf")
//           .upload(filePath, pdfBuffer, {
//             contentType: "application/pdf",
//             upsert: true
//           });

//           if (uploadError) throw uploadError;

//           const pdfUrl = publicData.publicUrl;
    
//           const updatedQuote = await Quote.updateByUUID(uuid, {
//             quote_pdf_url: pdfUrl,
//             quote_pdf_version: quote.pdf_version + 1,
//             quote_version_reason: "quote_accepted"
//           });
//             // Send the email to the client
//           await sendQuoteToClient({
//             to: quote.contact_email,
//             subject: "Your Quote is Ready",
//             data: emailData,
//             pdfBuffer
//           });
//         // accessToken  = await dispatchQuoteToClient(updated);
  
//       } catch (emailError) {
//         console.error("Failed to send quote email:", emailError);
//       }

//       return res.status(200).json({ quote: updated });

//     } catch (error) {
//       console.error(error);
//       return res.status(500).json({ error: error.message });
//     }
//   };


  
 // copy of original before changing above
// export const updateQuoteByUUIDEmployee = async (req, res) => {
//     const { uuid } = req.params;
//     if (!uuid) return res.status(400).json({ message: "Quote uuid is required" });

//     try {
      
//       // ===== Find quote =====
//       const quote = await Quote.findByUUID(uuid);
//       if (!quote)
//         return res.status(400).json({ message: `Failed to find quote with uuid: ${uuid}` });
//        // ---------- State Guard ----------
//       if (quote.status !== "draft") {
//         return res.status(400).json({
//           message: "Quote can only be dispatched from draft status"
//         });
//       }

//       if (quote.is_quote_sent_to_client) {
//         return res.status(400).json({
//           message: "Quote has already been sent to client"
//         });
//       }

//       const {
//         services,
//         subtotal_amount,
//         gst_amount,
//         total_amount,
//         preferred_contact_method,
//         contact_first_name,
//         contact_last_name,
//         contact_mobile,
//         contact_landline,
//         // status,
//         expiry_end,
//         sent_by_user_uuid
//       } = req.body;

//       // ===== Validate preferred contact =====
//       const allowedContact = ["mobile", "landline", "email"];
//       if (preferred_contact_method && !allowedContact.includes(preferred_contact_method)) {
//         return res.status(400).json({ message: "Invalid preferred contact method" });
//       }

//       // ===== Validate services =====
//       if (!Array.isArray(services) || services.length === 0)
//         return res.status(400).json({ message: "Services are required and must be a non-empty array" });

//       for (const s of services) {
//         if (typeof s.unit_price !== "number" || s.unit_price < 0)
//           return res.status(400).json({ message: "Unit price is required, must be a number, and cannot be negative" });
//         if (typeof s.quantity !== "number" || s.quantity <= 0)
//           return res.status(400).json({ message: "Quantity is required, must be a number, and must be greater than zero" });
//       }

//       // ===== Validate totals =====
//       const calcSubtotal = services.reduce((sum, s) => sum + s.unit_price * s.quantity, 0);
//       const calcGST = parseFloat((calcSubtotal * 0.15).toFixed(2));
//       const calcTotal = parseFloat((calcSubtotal + calcGST).toFixed(2));

//       if (calcSubtotal !== subtotal_amount) return res.status(400).json({ message: "Subtotal mismatch" });
//       if (calcGST !== gst_amount) return res.status(400).json({ message: "GST mismatch" });
//       if (calcTotal !== total_amount) return res.status(400).json({ message: "Total Amount mismatch" });

//       // ===== Parse expiry =====
//       let expiry_end_date;
//       console.log({expiry_end}, " backend admin update")
//       if (expiry_end) {
//         if (/^\d{4}-\d{2}-\d{2}$/.test(expiry_end)) {
//           const [year, month, day] = expiry_end.split("-").map(Number);
//           expiry_end_date = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
//         } else {
//           expiry_end_date = new Date(expiry_end);
//         }
//       } else {
//         expiry_end_date = new Date();
//       }

//       //min is 2 days
//       // Check if expiry is at least 2 days from now
//       const minExpiryDate = new Date();
//       minExpiryDate.setUTCDate(minExpiryDate.getUTCDate() + MIN_EXPIRY_DAYS);
//       minExpiryDate.setUTCHours(23, 59, 59, 999);

//       if (expiry_end_date < minExpiryDate) {
//         // overwrite to 3 days from now if too soon
//         expiry_end_date = minExpiryDate;
//       }
//       // ===== Prepare updateData =====
//       const updateData = {
//         ...quote, // preserve existing fields
//         services,
//         subtotal_amount,
//         gst_amount,
//         total_amount,
//         expiry_end: expiry_end_date.toISOString(),
//         status: "sent",
//         is_quote_sent_to_client: true,
//         quote_sent_at: new Date().toISOString(),
//         sent_by_user_uuid: sent_by_user_uuid ?? null
//       };

//       // Optional contact updates
//       if (preferred_contact_method) updateData.preferred_contact_method = preferred_contact_method;
//       if (contact_mobile) updateData.contact_mobile = contact_mobile;
//       if (contact_landline) updateData.contact_landline = contact_landline;
//       if (contact_first_name) updateData.contact_first_name = contact_first_name;
//       if (contact_last_name) updateData.contact_last_name = contact_last_name;

//       // ===== Update quote =====
//       const updated = await Quote.updateByUUID(uuid, updateData);
//       if (!updated) return res.status(400).json({ message: `Failed to update quote with uuid: ${uuid}` });
//       console.log({expiry_end_date})
//       // ===== Create access token =====
//       let accessToken ;
      
//       try {
        
//         accessToken  = await dispatchQuoteToClient(updated);
  
//       } catch (emailError) {
//         console.error("Failed to send quote email:", emailError);
//       }

//       return res.status(200).json({ quote: updated });

//     } catch (error) {
//       console.error(error);
//       return res.status(500).json({ error: error.message });
//     }
//   };

// Update by ID
export const updateQuoteById = async (req, res) => {
  const { id } = req.params;

  try {
    const updated = await Quote.updateById(id, req.body);
    return res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Soft delete
export const softDeleteQuote = async (req, res) => {
  const { uuid } = req.params;
  if (!uuid) {
    return res.status(400).json({ error: "Quote UUID is required" });
  }

  try {
    const quote = await Quote.findByUUID(uuid);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    // Optional: idempotent behavior
    if (quote.is_deleted || quote.deleted_at) {
      return res.status(200).json({
        message: "Quote already deleted",
        data: quote,
      });
    }

    const deleted = await Quote.softDelete(uuid);

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

  if (!uuid) {
    return res.status(400).json({ error: "Quote UUID is required" });
  }

  try {
    // 1) Ensure quote exists
    const quote = await Quote.findByUUID(uuid);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    // 2) Optional: only allow restore if it is actually soft-deleted
    // (remove this block if you want restore to be idempotent)
    if (!quote.is_deleted && !quote.deleted_at) {
      return res.status(400).json({
        error: "Quote is not deleted, nothing to restore",
      });
    }

    // 3) Restore (your Quote.restore should handle:
    //    - quote previous_status -> status
    //    - job(s) restore
    //    - job_recurrences restore (safe no-op if none)
    const restored = await Quote.restore(uuid);

    return res.status(200).json({
      message: "Quote restored successfully",
      data: restored,
    });
  } catch (error) {
    console.error("Restore quote failed:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};
// export const softDeleteQuote = async (req, res) => {
//   const { uuid } = req.params;
//   if (!uuid) {
//     return res.status(400).json({ error: "Quote UUID is required" });
//   }

//   try {

//     const quoteExists = await Quote.findByUUID(uuid);
//     if (!quoteExists) {
//       return res.status(404).json({ error: 'Quote not found' });
//     }
//     const deleted = await Quote.softDelete(uuid);
//     return res.status(200).json(deleted);
//   } catch (error) {
//     return res.status(500).json({ error: error.message });
//   }
// };

// Reinstate quote

export const reinstateQuote = async (req, res) => {
  const { uuid } = req.params;

  try {
    const reinstated = await Quote.reinstate(uuid);
    return res.status(200).json(reinstated);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Hard delete
//works fine 14/01/2026
// export const hardDeleteQuote = async (req, res) => {
//   const { uuid } = req.params;
//   if (!uuid) {
//     return res.status(400).json({ error: "Quote UUID is required" });
//   }

//   try {
//     const quote = await Quote.findByUUID(uuid);
//     if (!quote) {
//       return res.status(404).json({ error: "Quote not found" });
//     }

//     // DELETE IMAGES FIRST
//     const images = quote.images || [];

//     // Only attempt deletion if images exist
//     if (images.length > 0) {
//       const deleteResult = await Quote.deleteImagesFromBucket(images);

//       if (!deleteResult.success) {
//         console.error("Image deletion failed:", deleteResult.errors);
//         return res.status(500).json({
//           error: "Failed to delete images from storage. Quote was NOT deleted.",
//           details: deleteResult.errors,
//         });
//       }
//     }

//     // ONLY DELETE QUOTE AFTER IMAGES SUCCESSFULLY DELETED
//     const deleted = await Quote.hardDelete(uuid);

//     return res.status(200).json({
//       message: "Quote permanently deleted",
//       data: deleted,
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ error: error.message });
//   }
// };
//HARD DELETE WITH JOB CASCADE AND IMAGE DELETION previous function before changing to just quote delete without job or image deletion
// export const hardDeleteQuote = async (req, res) => {
//   const { uuid } = req.params;
//   if (!uuid) {
//     return res.status(400).json({ error: "Quote UUID is required" });
//   }

//   try {
//     const quote = await Quote.findByUUID(uuid);
//     if (!quote) {
//       return res.status(404).json({ error: "Quote not found" });
//     }

//     // 1️⃣ DELETE IMAGES FIRST
//     const images = quote.images || [];
//     if (images.length > 0) {
//       const deleteResult = await Quote.deleteImagesFromBucket(images);
//       if (!deleteResult.success) {
//         console.error("Image deletion failed:", deleteResult.errors);
//         return res.status(500).json({
//           error: "Failed to delete images from storage. Quote was NOT deleted.",
//           details: deleteResult.errors,
//         });
//       }
//     }

//     // 2️⃣ DELETE RELATED JOBS
//     await Job.deleteByQuoteUUID(uuid); // <-- delete all jobs referencing this quote

//     // 3️⃣ DELETE THE QUOTE
//     const deleted = await Quote.hardDelete(uuid);

//     return res.status(200).json({
//       message: "Quote and related jobs permanently deleted",
//       data: deleted,
//     });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ error: error.message });
//   }
// };

export const hardDeleteQuote = async (req, res) => {
  const { uuid } = req.params;
  if (!uuid) {
    return res.status(400).json({ error: "Quote UUID is required" });
  }

  try {
    const quote = await Quote.findByUUID(uuid);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    const deleted = await Quote.hardDelete(uuid);

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
//   const { token } = req.body;

//   if (!uuid) {
//     return res.status(400).json({ error: "Quote UUID is required" });
//   }

//   let customerCreated = false;
//   let jobCreated = false;
//   let customer, job;

//   try {
//     //  Load quote
//     const quote = await Quote.findByUUID(uuid);
//     if (!quote) {
//       return res.status(404).json({ error: "Quote not found" });
//     }

//     //  Prevent double response
//     if (quote.responded_at) {
//       return res.status(400).json({
//         error: "Quote already responded to",
//         responded_at: quote.responded_at,
//       });
//     }

//     //  Auth: session or token
//     const hasSession = req.session && req.session.quote_uuid === uuid;

//     if (!hasSession) {
//       // Fallback to token
//       if (!token) {
//         return res.status(401).json({ error: "No session or token provided" });
//       }

//       const tokenHash = hashToken(token);
//       const tokenRecord = await QuoteAccessToken.findByTokenHash(tokenHash);

//       if (!tokenRecord || tokenRecord.quote_uuid !== quote.uuid) {
//         return res.status(401).json({ error: "Invalid token" });
//       }

//       if (new Date(tokenRecord.expires_at) < new Date()) {
//         return res.status(401).json({ error: "Token expired" });
//       }
//     }

//     // Find or create customer
//     const email = quote.contact_email.toLowerCase();
//     customer = await Customer.findByEmail(email);

//     if (!customer) {
 
//       let customerUUID;
//       while (true) {
//         customerUUID = generatePrefixedId(9);
//        customerUUID = generatePrefixedId(9);
//         const exists = await Customer.findByUUID(customerUUID);
//         if (!exists) break;
//       }

//       customer = await Customer.create({
//         uuid: customerUUID,
//         first_name: quote.contact_first_name,
//         last_name: quote.contact_last_name,
//         email,
//         mobile_phone: quote.contact_mobile,
//         landline_phone: quote.contact_landline,
//         address: quote.address,
//         created_via: "quote_accept",
//       });
//       customerCreated = true;
//     }
    
//     // Ensure job does not already exist
//     const existingJob = await Job.findJobByQuoteUUID(quote.uuid);
//     if (existingJob) {
//       return res.status(400).json({
//         error: "A job already exists for this quote",
//         job_uuid: existingJob.uuid,
//       });
//     }

//     //  Create job from quote
//     let jobUUID;
//     while (true) {
//       jobUUID = generatePrefixedId(9);
//      jobUUID = generatePrefixedId(9);
//       const exists = await Job.findByUUID(jobUUID);
//       if (!exists) break;
//     }

//     job = await Job.createFromQuote({
//       quote,
//       uuid: jobUUID,
//       customer_uuid: customer.uuid,
//       scheduled_at: null,
//       is_recurring: false,
//       recurrence_interval: null,
//       recurrence_frequency: null,
//       recurrence_end_date: null,
//     });

//     jobCreated = true;

//     // Update quote status
//     const acceptedQuote = await Quote.acceptQuote(uuid, customer.uuid);

//     // Revoke all quote access tokens
//     await QuoteAccessToken.revokeAllForQuote(quote.uuid);

//     // Destroy session and clear cookie
//     if (req.session) {
//       req.session.destroy((err) => {
//         if (err) console.error("Error destroying session:", err);
//       });
//     }
//     res.clearCookie("quote_session", {
//       httpOnly: true,
//       secure: true,
//       sameSite: "lax",
//     });

//     try {
//       await sendQuoteAccepted({ to: quote.contact_email, quote: acceptedQuote });
//     } catch (err) {
//       console.error("Failed to send accepted email:", err);
//     }

//     return res.status(200).json({
//       message: "Quote accepted successfully",
//       quote: acceptedQuote,
//       customer,
//       job,
//     });
//   } catch (error) {
//     console.error("Accept quote error:", error);
//     // 🔄 Rollback on failure
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
  const { token } = req.body;

  if (!uuid) {
    return res.status(400).json({ error: "Quote UUID is required" });
  }

  if (!token) {
    return res.status(401).json({ error: "Token required" });
  }

  let customerCreated = false;
  let jobCreated = false;
  let customer, job;

  try {
    // Load quote
    const quote = await Quote.findByUUID(uuid);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    // Prevent double response
    if (quote.responded_at) {
      return res.status(400).json({
        error: "Quote already responded to",
        responded_at: quote.responded_at,
      });
    }

    // Validate token
    const tokenHash = hashToken(token);
    const tokenRecord = await QuoteAccessToken.findByTokenHash(tokenHash);

    if (!tokenRecord || tokenRecord.quote_uuid !== quote.uuid) {
      return res.status(401).json({ error: "Invalid token" });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(401).json({ error: "Token expired" });
    }

    if (!quote.contact_email?.trim()) {
      return res.status(400).json({ error: "Quote email is required" });
    }
    // Find or create customer
    const email = quote.contact_email?.trim().toLowerCase();
    const firstName = quote.contact_first_name?.trim() || "";
    const lastName = quote.contact_last_name?.trim() || "";

    customer = await Customer.findByEmailAndName(email, firstName, lastName);
    // customer = await Customer.findByEmail(email);

    if (!customer) {
      let customerUUID;
      while (true) {
        // customerUUID = generateShortId(9);
        customerUUID = generatePrefixedId(8,"C");
        const exists = await Customer.findByUUID(customerUUID);
        if (!exists) break;
      }

      customer = await Customer.create({
        uuid: customerUUID,
        first_name: quote.contact_first_name,
        last_name: quote.contact_last_name,
        email,
        mobile_phone: quote.contact_mobile,
        landline_phone: quote.contact_landline,
        address: quote.address,
        created_via: "quote_accept",
      });

      customerCreated = true;
    }

    // Ensure job does not already exist
    const existingJob = await Job.findJobByQuoteUUID(quote.uuid);
    if (existingJob) {
      return res.status(400).json({
        error: "A job already exists for this quote",
        job_uuid: existingJob.uuid,
      });
    }

    // Create job from quote
    let jobUUID;
    while (true) {
      // jobUUID = generateShortId(9);
      jobUUID = generatePrefixedId(8, "J");
      const exists = await Job.findByUUID(jobUUID);
      if (!exists) break;
    }

    job = await Job.createFromQuote({
      quote,
      uuid: jobUUID,
      customer_uuid: customer.uuid,
      scheduled_at: null,
      is_recurring: false,
      recurrence_interval: null,
      recurrence_frequency: null,
      recurrence_end_date: null,
    });

    jobCreated = true;
    const filePath = `quotes/${uuid}/quote-${uuid}.pdf`;
    // Accept quote (this sets responded_at)
    const acceptedQuote = await Quote.acceptQuote(uuid, customer.uuid);
    const pdfBuffer = await generateQuotePDF(acceptedQuote, customer);
    const { data , error: uploadError } = await supabase.storage
    .from("quotes-pdf")
    .upload(filePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true
    });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage
    .from("quotes-pdf")
    .getPublicUrl(filePath);

    const pdfUrl = publicData.publicUrl;
    
    const updatedQuote = await Quote.update(uuid, {
      quote_pdf_url: pdfUrl,
      quote_pdf_version: (acceptedQuote.quote_pdf_version ?? 0) + 1,
      quote_version_reason: "quote_accepted"
    });
    // Revoke all quote access tokens
    await QuoteAccessToken.revokeAllForQuote(quote.uuid);

    try {
      await sendQuoteAccepted({
        to: quote.contact_email,
        quote: updatedQuote,
        pdfBuffer
      });
    } catch (err) {
      console.error("Failed to send accepted email:", err);
    }

    return res.status(200).json({
      message: "Quote accepted successfully",
      quote: acceptedQuote,
      customer,
      job,
    });
  } catch (error) {
    console.error("Accept quote error:", error);

    // Rollback
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

  if (!uuid) {
    return res.status(400).json({ error: "Quote UUID is required" });
  }

  try {
    //  Load quote
    const quote = await Quote.findByUUID(uuid);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    //  Prevent double response
    if (quote.responded_at) {
      return res.status(400).json({
        error: "Quote already responded to",
        responded_at: quote.responded_at,
      });
    }

    //  Auth: session or token
    const hasSession = req.session && req.session.quote_uuid === uuid;

    if (!hasSession) {
      // No session → fallback to token
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

    //  Update quote status + revoke tokens
    const rejectedQuote = await Quote.rejectQuote(uuid);

    // Revoke all access tokens for this quote
    await QuoteAccessToken.revokeAllForQuote(quote.uuid);

    //  Destroy session if it exists
    if (req.session) {
      req.session.destroy((err) => {
        if (err) console.error("Error destroying session:", err);
      });
    }

    //  Clear session cookie
    res.clearCookie("quote_session", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
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
//works fine 14/01/2026
export const extendQuoteController = async (req, res) => {
  const { uuid } = req.params;
  const { newDate, addDays } = req.body;

  try {
    if (!uuid) return res.status(400).json({ error: "Quote UUID is required" });

    const quoteExists = await Quote.findByUUID(uuid);
    if (!quoteExists) {
      return res.status(404).json({ error: "Quote not found" });
    }

    if (!newDate && !addDays)
      return res.status(400).json({ error: "Provide either newDate or addDays" });

    const updatedQuote = await Quote.extendQuote(uuid, { newDate, addDays });

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

    // SEND EMAIL TO CUSTOMER
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

    // List all files
    const { data: files, error: listError } = await supabase
      .storage
      .from(bucketName)
      .list("", { limit: 1000 });

    if (listError) throw listError;

    const filePaths = files.map((file) => file.name);

    // Delete files
    const { error: deleteError } = await supabase
      .storage
      .from(bucketName)
      .remove(filePaths);

    if (deleteError) throw deleteError;

    return res.status(200).json({ message: "All quote images deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function viewQuoteByToken(req, res) {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Missing access token' });
    }

    // Hash incoming token (must match how you stored it)
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find token record
    const accessToken = await QuoteAccessToken.findByTokenHash(tokenHash);

    if (!accessToken) {
      return res.status(404).json({ error: 'Invalid or expired link' });
    }

    // Expiry check
    if (accessToken.expires_at < new Date()) {
      return res.status(410).json({ error: 'This link has expired' });
    }

    // Fetch quote
    const quote = await Quote.findById(accessToken.quote_id);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Track views (email scanners may hit this)
    await QuoteAccessToken.markViewed(accessToken.id);

    // First time client actually views quote
    if (!quote.client_viewed_at) {
      await Quote.markClientViewed(quote.id);
    }

    // 🔐 Return SAFE, READ-ONLY data only
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
      viewed_at: quote.client_viewed_at
    });

  } catch (err) {
    console.error('viewQuoteByToken error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

export const autoExpireQuote = async (req, res) => {
    try {
        const { uuid } = req.params;

        if (!uuid) {
            return res.status(400).json({
                error: "Quote UUID is required"
            });
        }

        const quote = await Quote.autoExpire(uuid);

        if (!quote) {
            return res.status(400).json({
                error: "Quote could not be auto expired"
            });
        }

        return res.status(200).json({
            message: "Quote auto expired successfully",
            quote
        });

    } catch (error) {
        console.error("Auto expire controller error:", error.message);

        return res.status(400).json({
            error: error.message || "Auto expire failed"
        });
    }
};
