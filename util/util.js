
import crypto from 'crypto';
const CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz";
const DEFAULT_LENGTH = 9;
import jwt from 'jsonwebtoken';
import QuoteAccessToken from '../models/QuoteAccessToken.js';
import { RecaptchaEnterpriseServiceClient } from "@google-cloud/recaptcha-enterprise";
import { sendQuoteToClient } from "../lib/email/index.js";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

const EMAIL_SECRET = process.env.EMAIL_SECRET || 'supersecret123';
const EMAIL_TOKEN_EXPIRATION = '5m'; // 5 minutes for testing
const PASSWORD_RESET_TOKEN = process.env.RESET_PASSWORD_TOKEN_SECRET || 'SuperSecretPasswordResetKey_!!!';
export const EMAIL_TOKEN_EXPIRES_IN = '10m';// 10 minutes for testing
const TOKEN_EXPIRY_DAYS = 3; // e.g., 7 days
const COUNTRY_CODES = {
  NZ: /^(\+64)(2\d{1,2}|[3-9]\d)\d{6,7}$/,       // New Zealand
  US: /^(\+1)([2-9]\d{2})([2-9]\d{2})(\d{4})$/,  // United States
  AU: /^(\+61)([2-478]\d)(\d{6,8})$/,            // Australia
  UK: /^(\+44)(7\d{3}|\d{2,4})\d{6,8}$/,         // United Kingdom
  // Add more countries as needed
};
/**
 * Helper to get country dialing code
 * @param {string} country
 * @returns {string}
 */
export const getCountryCode = (country) => {
  switch (country) {
    case "NZ": return "+64";
    case "US": return "+1";
    case "AU": return "+61";
    case "UK": return "+44";
    default: return "+64"; // fallback NZ
  }
}

/**
 * Normalize international phone numbers.
 * @param {string} phone - The phone number as input (digits, with or without 0 or +)
 * @param {string} defaultCountry - Country code string (NZ, US, AU, UK, etc.)
 * @returns {string} normalized phone number with +<country code>
 */


// Utility to get client IP
export const getClientIp = (req) => {
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (xForwardedFor) {
    if (Array.isArray(xForwardedFor)) return xForwardedFor[0].split(",")[0].trim();
    if (typeof xForwardedFor === "string") return xForwardedFor.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "0.0.0.0";
}

export const normalizeNZPhone = (phone) => {
  if (!phone?.trim()) return null;

  phone = phone.replace(/\D/g, "");

  // Short landlines missing leading 0
  if (phone.length === 7 || (phone.length === 8 && /^[2-9]/.test(phone))) {
    phone = "0" + phone;
  }

  return "+64" + (phone.startsWith("0") ? phone.slice(1) : phone);
};

export const obfuscateName = (name) => {
  if (!name) return "";
  return name.length <= 2 ? name[0] + "*" : name.slice(0, 2) + "*".repeat(name.length - 2);
}

export const obfuscateEmail = (email) => {
  if (!email || !email.includes("@")) return "";

  const [local, domain] = email.split("@");

  if (local.length <= 2) {
    return `${local[0] || "*"}***@${domain}`;
  }

  const visibleStart = local.slice(0, 2);
  const visibleEnd = local.length > 4 ? local.slice(-1) : "";
  const hiddenLength = local.length - visibleStart.length - visibleEnd.length;

  return `${visibleStart}${"*".repeat(Math.max(hiddenLength, 3))}${visibleEnd}@${domain}`;
}

// export function normalizeNZPhone(phone) {
//     phone = phone.replace(/\D/g, "");

//     if (phone.startsWith("64")) phone = `+${phone}`;
//     else if (phone.startsWith("0")) phone = `+64${phone.substring(1)}`;
//     else phone = `+64${phone}`;

//     // Optional: basic NZ number validation (mobile or landline)
//     if (!/^(\+64)(2\d{1,2}|[3-9]\d)\d{6,7}$/.test(phone)) {
//         throw new Error("Invalid NZ phone number");
//     }

//     return phone;
// }

export const generateShortId = (size = DEFAULT_LENGTH) => {
    let shortUUID = "";
    const bytes = crypto.randomBytes(size);
    for (let i = 0; i < size; i++) {
        shortUUID += CHARACTERS[bytes[i] % CHARACTERS.length];
    }
    return shortUUID;
}

export const generateEmailToken = (user) => {
  return jwt.sign(
    { uuid: user.uuid, email: user.email },
    EMAIL_SECRET,
    { expiresIn: EMAIL_TOKEN_EXPIRATION }
  );
};

export const verifyEmailToken = (token) => {
  return jwt.verify(token, EMAIL_SECRET);
};

export const formatExpiry = (expiry) => {
  const d = new Date(expiry);

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0"); // months are 0-indexed
  const yyyy = d.getFullYear();

  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");

  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

export const deleteAllFilesFromBucket = async () => {
  const bucketName = "quote-images";

  // List all files
  const { data: files, error: listError } = await supabase
    .storage
    .from(bucketName)
    .list("", { limit: 1000 });

  if (listError) {
    console.error("List error:", listError);
    return;
  }

  const filePaths = files.map((file) => file.name);

  // Delete files
  const { error: deleteError } = await supabase
    .storage
    .from(bucketName)
    .remove(filePaths);

  if (deleteError) {
    console.error("Delete error:", deleteError);
  } else {
    console.log("All files deleted!");
  }
}

export const capitalize = (str = "") => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const formatFullName = (
  firstName,
  lastName,
  singleName = false
) => {
  const capitalize = (str) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

  if (singleName) {
    return capitalize(firstName || lastName);
  }

  return `${capitalize(firstName)} ${capitalize(lastName)}`.trim();
};

export async function generateQuoteAccessToken(quoteId) {
  const rawToken = crypto.randomBytes(32).toString('hex');

  const tokenHash = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await QuoteAccessToken.create({
    quoteId,
    tokenHash,
    expiresAt
  });

  return rawToken; // ⚠️ ONLY returned once
}

// const client = new RecaptchaEnterpriseServiceClient({
//   keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
// });


export const verifyRecaptcha = async (token, version) => {
  if (version === "v3") {
    const secret = process.env.RECAPTCHA_V3_SECRET_KEY;
    const res = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`,
      { method: "POST" }
    );
    const data = await res.json();
      console.log({data}, "backend verifyRecaptcha v3")
    return data.success && data.score >= 0.5;
  } else if (version === "v2") {
    const secret = process.env.RECAPTCHA_V2_SECRET_KEY;
    const res = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`,
      { method: "POST" }
    );
    const data = await res.json();
    console.log({data}, "backend verifyRecaptcha")
    return data.success;
  } else {
    throw new Error("Invalid recaptcha version");
  }
};

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// export async function createQuoteAccessToken(quote) {
//   await QuoteAccessToken.revokeAllForQuote(quote.uuid);

//   const rawToken = crypto.randomBytes(32).toString("hex");
//   const token_hash = hashToken(rawToken);

//   const expires_at = new Date();
//   expires_at.setDate(expires_at.getDate() + TOKEN_EXPIRY_DAYS);

//   let tokenUUID;
//   let exists;
//   do {
//       tokenUUID = generateShortId(9);
//       exists = await QuoteAccessToken.findByUUID(tokenUUID);
//   } while (exists);

//   await QuoteAccessToken.create({
//     quote_uuid: quote.uuid,
//     token_hash,
//     expires_at: expires_at.toISOString(),
//     uuid: tokenUUID,
//   });

//   const quoteViewLink = `${process.env.CLIENT_URL}/quotes/view/${quote.uuid}?token=${rawToken}`;

//   // Build client email data with conditional fields
//   const emailData = {
//     quoteUUID: quote.uuid,
//     name: formatFullName(quote.contact_first_name, quote.contact_last_name),
//     total: quote.total_amount,
//     subtotal: quote.subtotal_amount,
//     gst: quote.gst_amount,
//     services: quote.services,
//     quoteLink: quoteViewLink,
//     expiry: formatExpiry(expires_at),
//   };

//   if (quote.contact_mobile) emailData.mobile = quote.contact_mobile;
//   if (quote.contact_landline) emailData.landline = quote.contact_landline;
//   if (quote.message) emailData.message = quote.message;
//   if (quote.contact_email) emailData.email = quote.contact_email;
//   if (quote.images && quote.images.length > 0) emailData.images = quote.images;

//   await sendQuoteToClient({
//     to: quote.contact_email,
//     subject: "Your Quote is Ready",
//     data: emailData,
//   });

//   return rawToken;
// }

export async function dispatchQuoteToClient(quote) {
  // Revoke any previous tokens for this quote
  await QuoteAccessToken.revokeAllForQuote(quote.uuid);

  // Generate a new random token and hash it for storage
  const rawToken = crypto.randomBytes(32).toString("hex");
  const token_hash = hashToken(rawToken);

  // Use the quote's expiry_end as token expiry
  // This ensures the token expires exactly when the quote expires
  const expires_at = new Date(quote.expiry_end);

  // Generate a unique UUID for this token
  let tokenUUID;
  let exists;
  do {
    tokenUUID = generateShortId(9);
    exists = await QuoteAccessToken.findByUUID(tokenUUID);
  } while (exists);

  // Save the token in the database
  await QuoteAccessToken.create({
    quote_uuid: quote.uuid,
    token_hash,
    expires_at: expires_at.toISOString(), // token expires with the quote
    uuid: tokenUUID,
  });

  // Build the client view link
  const quoteViewLink = `${process.env.CLIENT_URL}/quotes/view/${quote.uuid}?token=${rawToken}`;

  // Build client email data
  const emailData = {
    quoteUUID: quote.uuid,
    name: formatFullName(quote.contact_first_name, quote.contact_last_name),
    total: quote.total_amount,
    subtotal: quote.subtotal_amount,
    gst: quote.gst_amount,
    services: quote.services,
    quoteLink: quoteViewLink,
    expiry: formatExpiry(expires_at), // display human-readable expiry
  };

  // Include optional fields if present
  if (quote.contact_mobile) emailData.mobile = quote.contact_mobile;
  if (quote.contact_landline) emailData.landline = quote.contact_landline;
  if (quote.message) emailData.message = quote.message;
  if (quote.contact_email) emailData.email = quote.contact_email;
  if (quote.images && quote.images.length > 0) emailData.images = quote.images;

  // Send the email to the client
  await sendQuoteToClient({
    to: quote.contact_email,
    subject: "Your Quote is Ready",
    data: emailData,
  });

  // Return the raw token so you can send it in the frontend link
  return rawToken;
}

// export const generateQuotePDF = async (quote) => {
//   return new Promise((resolve, reject) => {
//     try {
//       const doc = new PDFDocument({ margin: 50 });

//       const chunks = [];
//       doc.on("data", (chunk) => chunks.push(chunk));
//       doc.on("end", () => resolve(Buffer.concat(chunks)));

//       // ===== Header =====
//       doc.fontSize(20).text("Lawn Mowing Quote", { align: "center" });
//       doc.moveDown();

//       // Business + Client Info
//       doc.fontSize(12);
//       doc.text(`Quote ID: ${quote.uuid}`);
//       doc.text(`Customer: ${quote.customer_name}`);
//       doc.text(`Address: ${quote.address}`);
//       doc.moveDown();

//       // Service Description
//       doc.fontSize(14).text("Service Details");
//       doc.fontSize(12);

//       quote.items?.forEach((item) => {
//         doc.text(`• ${item.description} - $${item.price}`);
//       });

//       doc.moveDown();

//       // Pricing
//       doc.fontSize(14).text("Pricing Summary");
//       doc.fontSize(12);
//       doc.text(`Subtotal: $${quote.subtotal}`);
//       doc.text(`GST: $${quote.gst}`);
//       doc.text(`Total: $${quote.total}`);

//       doc.moveDown();

//       if (quote.notes) {
//         doc.text("Notes:");
//         doc.text(quote.notes);
//       }

//       doc.end();
//     } catch (err) {
//       reject(err);
//     }
//   });
// };

// export const generateQuotePDF = async (quote) => {
//   return new Promise((resolve, reject) => {
//     try {
//       const doc = new PDFDocument({
//         margin: 50,
//         lineGap: 2,
//       });

//       const chunks = [];

//       doc.on("data", (chunk) => chunks.push(chunk));
//       doc.on("end", () => resolve(Buffer.concat(chunks)));

//       // ---------------------------
//       // Business Header
//       // ---------------------------

//       doc
//         .fontSize(22)
//         .text("Happy Lawns", { align: "center" });

//       doc.fontSize(13).text("QUOTE CONFIRMATION", { align: "center" });

//       doc.moveDown(1.5);

//       // Divider
//       doc
//         .moveTo(50, doc.y)
//         .lineTo(550, doc.y)
//         .stroke();

//       doc.moveDown(1.5);

//       // ---------------------------
//       // Document Meta
//       // ---------------------------

//       const customerName = `${quote.contact_first_name || ""} ${quote.contact_last_name || ""}`.trim();

//       doc.fontSize(11);

//       doc.text(`Quote Number: ${quote.uuid || "-"}`);
//       doc.text(
//         `Date Issued: ${
//           quote.created_at
//             ? new Date(quote.created_at).toLocaleDateString()
//             : "-"
//         }`
//       );

//       if (quote.responded_at) {
//         doc.text(
//           `Date Accepted: ${new Date(quote.responded_at).toLocaleDateString()}`
//         );
//       }

//       doc.moveDown();

//       // ---------------------------
//       // Client Block
//       // ---------------------------

//       doc.fontSize(13).text("Client Details");
//       doc.moveDown(0.5);

//       doc.fontSize(11);

//       doc.text(`Name: ${customerName || "-"}`);
//       doc.text(`Email: ${quote.contact_email || "-"}`);
//       doc.text(`Mobile: ${quote.contact_mobile || "-"}`);
//       doc.text(`Landline: ${quote.contact_landline || "-"}`);

//       doc.moveDown();

//       // ---------------------------
//       // Address Block
//       // ---------------------------

//       doc.fontSize(13).text("Service Address");
//       doc.moveDown(0.5);

//       doc.fontSize(11).text(quote.address || "-");

//       doc.moveDown();

//       // Divider
//       doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

//       doc.moveDown(1);

//       // ---------------------------
//       // Scope Block
//       // ---------------------------

//       doc.fontSize(13).text("Scope of Work");
//       doc.moveDown(0.7);

//       doc.fontSize(11);

//       quote.services?.forEach((service) => {
//         const lineTotal =
//           (service.quantity || 1) * (service.unit_price || 0);

//         doc.text(`• ${service.label || service.description || "Service"}`);

//         doc.text(
//           `  Qty: ${service.quantity || 1} | Unit Price: $${(
//             service.unit_price || 0
//           ).toFixed(2)} | Line Total: $${lineTotal.toFixed(2)}`
//         );

//         doc.moveDown(0.4);
//       });

//       doc.moveDown();

//       // Divider
//       doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

//       doc.moveDown();

//       // ---------------------------
//       // Pricing Block
//       // ---------------------------

//       doc.fontSize(13).text("Pricing Summary");
//       doc.moveDown(0.5);

//       doc.fontSize(11);

//       doc.text(
//         `Subtotal: $${(quote.subtotal_amount || 0).toFixed(2)}`
//       );

//       doc.text(
//         `GST (15%): $${(quote.gst_amount || 0).toFixed(2)}`
//       );

//       doc.moveDown(0.5);

//       doc.fontSize(14).text(
//         `TOTAL: $${(quote.total_amount || 0).toFixed(2)}`
//       );

//       doc.moveDown();

//       // ---------------------------
//       // Status Block
//       // ---------------------------

//       doc.fontSize(11);

//       doc.text("Status:");
//       doc.text(
//         "✅ This quote has been accepted. A job has been created."
//       );

//       doc.text(
//         "Scheduling confirmation will be sent once the job is booked."
//       );

//       doc.moveDown();

//       // ---------------------------
//       // Notes Block
//       // ---------------------------

//       if (quote.message) {
//         doc.fontSize(11).text("Client Message:");
//         doc.moveDown(0.3);

//         doc.text(quote.message);
//       }

//       // ---------------------------
//       // Footer
//       // ---------------------------

//       doc.fontSize(10);

//       doc
//         .moveDown(2)
//         .text(
//           "Thank you for choosing Happy Lawns",
//           { align: "center" }
//         );

//       doc
//         .text(
//           "For enquiries please contact support@happylawns.co.nz | 021 XXX XXXX",
//           { align: "center" }
//         );

//       doc.end();
//     } catch (err) {
//       reject(err);
//     }
//   });
// };

// export const generateQuotePDF = async (quote, customer = null) => {
//   return new Promise((resolve, reject) => {
//     try {
//       const doc = new PDFDocument({
//         margin: 50,
//         lineGap: 2,
//       });

//       const chunks = [];

//       doc.on("data", (chunk) => chunks.push(chunk));
//       doc.on("end", () => resolve(Buffer.concat(chunks)));

//       // ---------------------------
//       // Business Header
//       // ---------------------------

//       doc
//         .fontSize(22)
//         .text("Happy Lawns", { align: "center" });

//       doc.moveDown(0.5);
      
//       doc.fontSize(13)
//       .text("QUOTE CONFIRMATION", { align: "center" });
//       // Business Identification Block
//       doc
//         .fontSize(10)
//         .text(`NZBN: ${process.env.NZBN}`, { align: "center" });

//       doc
//         .text(`GST Number: ${process.env.GST}`, { align: "center" });

//       doc
//         .text(`Phone: ${process.env.CONTACT_NUM}`, { align: "center" });

//       doc
//         .text(`Email: ${process.env.CONTACT_EMAIL}`, { align: "center" });

//       doc
//         .text(`Address:  ${process.env.CONTACT_ADDRESS}`, { align: "center" });

//       doc.moveDown(1.5);

//       // Divider
//       doc
//         .moveTo(50, doc.y)
//         .lineTo(550, doc.y)
//         .stroke();

//       doc.moveDown(1.5);

//       // ---------------------------
//       // Document Meta
//       // ---------------------------

//       const customerName = `${quote.contact_first_name || ""} ${quote.contact_last_name || ""}`.trim();

//       doc.fontSize(11);

//       doc.text(`Quote Number: ${quote.uuid || "-"}`);
//       doc.text(
//         `Date Issued: ${
//           quote.created_at
//             ? new Date(quote.created_at).toLocaleDateString()
//             : "-"
//         }`
//       );

//       if (quote.responded_at) {
//         doc.text(
//           `Date Accepted: ${new Date(quote.responded_at).toLocaleDateString()}`
//         );
//       }

//       doc.moveDown();

//       // ---------------------------
//       // Client Block
//       // ---------------------------

//       doc.fontSize(13).text("Client Details");
//       doc.moveDown(0.5);

//       doc.fontSize(11);

//       doc.text(`Name: ${customerName || "-"}`);
//       doc.text(`Email: ${quote.contact_email || "-"}`);
//       doc.text(`Mobile: ${quote.contact_mobile || "-"}`);
//       doc.text(`Landline: ${quote.contact_landline || "-"}`);

//       doc.moveDown();

//       // ---------------------------
//       // Address Block
//       // ---------------------------

//       doc.fontSize(13).text("Service Address");
//       doc.moveDown(0.5);

//       doc.fontSize(11).text(quote.address || "-");

//       doc.moveDown();

//       // Divider
//       doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

//       doc.moveDown(1);

//       // ---------------------------
//       // Scope Block
//       // ---------------------------

//       doc.fontSize(13).text("Scope of Work");
//       doc.moveDown(0.7);

//       doc.fontSize(11);

//       quote.services?.forEach((service) => {
//         const lineTotal =
//           (service.quantity || 1) * (service.unit_price || 0);

//         doc.text(`• ${service.label || service.description || "Service"}`);

//         doc.text(
//           `  Qty: ${service.quantity || 1} | Unit Price: $${(
//             service.unit_price || 0
//           ).toFixed(2)} | Line Total: $${lineTotal.toFixed(2)}`
//         );

//         doc.moveDown(0.4);
//       });

//       doc.moveDown();

//       // Divider
//       doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

//       doc.moveDown();

//       // ---------------------------
//       // Pricing Block
//       // ---------------------------

//       doc.fontSize(13).text("Pricing Summary");
//       doc.moveDown(0.5);

//       doc.fontSize(11);

//       doc.text(
//         `Subtotal: $${(quote.subtotal_amount || 0).toFixed(2)}`
//       );

//       doc.text(
//         `GST (15%): $${(quote.gst_amount || 0).toFixed(2)}`
//       );

//       doc.moveDown(0.5);

//       doc.fontSize(14).text(
//         `TOTAL: $${(quote.total_amount || 0).toFixed(2)}`
//       );

//       doc.moveDown();

//       // ---------------------------
//       // Status Block
//       // ---------------------------

//       doc.fontSize(11);

//       doc.text("Status:");
//       doc.text(
//         "✅ This quote has been accepted. A job has been created."
//       );

//       doc.text(
//         "Scheduling confirmation will be sent once the job is booked."
//       );

//       doc.moveDown();

//       // ---------------------------
//       // Notes Block
//       // ---------------------------

//       if (quote.message) {
//         doc.fontSize(11).text("Client Message:");
//         doc.moveDown(0.3);

//         doc.text(quote.message);
//       }

//       // ---------------------------
//       // Footer
//       // ---------------------------

//       doc.fontSize(10);

//       doc
//         .moveDown(2)
//         .text(
//           "Thank you for choosing Happy Lawns",
//           { align: "center" }
//         );

//       doc
//         .text(
//           "For enquiries please contact support@happylawns.co.nz | 021 XXX XXXX",
//           { align: "center" }
//         );

//       doc.end();
//     } catch (err) {
//       reject(err);
//     }
//   });
// };

// export const generateQuotePDF = async (quote, customer = null, image) => {

//   return new Promise((resolve, reject) => {
//     try {
//       const doc = new PDFDocument({
//         margin: 50,
//         lineGap: 2,
//       });

//       const chunks = [];

//       doc.on("data", (chunk) => chunks.push(chunk));
//       doc.on("end", () => resolve(Buffer.concat(chunks)));

//       // ---------------------------
//       // Business Header
//       // ---------------------------

//       doc
//         .fontSize(22)
//         .text("Happy Lawns", { align: "center" });

//       doc.fontSize(13).text("QUOTE CONFIRMATION", { align: "center" });

//       doc
//         .fontSize(10)
//         .text(`NZBN: ${process.env.NZBN}`, { align: "center" });

//       doc
//         .text(`GST Number: ${process.env.GST}`, { align: "center" });

//       doc
//         .text(`Phone: ${process.env.CONTACT_NUM}`, { align: "center" });

//       doc
//         .text(`Email: ${process.env.CONTACT_EMAIL}`, { align: "center" });

//       doc
//         .text(`Address:  ${process.env.CONTACT_ADDRESS}`, { align: "center" });

//       doc.moveDown(1.5);

//       doc.moveTo(50, doc.y)
//         .lineTo(550, doc.y)
//         .stroke();

//       doc.moveDown(1.5);

//       // ---------------------------
//       // Document Meta
//       // ---------------------------
      
//       const customerName = `${capitalize(quote.contact_first_name) || ""} ${capitalize(quote.contact_last_name) || ""}`.trim();

//       doc.fontSize(11);

//       doc.text(`Quote Number: ${quote.uuid || "-"}`);
//       doc.text(
//         `Date Issued: ${
//           quote.created_at
//             ? new Date(quote.created_at).toLocaleDateString()
//             : "-"
//         }`
//       );

//       // ✅ Customer UUID / Customer ID (NEW)
//       if (customer?.uuid) {
//         doc.text(`Customer ID: ${customer.uuid}`);
//       }

//       if (quote.responded_at) {
//         doc.text(
//           `Date Accepted: ${new Date(quote.responded_at).toLocaleDateString()}`
//         );
//       }

//       doc.moveDown();

//       // ---------------------------
//       // Client Block
//       // ---------------------------

//       doc.fontSize(13).text("Client Details");
//       doc.moveDown(0.5);

//       doc.fontSize(11);

//       doc.text(`Name: ${customerName || "-"}`);
//       doc.text(`Email: ${quote.contact_email || "-"}`);
//       doc.text(`Mobile: ${quote.contact_mobile || "-"}`);
//       doc.text(`Landline: ${quote.contact_landline || "-"}`);

//       doc.moveDown();

//       // ---------------------------
//       // Address Block
//       // ---------------------------

//       doc.fontSize(13).text("Service Address");
//       doc.moveDown(0.5);

//       doc.fontSize(11).text(quote.address || "-");

//       doc.moveDown();

//       doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

//       doc.moveDown(1);

//       // ---------------------------
//       // Scope Block
//       // ---------------------------

//       doc.fontSize(13).text("Scope of Work");
//       doc.moveDown(0.7);

//       doc.fontSize(11);

//       quote.services?.forEach((service) => {
//         const lineTotal =
//           (service.quantity || 1) * (service.unit_price || 0);

//         doc.text(`• ${service.label || service.description || "Service"}`);

//         doc.text(
//           `  Qty: ${service.quantity || 1} | Unit Price: $${(
//             service.unit_price || 0
//           ).toFixed(2)} | Line Total: $${lineTotal.toFixed(2)}`
//         );

//         doc.moveDown(0.4);
//       });

//       doc.moveDown();

//       doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

//       doc.moveDown();

//       // ---------------------------
//       // Pricing Block
//       // ---------------------------

//       doc.fontSize(13).text("Pricing Summary");
//       doc.moveDown(0.5);

//       doc.fontSize(11);

//       doc.text(
//         `Subtotal: $${(quote.subtotal_amount || 0).toFixed(2)}`
//       );

//       doc.text(
//         `GST (15%): $${(quote.gst_amount || 0).toFixed(2)}`
//       );

//       doc.moveDown(0.5);

//       doc.fontSize(14).text(
//         `TOTAL: $${(quote.total_amount || 0).toFixed(2)}`
//       );

//       doc.moveDown();

//       // ---------------------------
//       // Status Block
//       // ---------------------------

//       doc.fontSize(11);
//       doc.text("Status:");

//       if (quote.status === "accepted") {
//         doc.text(
//           "✅ This quote has been accepted. A job has been created."
//         );
//       } else {
//         doc.text(`Current Status: ${quote.status || "draft"}`);
//       }

//       doc.text(
//         "Scheduling confirmation will be sent once the job is booked."
//       );

//       doc.moveDown();

//       // ---------------------------
//       // Notes Block
//       // ---------------------------

//       if (quote.message) {
//         doc.fontSize(11).text("Client Message:");
//         doc.moveDown(0.3);

//         doc.text(quote.message);
//       }

//       // ---------------------------
//       // Footer
//       // ---------------------------

//       doc.fontSize(10);

//       doc
//         .moveDown(2)
//         .text(
//           "Thank you for choosing Happy Lawns",
//           { align: "center" }
//         );

//       doc
//         .text(
//           "For enquiries please contact support@happylawns.co.nz | 021 XXX XXXX",
//           { align: "center" }
//         );

//       doc.end();
//     } catch (err) {
//       reject(err);
//     }
//   });
// };

export const generateQuotePDF = async (quote, customer = null) => {

  const path = require("path");
  const fs = require("fs");
  const PDFDocument = require("pdfkit");

  const headerImagePath = path.join(
    process.cwd(),
    "assets/pdf/happy-lawns-header.png"
  );

  let headerBuffer = null;

  try {
    headerBuffer = fs.readFileSync(headerImagePath);
  } catch (err) {
    console.error("Header asset load failed:", err.message);
  }

  return new Promise((resolve, reject) => {

    try {

      const doc = new PDFDocument({
        margin: 50,
        lineGap: 3
      });

      const chunks = [];

      doc.on("data", chunk => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const customerName = `${capitalize(quote.contact_first_name) || ""} ${
        capitalize(quote.contact_last_name) || ""
      }`.trim();

      // ======================================================
      // HEADER IMAGE (ABSOLUTE TOP)
      // ======================================================

      const HEADER_HEIGHT = 120;

      if (headerBuffer) {
        doc.image(
          headerBuffer,
          0,
          0,
          {
            width: doc.page.width,
            height: HEADER_HEIGHT,
            fit: [doc.page.width, HEADER_HEIGHT]
          }
        );
      }

      // Move cursor below header band
      doc.y = HEADER_HEIGHT + 20;

      // ======================================================
      // TITLE SECTION
      // ======================================================

      doc.fontSize(14).fillColor("black");

      doc.text("QUOTE CONFIRMATION", {
        align: "center"
      });

      doc.moveDown(0.5);

      doc.fontSize(11);

      doc.text(`Quote Number: ${quote.uuid || "-"}`, {
        align: "center"
      });

      doc.text(
        `Date Issued: ${
          quote.created_at
            ? new Date(quote.created_at).toLocaleDateString()
            : "-"
        }`,
        { align: "center" }
      );

      if (quote.responded_at) {
        doc.text(
          `Date Accepted: ${new Date(quote.responded_at).toLocaleDateString()}`,
          { align: "center" }
        );
      }

      // ======================================================
      // BUSINESS DETAILS BLOCK
      // ======================================================

      doc.moveDown(1);

      doc.fontSize(11).text(`NZBN: ${process.env.NZBN || "-"}`, {
        align: "center"
      });

      doc.text(`GST Number: ${process.env.GST || "-"}`, {
        align: "center"
      });

      doc.text(`Phone: ${process.env.CONTACT_NUM || "-"}`, {
        align: "center"
      });

      doc.text(`Email: ${process.env.CONTACT_EMAIL || "-"}`, {
        align: "center"
      });

      doc.text(`Address: ${process.env.CONTACT_ADDRESS || "-"}`, {
        align: "center"
      });

      doc.moveDown(1);

      // ======================================================
      // CLIENT DETAILS
      // ======================================================

      doc.fontSize(13).text("Client Details");
      doc.moveDown(0.5);

      doc.fontSize(11);

      doc.text(`Name: ${customerName || "-"}`);
      doc.text(`Email: ${quote.contact_email || "-"}`);
      doc.text(`Mobile: ${quote.contact_mobile || "-"}`);
      doc.text(`Landline: ${quote.contact_landline || "-"}`);

      doc.moveDown(1);

      doc.fontSize(13).text("Service Address");
      doc.moveDown(0.3);

      doc.fontSize(11).text(quote.address || "-");

      doc.moveDown(1);

      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

      doc.moveDown(1);

      // ======================================================
      // SCOPE TABLE
      // ======================================================

      doc.fontSize(13).text("Scope of Work");
      doc.moveDown(0.6);

      const tableStartY = doc.y + 10;

      const colService = 50;
      const colQty = 250;
      const colUnitPrice = 330;
      const colTotal = 430;

      doc.rect(50, tableStartY, 500, 22).fill("#f0fdf4");

      doc.fillColor("black");
      doc.fontSize(10);

      doc.text("Service", colService, tableStartY + 6);
      doc.text("Qty", colQty, tableStartY + 6);
      doc.text("Unit Price", colUnitPrice, tableStartY + 6);
      doc.text("Line Total", colTotal, tableStartY + 6);

      let y = tableStartY + 28;

      quote.services?.forEach(service => {

        const lineTotal =
          (service.quantity || 1) *
          (service.unit_price || 0);

        doc.fontSize(10);

        doc.text(
          service.label ||
          service.description ||
          "Service",
          colService,
          y
        );

        doc.text((service.quantity || 1).toString(), colQty, y);

        doc.text(
          `$${(service.unit_price || 0).toFixed(2)}`,
          colUnitPrice,
          y
        );

        doc.text(
          `$${lineTotal.toFixed(2)}`,
          colTotal,
          y
        );

        y += 22;
      });

      // ======================================================
      // PRICING SUMMARY
      // ======================================================

      doc.moveDown(2);

      doc.fontSize(11);

      doc.text(
        `Subtotal: $${(quote.subtotal_amount || 0).toFixed(2)}`
      );

      doc.text(
        `GST (15%): $${(quote.gst_amount || 0).toFixed(2)}`
      );

      doc.moveDown(0.5);

      doc.fontSize(14).text(
        `TOTAL: $${(quote.total_amount || 0).toFixed(2)}`
      );

      doc.moveDown(1);

      // ======================================================
      // FOOTER
      // ======================================================

      const FOOTER_Y = doc.page.height - 80;

      doc.fontSize(10).fillColor("black");

      doc.text(
        "Thank you for choosing Happy Lawns",
        50,
        FOOTER_Y,
        {
          align: "center",
          width: 500
        }
      );

      doc.text(
        "For enquiries please contact support@happylawns.co.nz | 021 XXX XXXX",
        50,
        FOOTER_Y + 15,
        {
          align: "center",
          width: 500
        }
      );

      doc.end();

    } catch (err) {
      reject(err);
    }
  });
};

//good but no summary
// export const generateQuotePDF = async (quote, customer = null) => {

//   const headerImagePath = path.join(
//     process.cwd(),
//     "assets/pdf/happy-lawns-header.png"
//   );

//   let headerBuffer = null;

//   try {
//     headerBuffer = fs.readFileSync(headerImagePath);
//   } catch (err) {
//     console.error("Header asset load failed:", err.message);
//   }

//   return new Promise((resolve, reject) => {

//     try {

//       const doc = new PDFDocument({
//         margin: 50,
//         lineGap: 3
//       });

//       const chunks = [];

//       doc.on("data", chunk => chunks.push(chunk));
//       doc.on("end", () => resolve(Buffer.concat(chunks)));
//       doc.on("error", reject);

//       const customerName = `${capitalize(quote.contact_first_name) || ""} ${
//         capitalize(quote.contact_last_name) || ""
//       }`.trim();

//       // ===============================
//       // Header Image (Top Absolute)
//       // ===============================

//       const HEADER_HEIGHT = 120;

//       if (headerBuffer) {
//         doc.image(
//           headerBuffer,
//           0,
//           0,
//           {
//             width: doc.page.width,
//             height: HEADER_HEIGHT,
//             fit: [doc.page.width, HEADER_HEIGHT]
//           }
//         );
//       }

//       // Move cursor below header
//       doc.y = HEADER_HEIGHT + 20;

//       // ===============================
//       // Document Title Section
//       // ===============================

//       doc.fontSize(14).fillColor("black");

//       doc.text("QUOTE CONFIRMATION", {
//         align: "center"
//       });

//       doc.moveDown(0.5);

//       doc.fontSize(11);

//       doc.text(
//         `Quote Number: ${quote.uuid || "-"}`,
//         { align: "center" }
//       );

//       doc.text(
//         `Date Issued: ${
//           quote.created_at
//             ? new Date(quote.created_at).toLocaleDateString()
//             : "-"
//         }`,
//         { align: "center" }
//       );

//       if (quote.responded_at) {
//         doc.text(
//           `Date Accepted: ${new Date(
//             quote.responded_at
//           ).toLocaleDateString()}`,
//           { align: "center" }
//         );
//       }

//       doc.moveDown(1);

//       // ===============================
//       // Client Details
//       // ===============================

//       doc.fontSize(13).text("Client Details");
//       doc.moveDown(0.5);

//       doc.fontSize(11);

//       doc.text(`Name: ${customerName || "-"}`);
//       doc.text(`Email: ${quote.contact_email || "-"}`);
//       doc.text(`Mobile: ${quote.contact_mobile || "-"}`);
//       doc.text(`Landline: ${quote.contact_landline || "-"}`);

//       doc.moveDown(1);

//       doc.fontSize(13).text("Service Address");
//       doc.moveDown(0.3);

//       doc.fontSize(11).text(quote.address || "-");

//       doc.moveDown(1);

//       doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

//       doc.moveDown(1);

//       // ===============================
//       // Scope Table
//       // ===============================

//       doc.fontSize(13).text("Scope of Work");

//       doc.moveDown(0.6);

//       const tableStartY = doc.y + 10;

//       const colService = 50;
//       const colQty = 250;
//       const colUnitPrice = 330;
//       const colTotal = 430;

//       doc.rect(50, tableStartY, 500, 22).fill("#f0fdf4");

//       doc.fillColor("black");
//       doc.fontSize(10);

//       doc.text("Service", colService, tableStartY + 6);
//       doc.text("Qty", colQty, tableStartY + 6);
//       doc.text("Unit Price", colUnitPrice, tableStartY + 6);
//       doc.text("Line Total", colTotal, tableStartY + 6);

//       let y = tableStartY + 28;

//       quote.services?.forEach(service => {

//         const lineTotal =
//           (service.quantity || 1) *
//           (service.unit_price || 0);

//         doc.fontSize(10);

//         doc.text(
//           service.label ||
//           service.description ||
//           "Service",
//           colService,
//           y
//         );

//         doc.text(
//           (service.quantity || 1).toString(),
//           colQty,
//           y
//         );

//         doc.text(
//           `$${(service.unit_price || 0).toFixed(2)}`,
//           colUnitPrice,
//           y
//         );

//         doc.text(
//           `$${lineTotal.toFixed(2)}`,
//           colTotal,
//           y
//         );

//         y += 22;
//       });

//       // ===============================
//       // Footer Section
//       // ===============================

//       const FOOTER_Y = doc.page.height - 80;

//       doc.fontSize(10).fillColor("black");

//       doc.text(
//         "Thank you for choosing Happy Lawns",
//         50,
//         FOOTER_Y,
//         {
//           align: "center",
//           width: 500
//         }
//       );

//       doc.text(
//         "For enquiries please contact support@happylawns.co.nz | 021 XXX XXXX",
//         50,
//         FOOTER_Y + 15,
//         {
//           align: "center",
//           width: 500
//         }
//       );

//       doc.end();

//     } catch (err) {
//       reject(err);
//     }
//   });
// };

// Header
// ------------------------------------------------
// Document Meta

// Client Block
// ------------------------------------------------
// Service Address Block

// Scope Block
// ------------------------------------------------
// Pricing Table Style Block

// Status Block
// ------------------------------------------------
// Notes Block

// Footer