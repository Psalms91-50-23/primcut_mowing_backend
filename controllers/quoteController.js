import Quote from "../models/Quote.js";
import Customer from "../models/Customer.js";
import Service from "../models/Service.js";
import ChangeLog from "../models/ChangeLog.js";
import PrivacyPolicy from "../models/PrivacyPolicy.js";
import QuoteAccessToken from "../models/QuoteAccessToken.js";
import Job from "../models/Job.js";
import User from "../models/User.js";
import PrivacyPolicyAcceptance from "../models/PrivacyPolicyAcceptance.js";
import TermsAndConditions from "../models/TermsAndConditions.js";
import crypto from "crypto";
import {
  generatePrefixedId,
  normalizeNZPhone,
  formatExpiry,
  formatFullName,
  hashToken,
  obfuscateName,
  generateUniqueChangeLogUUID,
  cleanTermsForPDF,
  formatTermsForPDF
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
import { supabase } from "../config/db.js";
import { uploadImageToBucket, removeUploadedFiles, parseJSONField } from "../util/uploadHelpers.js";
import path from "path";
import fs from "fs";

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
  const { uuid } = req.params;
  const actorUserUuid = req.user?.uuid || null;

  if (!uuid) {
    return res.status(400).json({ error: "Customer UUID is required" });
  }

  try {
    const quotes = await Quote.findByCustomerUUID(uuid);

    return res.status(200).json({
      quotes,
      count: quotes.length,
      customer_uuid: uuid,
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
    const changeLogUuid = await generateUniqueChangeLogUUID();
    await createChangeLogSafe({
      uuid: changeLogUuid,
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
    const changeLogUuid = await generateUniqueChangeLogUUID();
    await createChangeLogSafe({
      uuid: changeLogUuid,
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
    const changeLogUuid = await generateUniqueChangeLogUUID();
    await createChangeLogSafe({
      uuid: changeLogUuid,
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

    const { data: files, error: listError } = await supabase().storage
      .from(bucketName)
      .list("", { limit: 1000 });

    if (listError) throw listError;

    const filePaths = files.map((file) => file.name);

    const { error: deleteError } = await supabase().storage
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

    const changeLogUuid = await generateUniqueChangeLogUUID();
    await createChangeLogSafe({
      uuid: changeLogUuid,
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

    const changeLogUuid = await generateUniqueChangeLogUUID();

    await createChangeLogSafe({
      uuid: changeLogUuid,
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