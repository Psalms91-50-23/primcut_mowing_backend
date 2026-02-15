
import crypto from 'crypto';
const CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz";
const DEFAULT_LENGTH = 9;
import jwt from 'jsonwebtoken';
import QuoteAccessToken from '../models/QuoteAccessToken.js';
import { RecaptchaEnterpriseServiceClient } from "@google-cloud/recaptcha-enterprise";
import { sendQuoteToClient } from "../lib/email/index.js"
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

export async function createQuoteAccessToken(quote) {
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

