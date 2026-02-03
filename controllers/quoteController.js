import Quote from "../models/Quote.js";
import Customer from "../models/Customer.js";
import QuoteAccessToken from "../models/QuoteAccessToken.js";
import Job from "../models/Job.js";
import crypto from "crypto";
import {
  generateShortId, normalizeNZPhone,
  formatExpiry, formatFullName, generateQuoteAccessToken
} from "../util/util.js";
import { sendQuoteToBusiness } from "../lib/email/index.js"; // adjust path
import supabase from '../config/db.js';

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
export const createQuote = async (req, res) => {
  let newQuote = null;

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

    // ===== VALIDATION =====
    if (!first_name || !last_name) {
      return res.status(400).json({ error: "First name and last name are required" });
    }

    if (!mobile && !landline) {
      return res.status(400).json({ error: "Please provide either a mobile or landline number" });
    }

    if (!services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ error: "At least one service is required" });
    }

    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }

    // ===== CLEAN IMAGES =====
    const cleanedImages = (images || [])
      .map(img => {
        if (typeof img === "string") return { url: img };
        if (img && typeof img.url === "string") return img;
        return null;
      })
      .filter(Boolean);

    // ===== GENERATE UNIQUE UUID =====
    let uuid;
    let exists;
    do {
      uuid = generateShortId(9);
      exists = await Quote.findByUUID(uuid);
    } while (exists);

    // ===== GENERATE SECURE ACTION TOKEN =====
    const actionToken = crypto.randomBytes(32).toString("hex");
    const actionTokenHash = crypto.createHash("sha256").update(actionToken).digest("hex");

    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 3); // expires in 3 days

    const newQuoteData = {
      uuid,
      customer_uuid: customer_uuid || null,
      contact_first_name: first_name.toLowerCase(),
      contact_last_name: last_name.toLowerCase(),
      contact_mobile: mobile ? normalizeNZPhone(mobile) : null,
      contact_landline: landline ? normalizeNZPhone(landline) : null,
      preferred_contact_method: preferred_contact_method || "email",
      contact_email: email.toLowerCase(),
      message: message || null,
      services,
      total_amount: 0,
      status: "draft", // draft because admin hasn't updated yet
      is_quote_sent_to_client: false,
      quote_sent_at: null,
      address,
      images: cleanedImages,
      responded_at: null,
    };

    newQuote = await Quote.create(newQuoteData);

    if (!newQuote) {
      return res.status(404).json({ error: "Failed to create a quote" });
    }

    let tokenUuid;
    let existsToken;
    do {
      tokenUuid = generateShortId(9);
      existsToken = await QuoteAccessToken.findByUUID(tokenUuid);
    } while (existsToken);

    const quoteAccessToken = await QuoteAccessToken.create({
      quote_uuid: newQuote.uuid,
      token_hash: actionTokenHash,
      expires_at: tokenExpiresAt,
      uuid: tokenUuid,
    });

    console.log({ quoteAccessToken })
    // ===== ADMIN LINK =====
    const adminLink = `${process.env.CLIENT_URL}/admin/quotes/${uuid}`;

    // ===== EMAIL TO BUSINESS =====
    await sendQuoteToBusiness({
      quoteUuid: uuid,
      firstName: first_name,
      lastName: last_name,
      mobile,
      landline,
      email,
      message,
      services,
      images: cleanedImages,
      adminLink,
    });

    return res.status(201).json({ data: newQuote });

  } catch (error) {
    console.error(error);

    if (newQuote?.uuid) {
      try {
        await Quote.hardDelete(newQuote.uuid);
        console.log(`Rolled back quote ${newQuote.uuid}`);
      } catch (deleteError) {
        console.error("Rollback failed:", deleteError);
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

    const allowedStatus = ["pending", "accepted", "expired", "rejected"];
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

export const updateQuoteByUUIDAdmin = async (req, res) => {
  const { uuid } = req.params;
  if (!uuid) {
    return res.status(400).json({ message: "Quote uuid is required" });
  }

  try {
    const { services, subtotal_amount, gst_amount, total_amount, preferred_contact_method } = req.body;

    const allowedContact = ["mobile", "landline", "email"];

    if (preferred_contact_method && !allowedContact.includes(preferred_contact_method)) {
      return res.status(400).json({ message: "Invalid preferred contact method" });
    }

    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ message: "Services are required and must be a non-empty array" });
    }

    for (const s of services) {
      if (typeof s.unit_price !== "number" || s.unit_price < 0) {
        return res.status(400).json({ message: "Unit price is required, must be a number, and cannot be negative" });
      }
      if (typeof s.quantity !== "number" || s.quantity <= 0) {
        return res.status(400).json({ message: "Quantity is required, must be a number, and must be greater than 0" });
      }
    }

    // ===== VALIDATE FRONTEND VALUES =====
    const calcSubtotal = services.reduce((sum, s) => sum + s.unit_price * s.quantity, 0);
    const calcGST = parseFloat((calcSubtotal * 0.15).toFixed(2));
    const calcTotal = parseFloat((calcSubtotal + calcGST).toFixed(2));

    if (calcSubtotal !== subtotal_amount) {
      return res.status(400).json({ message: "Subtotal mismatch" });
    }

    if (calcGST !== gst_amount) {
      return res.status(400).json({ message: "GST mismatch" });
    }

    if (calcTotal !== total_amount) {
      return res.status(400).json({ message: "Total Amount mismatch" });
    }

    // Set expiry to 3 days from now, keeping 1 for now at testing phase
    const expiry_end = new Date();
    expiry_end.setDate(expiry_end.getDate() + 1);

    // ===== GENERATE NEW TOKEN =====
    const actionToken = crypto.randomBytes(32).toString("hex");
    const actionTokenHash = crypto.createHash("sha256").update(actionToken).digest("hex");

    const updateData = {
      services,
      subtotal_amount,
      gst_amount,
      total_amount,
      expiry_end: expiry_end.toISOString(),
      status: "sent",
      is_quote_sent_to_client: true,
      quote_sent_at: new Date().toISOString(),
    };

    if (preferred_contact_method) {
      updateData.preferred_contact_method = preferred_contact_method;
    }

    const updated = await Quote.updateByUUID(uuid, updateData);

    if (!updated) {
      return res.status(400).json({ message: `Failed to update quote with uuid: ${uuid}` });
    }
    // ===== NEW: revoke old tokens (important!) =====
    const oldQuoteAccessToken = await QuoteAccessToken.revokeAllForQuote(uuid); // ⬅️ ensures old tokens are invalidated

    console.log({ oldQuoteAccessToken })
    // ===== NEW: generate short uuid for quote_access_token row =====
    let tokenUuid;
    let exists;
    do {
      tokenUuid = generateShortId(9); // <-- NEW: generate 9 char UUID
      exists = await QuoteAccessToken.findByUUID(tokenUuid); // <-- NEW: ensure unique
    } while (exists);

    const quoteAccessToken = await QuoteAccessToken.create({
      quote_uuid: uuid,
      token_hash: actionTokenHash,
      expires_at: expiry_end.toISOString(),
      uuid: tokenUuid,
    });

    console.log({ quoteAccessToken })

    return res.status(200).json({ quote: updated });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

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

    const quoteExists = await Quote.findByUUID(uuid);
    if (!quoteExists) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    const deleted = await Quote.softDelete(uuid);
    return res.status(200).json(deleted);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

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

    // DELETE IMAGES FIRST
    const images = quote.images || [];

    // Only attempt deletion if images exist
    if (images.length > 0) {
      const deleteResult = await Quote.deleteImagesFromBucket(images);

      if (!deleteResult.success) {
        console.error("Image deletion failed:", deleteResult.errors);
        return res.status(500).json({
          error: "Failed to delete images from storage. Quote was NOT deleted.",
          details: deleteResult.errors,
        });
      }
    }

    // ONLY DELETE QUOTE AFTER IMAGES SUCCESSFULLY DELETED
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

export const acceptQuote = async (req, res) => {
  const { uuid } = req.params;
  const { token } = req.query;

  try {
    const quote = await Quote.findByUUID(uuid);

    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    // 1) Validate token
    if (!token || !quote.action_token_hash) {
      return res.status(401).json({ error: "Invalid or missing token" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    if (tokenHash !== quote.action_token_hash) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // 2) Check expiry
    if (new Date() > new Date(quote.action_token_expires_at)) {
      return res.status(401).json({ error: "Token expired" });
    }

    // 3) Prevent reuse
    if (quote.responded_at) {
      return res.status(400).json({ error: "Quote already responded to" });
    }

    // 4) Create customer + job here (you said you wanted this)
    const customer = await Customer.create({
      uuid: generateShortId(9),
      first_name: quote.contact_first_name,
      last_name: quote.contact_last_name,
      email: quote.contact_email,
      mobile: quote.contact_mobile,
      landline: quote.contact_landline,
      address: quote.address,
    });

    const job = await Job.create({
      uuid: generateShortId(9),
      customer_uuid: customer.uuid,
      quote_uuid: quote.uuid,
      status: "pending",
      total_amount: quote.total_amount,
      // other job fields...
    });

    // 5) Update quote status + invalidate token
    const acceptedQuote = await Quote.acceptQuote(uuid, {
      responded_at: new Date(),
      action_token_hash: null,
      action_token_expires_at: null,
      status: "accepted",
    });

    return res.status(200).json({
      quote: acceptedQuote,
      customer,
      job,
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const rejectQuote = async (req, res) => {
  const { uuid } = req.params;
  const { token } = req.query;

  try {
    const quote = await Quote.findByUUID(uuid);

    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    // 1) Validate token
    if (!token || !quote.action_token_hash) {
      return res.status(401).json({ error: "Invalid or missing token" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    if (tokenHash !== quote.action_token_hash) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // 2) Check expiry
    if (new Date() > new Date(quote.action_token_expires_at)) {
      return res.status(401).json({ error: "Token expired" });
    }

    // 3) Prevent reuse
    if (quote.responded_at) {
      return res.status(400).json({ error: "Quote already responded to" });
    }

    // 4) Update status + invalidate token
    const rejectedQuote = await Quote.rejectQuote(uuid, {
      responded_at: new Date(),
      action_token_hash: null,
      action_token_expires_at: null,
      status: "rejected",
    });

    return res.status(200).json(rejectedQuote);

  } catch (error) {
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

export const verifyQuoteToken = async (req, res) => {
  const { uuid } = req.params;
  const { token } = req.query;

  // 1. Validate inputs
  if (!uuid) {
    return res.status(400).json({ error: "Quote UUID is required" });
  }

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    // 2. Find quote
    const quote = await Quote.findByUUID(uuid);

    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    // 3. Check quote status
    if (quote.status !== "sent") {
      return res.status(403).json({ error: "Quote is not available for viewing" });
    }

    // 4. Check token expiry
    if (quote.action_token_expires_at && new Date() > new Date(quote.action_token_expires_at)) {
      return res.status(403).json({ error: "Token has expired" });
    }

    // 5. Hash token and compare
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    if (tokenHash !== quote.action_token_hash) {
      return res.status(403).json({ error: "Invalid token" });
    }

    // 6. If valid, return quote
    return res.status(200).json({
      data: quote,
      message: "Token verified successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

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