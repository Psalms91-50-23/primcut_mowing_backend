import crypto from "crypto";
import Quote from "../models/Quote.js";
import QuoteAccessToken from "../models/QuoteAccessToken.js";
import { sendQuoteToClient } from "../lib/email/index.js";
import { formatExpiry, generateShortId, formatFullName } from "../util/util.js";

const TOKEN_EXPIRY_DAYS = 3;

const hashToken = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");

const generateShortUuid = async () => {
  let uuid;
  let exists;

  do {
    uuid = generateShortId(9); // your existing short ID function
    exists = await QuoteAccessToken.findByUUID(uuid);
  } while (exists);

  return uuid;
};

// 1️⃣ Create token (Admin only)
export const create = async (req, res) => {

  const { quote_uuid } = req.body;

  if (!quote_uuid) {
    return res.status(400).json({ error: "quote_uuid is required" });
  }

  try {
    const quote = await Quote.findByUUID(quote_uuid);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    // revoke old tokens
    await QuoteAccessToken.revokeAllByQuoteUUID(quote_uuid);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const token_hash = hashToken(rawToken);

    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + TOKEN_EXPIRY_DAYS);

    const tokenUuid = await generateShortUuid();

    await QuoteAccessToken.create({
      quote_uuid,
      token_hash,
      expires_at: expires_at.toISOString(),
      uuid: tokenUuid,
    });

    // send email
    const quoteViewLink = `${process.env.CLIENT_URL}/quotes/view/${quote_uuid}?token=${rawToken}`;

    await sendQuoteToClient({
      to: quote.contact_email,
      subject: "Your Quote is Ready",
      data: {
        quoteUUID: quote_uuid,
        name: formatFullName(updated.contact_first_name, updated.contact_last_name),
        mobile: updated.contact_mobile,
        landline: updated.contact_landline,
        message: updated.message,
        email: updated.contact_email,
        total: quote.total_amount,
        subtotal: quote.subtotal_amount,
        gst: quote.gst_amount,
        services: quote.services,
        images: quote.images,
        quoteLink: quoteViewLink,
        expiry: formatExpiry(expires_at),
      },
    });

    return res.status(200).json({
      message: "Quote sent successfully",
      token: rawToken,
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 2️⃣ Revoke tokens (Admin only)
export const revokeAll = async (req, res) => {
  const { quote_uuid } = req.params;

  if (!quote_uuid) {
    return res.status(400).json({ error: "quote_uuid is required" });
  }

  try {
    await QuoteAccessToken.revokeAllByQuoteUUID(quote_uuid);
    return res.status(200).json({ message: "Tokens revoked" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 3️⃣ Validate token & return quote
export const viewPublicQuote = async (req, res) => {
  const { uuid } = req.params;
  const { token } = req.query;
  console.log({uuid}, " public view backend")
  console.log({token}, " public view backend token")
  if (!uuid || !token) {
      return res.status(400).json({ error: "Quote UUID and token are required" });
    }

  try {
    const token_hash = hashToken(token);

    const tokenRecord = await QuoteAccessToken.findByTokenHash(token_hash);

    if (!tokenRecord) {
      return res.status(401).json({ error: "Invalid token" });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(401).json({ error: "Token expired" });
    }

    // If valid, return the quote
    const quote = await Quote.findByUUID(tokenRecord.quote_uuid);
    console.log({quote}, " view public quote")

    if (!quote || quote.status === "draft") {
      return res.status(404).json({ error: "Quote not available" });
    }

    const accessTokenViewCounter = await QuoteAccessToken.incrementViewCount(tokenRecord.uuid)
    if(!accessTokenViewCounter){
      console.warn("Quote access updated failed for token:", tokenRecord.uuid);
      //  return res.status(404).json({ error: `Quote access failed to update with access token uuid: ${tokenRecord.uuid}`});
    }

    return res.status(200).json({ quote });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};


export const validateQuoteAccessToken = async (req, res) => {
  const { uuid } = req.params; // quote UUID
  const { token } = req.body;   // raw token from frontend

  console.log("validate quote token access as no cookies")

  if (!uuid || !token) {
    return res.status(400).json({ message: "Quote UUID and token are required" });
  }

  try {
    // Hash the incoming token for comparison
    const tokenHash = hashToken(token);

    // Find a valid token record
    const tokenRecord = await QuoteAccessToken.findOne(uuid, tokenHash);
    if (!tokenRecord) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Fetch the quote
    const quote = await Quote.findByUUID(uuid);
    if (!quote) {
      return res.status(404).json({ message: "Quote not found" });
    }

    // Check token expiry against quote expiry_end
    const now = new Date();
    const quoteExpiry = new Date(quote.expiry_end);
    if (quoteExpiry < now) {
      return res.status(401).json({ message: "Quote has expired" });
    }

    // Optional: revoke token if single-use
    // await tokenRecord.destroy();

    // Set a cookie that expires at the same time as the quote
    const maxAgeMs = quoteExpiry.getTime() - now.getTime(); // milliseconds until quote expiry
    res.cookie("quote_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: maxAgeMs > 0 ? maxAgeMs : 0, // prevent negative
    });

    const quoteAccessToken = await QuoteAccessToken.incrementViewCount(tokenRecord.uuid)
    if(!quoteAccessToken){
      console.warn("Quote access updated failed for token:", tokenRecord.uuid);
      //  return res.status(404).json({ error: `Quote access failed to update with access token uuid: ${tokenRecord.uuid}`});
    }

    // Return the quote
    return res.status(200).json({ quote, accessToken: quoteAccessToken });
  } catch (err) {
    console.error("Quote token validation error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const validateQuoteSession = async (req, res) => {

  try {
    // Get the session cookie from headers
    const sessionToken = req.cookies?.quote_session;

    if (!sessionToken) {
      return res.status(401).json({ message: "No active session" });
    }

    // Hash the session token to match stored token hash
    const tokenHash = hashToken(sessionToken);

    // Look up the session in quote_access_tokens
    const tokenRecord = await QuoteAccessToken.findByTokenHash(tokenHash);

    if (!tokenRecord) {
      return res.status(401).json({ message: "Invalid or expired session" });
    }

    // Fetch the quote
    const quote = await Quote.findByUUID(tokenRecord.quote_uuid);
    if (!quote || quote.status === "draft") {
      return res.status(404).json({ message: "Quote not available" });
    }

    // Check if quote has expired
    const now = new Date();
    const quoteExpiry = new Date(quote.expiry_end);
    if (quoteExpiry < now) {
      return res.status(401).json({ message: "Quote has expired" });
    }

    // Optional: increment view counter again for session views
    await QuoteAccessToken.incrementViewCount(tokenRecord.uuid);

    // Return the quote
    return res.status(200).json({ quote });
  } catch (err) {
    console.error("Session validation error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};