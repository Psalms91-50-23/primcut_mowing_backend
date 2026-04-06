
import crypto from 'crypto';
const CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz";
const DEFAULT_LENGTH = 8;
import jwt from 'jsonwebtoken';
import QuoteAccessToken from '../models/QuoteAccessToken.js';
import { sendQuoteToClient } from "../lib/email/index.js";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { createChangeLogSafe }  from "../util/createChangeLogSafe.js";
import ChangeLog from '../models/ChangeLog.js';

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

  // remove everything except digits
  phone = phone.replace(/\D/g, "");

  // already in 64 format
  if (phone.startsWith("64")) {
    return "+" + phone;
  }

  // local number starting with 0
  if (phone.startsWith("0")) {
    return "+64" + phone.slice(1);
  }

  // short landlines missing leading 0
  if (phone.length === 7 || (phone.length === 8 && /^[2-9]/.test(phone))) {
    return "+64" + phone;
  }

  // fallback (assume missing 0)
  return "+64" + phone;
};

// export const normalizeNZPhone = (phone) => {
//   if (!phone?.trim()) return null;

//   phone = phone.replace(/\D/g, "");

//   // Short landlines missing leading 0
//   if (phone.length === 7 || (phone.length === 8 && /^[2-9]/.test(phone))) {
//     phone = "0" + phone;
//   }

//   return "+64" + (phone.startsWith("0") ? phone.slice(1) : phone);
// };

export const obfuscatePhoneNumber = (phone) => {
  if (!phone) return "";

  const cleaned = String(phone).replace(/\s+/g, "");

  if (cleaned.length <= 4) {
    return "*".repeat(cleaned.length);
  }

  const visibleStart = cleaned.slice(0, 3);
  const visibleEnd = cleaned.slice(-2);
  const hiddenLength = Math.max(cleaned.length - 5, 3);

  return `${visibleStart}${"*".repeat(hiddenLength)}${visibleEnd}`;
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
};

export const obfuscateAddress = (address) => {
  if (!address) return "";

  const parts = String(address).split(",");
  const firstPart = parts[0]?.trim() || "";

  if (!firstPart) return "******";

  const firstSpace = firstPart.indexOf(" ");
  if (firstSpace === -1) {
    return `${firstPart.slice(0, 2)}******`;
  }

  const houseNumber = firstPart.slice(0, firstSpace);
  const streetName = firstPart.slice(firstSpace + 1);

  const visibleStreet = streetName.slice(0, 2);
  return `${houseNumber} ${visibleStreet}${"*".repeat(Math.max(streetName.length - 2, 4))}`;
};

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

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizedEmail = (email) => {
  return email?.trim().toLowerCase() || null;
};

export const normalizePhone = (value = "") => {
  return String(value).replace(/\D/g, "");
};

export const getPhoneCandidates = (value = "") => {
  const digits = normalizePhone(value);
  if (!digits) return [];

  const set = new Set([digits]);

  // NZ local <-> +64 variants
  if (digits.startsWith("0")) {
    set.add(`64${digits.slice(1)}`);
  }

  if (digits.startsWith("64")) {
    set.add(`0${digits.slice(2)}`);
  }

  return Array.from(set).filter(Boolean);
}

export const phoneMatches = (searchValue = "", storedValue = "") => {
  const searchCandidates = getPhoneCandidates(searchValue);
  const storedCandidates = getPhoneCandidates(storedValue);

  return searchCandidates.some((search) =>
    storedCandidates.some(
      (stored) =>
        stored.includes(search) ||
        search.includes(stored) ||
        stored.endsWith(search) ||
        search.endsWith(stored)
    )
  );
}

export const generatePrefixedId = (prefix, size = DEFAULT_LENGTH) => {
    let id = "";
    const bytes = crypto.randomBytes(size);

    for (let i = 0; i < size; i++) {
        id += CHARACTERS[bytes[i] % CHARACTERS.length];
    }

    return prefix + id;
};

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

export function hashToken(rawToken) {
  return crypto
    .createHash("sha256")
    .update(String(rawToken), "utf8")
    .digest("hex");
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

// export const generateQuotePDF = async (quote, customer = null) => {
//   const headerImagePath = path.join(
//     process.cwd(),
//     "assets/pdf/happy-house-header.png"
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
//         lineGap: 3,
//       });

//       const pageLeft = doc.page.margins.left;
//       const pageRight = doc.page.width - doc.page.margins.right;
//       const contentWidth = pageRight - pageLeft;
//       const chunks = [];

//       doc.on("data", (chunk) => chunks.push(chunk));
//       doc.on("end", () => resolve(Buffer.concat(chunks)));
//       doc.on("error", reject);



//       const customerName = `${capitalize(
//         quote.contact_first_name
//       ) || ""} ${capitalize(quote.contact_last_name) || ""}`.trim();

//       // ======================================================
//       // HEADER IMAGE
//       // ======================================================

//       const HEADER_HEIGHT = 70;

//       if (headerBuffer) {
//         doc.image(headerBuffer, 0, 0, {
//           width: doc.page.width,
//           height: HEADER_HEIGHT,
//         });
//       }

//       doc.y = HEADER_HEIGHT + 20;

//       // ======================================================
//       // TITLE SECTION (CENTERED)
//       // ======================================================

//       doc.fontSize(14).fillColor("black");

//       doc.text(`Quote Confirmation`, pageLeft, doc.y, {
//         align: "left",
//       });

//       doc.fontSize(11).fillColor("black");
//       doc.text(`Quote Number: ${quote.uuid || "-"}`, pageLeft, doc.y,{
//         align: "left",
//       });

//       doc.text(
//         `Date Issued: ${
//           quote.created_at
//             ? new Date(quote.created_at).toLocaleDateString()
//             : "-"
//         }`,
//         pageLeft, doc.y,
//         { align: "left" }
//       );

//       if (quote.responded_at) {
//         doc.text(
//           `Date Accepted: ${new Date(
//             quote.responded_at
//           ).toLocaleDateString()}`,
//           { align: "left" }
//         );
//       }

//       doc.moveDown(1.5);

//       // ======================================================
//       // TWO COLUMN LAYOUT
//       // LEFT: CLIENT
//       // RIGHT: EMPLOYER
//       // ======================================================

//       // const pageLeft = doc.page.margins.left;
//       // const pageRight = doc.page.width - doc.page.margins.right;
//       // const contentWidth = pageRight - pageLeft;

//       const gap = 20;
//       const leftColWidth = Math.floor(contentWidth * 0.58);
//       const rightColWidth = contentWidth - leftColWidth - gap;

//       const leftX = pageLeft;
//       const rightX = leftX + leftColWidth + gap;

//       const blockTopY = doc.y;

//       // -----------------------------
//       // RIGHT COLUMN (Employer)
//       // -----------------------------
//       doc.fontSize(13).fillColor("black");
//       doc.text(`Business Details`, rightX, blockTopY, {
//         width: rightColWidth,
//         align: "right",
//       });

//       doc.moveDown(0.5);
      
//       doc.fontSize(11).fillColor("black");

//       // doc.text(`NZBN: ${process.env.NZBN || "-"}`, rightX, blockTopY, {
//       //   width: rightColWidth,
//       //   align: "right",
//       // });

//       // doc.text(`GST Number: ${process.env.GST || "-"}`, {
//       //   width: rightColWidth,
//       //   align: "right",
//       // });

//       doc.text(`Phone: ${process.env.CONTACT_NUM || "-"}`, {
//         width: rightColWidth,
//         align: "right",
//       });

//       doc.text(`Email: ${process.env.CONTACT_EMAIL || "-"}`, {
//         width: rightColWidth,
//         align: "right",
//       });

//       doc.text(`Address: ${process.env.CONTACT_ADDRESS || "-"}`, {
//         width: rightColWidth,
//         align: "right",
//       });

//       const rightBottomY = doc.y;

//       // -----------------------------
//       // LEFT COLUMN (Client)
//       // -----------------------------

//       doc.y = blockTopY;

//       doc.fontSize(13).fillColor("black").text("Client Details", leftX, doc.y, {
//         width: leftColWidth,
//       });

//       doc.moveDown(0.5);

//       doc.fontSize(11);

//       doc.text(`Name: ${customerName || "-"}`, leftX, doc.y, {
//         width: leftColWidth,
//       });

//       doc.text(`Email: ${quote.contact_email || "-"}`, {
//         width: leftColWidth,
//       });

//       doc.text(`Mobile: ${quote.contact_mobile || "-"}`, {
//         width: leftColWidth,
//       });

//       doc.text(`Landline: ${quote.contact_landline || "-"}`, {
//         width: leftColWidth,
//       });

//       doc.moveDown(1);

//       doc.fontSize(13).text("Service Address", leftX, doc.y, {
//         width: leftColWidth,
//       });

//       doc.moveDown(0.3);

//       doc.fontSize(11).text(quote.address || "-", leftX, doc.y, {
//         width: leftColWidth,
//       });

//       const leftBottomY = doc.y;

//       // Move below tallest column
//       doc.y = Math.max(leftBottomY, rightBottomY);

//       doc.moveDown(1);

//       // Divider
//       doc.moveTo(pageLeft, doc.y).lineTo(pageRight, doc.y).stroke();
//       doc.moveDown(1);

//       // ======================================================
//       // SCOPE TABLE
//       // ======================================================

//       doc.fontSize(13).fillColor("black").text("Scope of Work");
//       doc.moveDown(0.6);

//       const tableStartY = doc.y + 10;

//       const colService = pageLeft;
//       const colQty = pageLeft + 200;
//       const colUnitPrice = pageLeft + 280;
//       const colTotal = pageLeft + 380;

//       doc.rect(pageLeft, tableStartY, contentWidth, 22).fill("#f0fdf4");

//       doc.fillColor("black").fontSize(12);

//       doc.text("Service", colService, tableStartY + 6);
//       doc.text("Qty", colQty, tableStartY + 6);
//       doc.text("Unit Price", colUnitPrice, tableStartY + 6);
//       doc.text("Line Total", colTotal, tableStartY + 6);

//       let y = tableStartY + 28;

//       quote.services?.forEach((service) => {
//         const lineTotal =
//           (service.quantity || 1) * (service.unit_price || 0);

//         doc.fontSize(10).fillColor("black");

//         doc.text(
//           service.label || service.description || "Service",
//           colService,
//           y
//         );

//         doc.text((service.quantity || 1).toString(), colQty, y);

//         doc.text(
//           `$${(service.unit_price || 0).toFixed(2)}`,
//           colUnitPrice,
//           y
//         );

//         doc.text(`$${lineTotal.toFixed(2)}`, colTotal, y);

//         y += 22;
//       });

//       // ======================================================
//       // PRICING SUMMARY
//       // ======================================================

//       doc.moveDown(2);

//       doc.fontSize(11).fillColor("black");
//       doc.text(`Subtotal: $${(quote.subtotal_amount || 0).toFixed(2)}`);

//       doc.text(`GST (15%): $${(quote.gst_amount || 0).toFixed(2)}`);

//       doc.moveDown(0.5);

//       doc.fontSize(12).text(`TOTAL: $${(quote.total_amount || 0).toFixed(2)}`);

//       doc.moveDown(1);

//       // ======================================================
//       // FOOTER
//       // ======================================================

//       const FOOTER_Y = doc.page.height - 80;

//       doc.fontSize(10).fillColor("black");

//       doc.text("Thank you for choosing Happy Lawns", pageLeft, FOOTER_Y, {
//         align: "center",
//         width: contentWidth,
//       });

//       doc.text(
//         "For enquiries please contact support@happylawns.co.nz | 021 XXX XXXX",
//         pageLeft,
//         FOOTER_Y + 15,
//         {
//           align: "center",
//           width: contentWidth,
//         }
//       );

//       // ======================================================
//       // BOTTOM GREEN BAR (5px) - Tailwind bg-green-900 (#14532d)
//       // ======================================================

//       const GREEN_900 = "#14532d"; // Tailwind bg-green-900
//       const BAR_HEIGHT = 10;

//       doc.save();
//       doc
//         .fillColor(GREEN_900)
//         .rect(0, doc.page.height - BAR_HEIGHT, doc.page.width, BAR_HEIGHT)
//         .fill();
//       doc.restore();

//       doc.end();
//     } catch (err) {
//       reject(err);
//     }
//   });
// };

export const generateQuotePDF = async (quote, customer = null) => {
  const headerImagePath = path.join(
    process.cwd(),
    "assets/pdf/happy-house-header.png"
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
        lineGap: 3,
      });

      const pageLeft = doc.page.margins.left;
      const pageRight = doc.page.width - doc.page.margins.right;
      const contentWidth = pageRight - pageLeft;

      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const customerName = `${capitalize(quote.contact_first_name) || ""} ${
        capitalize(quote.contact_last_name) || ""
      }`.trim();

      // ======================================================
      // HEADER IMAGE
      // ======================================================

      const HEADER_HEIGHT = 70;

      if (headerBuffer) {
        doc.image(headerBuffer, 0, 0, {
          width: doc.page.width,
          height: HEADER_HEIGHT,
        });
      }

      doc.y = HEADER_HEIGHT + 20;

      // ======================================================
      // TITLE SECTION (LEFT)
      // ======================================================

      doc.fontSize(14).fillColor("black");
      doc.text(`Quote Confirmation`, pageLeft, doc.y, { align: "left" });

      doc.fontSize(11).fillColor("black");
      doc.text(`Quote Number: ${quote.uuid || "-"}`, pageLeft, doc.y, {
        align: "left",
      });

      doc.text(
        `Date Issued: ${
          quote.created_at
            ? new Date(quote.created_at).toLocaleDateString()
            : "-"
        }`,
        pageLeft,
        doc.y,
        { align: "left" }
      );

      if (quote.responded_at) {
        doc.text(
          `Date Accepted: ${new Date(quote.responded_at).toLocaleDateString()}`,
          pageLeft,
          doc.y,
          { align: "left" }
        );
      }

      doc.moveDown(1.5);

      // ======================================================
      // TWO COLUMN LAYOUT
      // LEFT: CLIENT
      // RIGHT: EMPLOYER
      // ======================================================

      const gap = 20;
      const leftColWidth = Math.floor(contentWidth * 0.58);
      const rightColWidth = contentWidth - leftColWidth - gap;

      const leftX = pageLeft;
      const rightX = leftX + leftColWidth + gap;

      const blockTopY = doc.y;

      // -----------------------------
      // RIGHT COLUMN (Business)
      // -----------------------------
      doc.fontSize(13).fillColor("black");
      doc.text(`Business Details`, rightX, blockTopY, {
        width: rightColWidth,
        align: "right",
      });

      doc.moveDown(0.5);

      doc.fontSize(11).fillColor("black");
      doc.text(`Phone: ${process.env.CONTACT_NUM || "-"}`, {
        width: rightColWidth,
        align: "right",
      });

      doc.text(`Email: ${process.env.CONTACT_EMAIL || "-"}`, {
        width: rightColWidth,
        align: "right",
      });

      doc.text(`Address: ${process.env.CONTACT_ADDRESS || "-"}`, {
        width: rightColWidth,
        align: "right",
      });

      const rightBottomY = doc.y;

      // -----------------------------
      // LEFT COLUMN (Client)
      // -----------------------------
      doc.y = blockTopY;

      doc.fontSize(13).fillColor("black").text("Client Details", leftX, doc.y, {
        width: leftColWidth,
      });

      doc.moveDown(0.5);

      doc.fontSize(11);
      doc.text(`Name: ${customerName || "-"}`, leftX, doc.y, {
        width: leftColWidth,
      });

      doc.text(`Email: ${quote.contact_email || "-"}`, {
        width: leftColWidth,
      });

      doc.text(`Mobile: ${quote.contact_mobile || "-"}`, {
        width: leftColWidth,
      });

      doc.text(`Landline: ${quote.contact_landline || "-"}`, {
        width: leftColWidth,
      });

      doc.moveDown(1);

      doc.fontSize(13).text("Service Address", leftX, doc.y, {
        width: leftColWidth,
      });

      doc.moveDown(0.3);

      doc.fontSize(11).text(quote.address || "-", leftX, doc.y, {
        width: leftColWidth,
      });

      const leftBottomY = doc.y;

      // Move below tallest column
      doc.y = Math.max(leftBottomY, rightBottomY);

      doc.moveDown(1);

      // Divider
      doc.moveTo(pageLeft, doc.y).lineTo(pageRight, doc.y).stroke();
      doc.moveDown(1);

      // ======================================================
      // SCOPE TABLE
      // ======================================================

      doc.fontSize(13).fillColor("black").text("Scope of Work");
      doc.moveDown(0.6);

      const tableStartY = doc.y + 10;

      // ---- table columns (use a shared "money column" anchored to pageRight)
      const MONEY_COL_WIDTH = 110; // currency column width (right aligned)
      const MONEY_COL_X = pageRight - MONEY_COL_WIDTH;

      const QTY_COL_WIDTH = 50;
      const UNIT_COL_WIDTH = 90;

      const colServiceX = pageLeft;
      const colQtyX = MONEY_COL_X - UNIT_COL_WIDTH - QTY_COL_WIDTH - 20; // 20 = spacing buffer
      const colUnitPriceX = MONEY_COL_X - UNIT_COL_WIDTH - 10; // 10 = spacing buffer

      // header background
      doc.rect(pageLeft, tableStartY, contentWidth, 22).fill("#f0fdf4");

      doc.fillColor("black").fontSize(12);

      // headers
      doc.text("Service", colServiceX, tableStartY + 6, {
        width: colQtyX - colServiceX - 10,
        align: "left",
      });

      doc.text("Qty", colQtyX, tableStartY + 6, {
        width: QTY_COL_WIDTH,
        align: "right",
      });

      doc.text("Unit Price", colUnitPriceX, tableStartY + 6, {
        width: UNIT_COL_WIDTH,
        align: "right",
      });

      // ✅ Line Total header aligned to the same right edge as summary totals
      doc.text("Line Total", MONEY_COL_X, tableStartY + 6, {
        width: MONEY_COL_WIDTH,
        align: "right",
      });

      let y = tableStartY + 28;

      quote.services?.forEach((service) => {
        const qty = service.quantity || 1;
        const unit = service.unit_price || 0;
        const lineTotal = qty * unit;

        doc.fontSize(10).fillColor("black");

        // Service
        doc.text(service.label || service.description || "Service", colServiceX, y, {
          width: colQtyX - colServiceX - 10,
          align: "left",
        });

        // Qty (right aligned)
        doc.text(qty.toString(), colQtyX, y, {
          width: QTY_COL_WIDTH,
          align: "right",
        });

        // Unit Price (right aligned)
        doc.text(`$${unit.toFixed(2)}`, colUnitPriceX, y, {
          width: UNIT_COL_WIDTH,
          align: "right",
        });

        // ✅ Line Total (right aligned to same column as summary)
        doc.text(`$${lineTotal.toFixed(2)}`, MONEY_COL_X, y, {
          width: MONEY_COL_WIDTH,
          align: "right",
        });

        y += 22;
      });

      // ======================================================
      // PRICING SUMMARY (aligned to same money column)
      // ======================================================

      doc.moveDown(2);

      const LABEL_WIDTH = 140;
      const LABEL_X = MONEY_COL_X - LABEL_WIDTH;

      doc.fontSize(11).fillColor("black");

      // Subtotal
      doc.text("Subtotal:", LABEL_X, doc.y, { width: LABEL_WIDTH, align: "right" });
      doc.text(`$${(quote.subtotal_amount || 0).toFixed(2)}`, MONEY_COL_X, doc.y - 15, {
        width: MONEY_COL_WIDTH,
        align: "right",
      });

      // GST
      doc.moveDown(0.5);
      doc.text("GST (15%):", LABEL_X, doc.y, { width: LABEL_WIDTH, align: "right" });
      doc.text(`$${(quote.gst_amount || 0).toFixed(2)}`, MONEY_COL_X, doc.y - 15, {
        width: MONEY_COL_WIDTH,
        align: "right",
      });

      // TOTAL
      doc.moveDown(0.6);
      doc.fontSize(12).font("Helvetica-Bold");
      doc.text("TOTAL:", LABEL_X, doc.y, { width: LABEL_WIDTH, align: "right" });
      doc.text(`$${(quote.total_amount || 0).toFixed(2)}`, MONEY_COL_X, doc.y - 15, {
        width: MONEY_COL_WIDTH,
        align: "right",
      });
      doc.font("Helvetica");

      doc.moveDown(1);

      // ======================================================
      // FOOTER
      // ======================================================

      const FOOTER_Y = doc.page.height - 80;

      doc.fontSize(10).fillColor("black");

      doc.text("Thank you for choosing Happy Property", pageLeft, FOOTER_Y, {
        align: "center",
        width: contentWidth,
      });

      doc.text(
        "For enquiries please contact support@happyproperty.co.nz | 021 XXX XXXX",
        pageLeft,
        FOOTER_Y + 15,
        {
          align: "center",
          width: contentWidth,
        }
      );

      // ======================================================
      // BOTTOM GREEN BAR - Tailwind bg-green-900 (#14532d)
      // ======================================================

      const GREEN_900 = "#14532d";
      const BAR_HEIGHT = 5;

      doc.save();
      doc
        .fillColor(GREEN_900)
        .rect(0, doc.page.height - BAR_HEIGHT, doc.page.width, BAR_HEIGHT)
        .fill();
      doc.restore();

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

export const formatNZDate = (dateString) => {
  const date = new Date(dateString);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

function escapeLike(value) {
  return String(value ?? "")
    .replace(/[%_]/g, "")   // prevent wildcard breaking
    .replace(/,/g, "")      // keep your comma removal
    .trim();
}

export function buildSearchOr(terms, columns) {
  const filters = [];

  for (const rawTerm of terms) {
    const term = escapeLike(rawTerm);
    if (!term) continue;

    for (const column of columns) {
      filters.push(`${column}.ilike.%${term}%`);
    }
  }

  return filters.join(",");
}
// export const buildSearchOr = (terms, columns) => {
//   const filters = [];

//   for (const rawTerm of terms) {
//     const term = String(rawTerm || "").trim().replace(/,/g, "");
//     if (!term) continue;

//     for (const column of columns) {
//       filters.push(`${column}.ilike.%${term}%`);
//     }
//   }

//   return filters.join(",");
// }

export const clampInt = (n, fallback, min, max) => {
  const x = parseInt(String(n), 10);
  if (Number.isNaN(x)) return fallback;
  return Math.min(Math.max(x, min), max);
}

export const toNZDateStringFromISO = (value) => {
  if (!value) return null;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) return null;

  return `${year}-${month}-${day}`;
}

export const isPlainDateString = (value) => {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
};

export const localDateToISO = (localDate) => {
  if (!localDate || !isPlainDateString(localDate)) return null;
  return new Date(`${localDate}T00:00:00`).toISOString();
};

export const formatMoney = (value) =>
  Number(value || 0).toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const normalizeVersion = (version) => {
  const trimmed = String(version).trim().toLowerCase();
  const noPrefix = trimmed.replace(/^v+/, "");
  return `v${noPrefix}`;
};

export const generateUniqueChangeLogUUID = async () => {
  let uuid;
  let exists;

  do {
    uuid = generatePrefixedId("CL", 7);
    exists = await ChangeLog.findByUUID(uuid);
  } while (exists);

  return uuid;
};

export const cleanTermsForPDF = (text) => {
  if (!text) return "";

  return text
    // Remove headings (#, ##, ###)
    .replace(/^#{1,6}\s*/gm, "")
    
    // Remove bullet points (* or -)
    .replace(/^\s*[\*\-]\s+/gm, "• ")
    
    // Remove extra line breaks
    .replace(/\n{3,}/g, "\n\n")
    
    .trim();
};

export const formatTermsForPDF = (text) => {
  if (!text) return "";

  return text
    .replace(/^#\s*(.*)/gm, "\n$1\n") // Main title
    .replace(/^##\s*(.*)/gm, "\n$1\n") // Section titles
    .replace(/^###\s*(.*)/gm, "\n$1\n") // Sub sections
    .replace(/^\s*[\*\-]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

