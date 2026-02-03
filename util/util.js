
import crypto from 'crypto';
const CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz";
const DEFAULT_LENGTH = 9;
import jwt from 'jsonwebtoken';
import QuoteAccessToken from '../models/QuoteAccessToken.js';
import { RecaptchaEnterpriseServiceClient } from "@google-cloud/recaptcha-enterprise";
const EMAIL_SECRET = process.env.EMAIL_SECRET || 'supersecret123';
const EMAIL_TOKEN_EXPIRATION = '5m'; // 5 minutes for testing
const PASSWORD_RESET_TOKEN = process.env.RESET_PASSWORD_TOKEN_SECRET || 'SuperSecretPasswordResetKey_!!!';

export function normalizeNZPhone(phone) {
    phone = phone.replace(/\D/g, "");

    if (phone.startsWith("64")) phone = `+${phone}`;
    else if (phone.startsWith("0")) phone = `+64${phone.substring(1)}`;
    else phone = `+64${phone}`;

    // Optional: basic NZ number validation (mobile or landline)
    if (!/^(\+64)(2\d{1,2}|[3-9]\d)\d{6,7}$/.test(phone)) {
        throw new Error("Invalid NZ phone number");
    }

    return phone;
}

export function generateShortId(size = DEFAULT_LENGTH) {
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


// export const verifyRecaptcha = async (token, version = "v3") => {
//   const secret =
//     version === "v2"
//       ? process.env.RECAPTCHA_V2_SECRET_KEY
//       : process.env.RECAPTCHA_V3_SECRET_KEY;

//   const res = await fetch(
//     "https://www.google.com/recaptcha/api/siteverify",
//     {
//       method: "POST",
//       headers: { "Content-Type": "application/x-www-form-urlencoded" },
//       body: new URLSearchParams({
//         secret,
//         response: token,
//       }),
//     }
//   );

//   const data = await res.json();

//   if (!data.success) return false;
//   console.log({data}, "inside verifyRecaptcha util")
//   // Only v3 has score
//   if (version === "v3" && data.score < 0.5) return false;

//   return true;
// };

// export const verifyRecaptcha = async (token) => {
//   const [assessment] = await client.createAssessment({
//     parent: `projects/${process.env.GOOGLE_CLOUD_PROJECT}`,
//     assessment: {
//       event: {
//         token,
//         siteKey: process.env.RECAPTCHA_V3_SECRET_KEY,
//       },
//     },
//   });

//   // Enterprise gives a score from 0-1, treat >=0.5 as human
//   return assessment?.riskAnalysis?.score >= 0.5;
// };
