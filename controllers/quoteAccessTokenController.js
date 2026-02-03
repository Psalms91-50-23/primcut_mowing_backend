import crypto from "crypto";
import Quote from "../models/Quote.js";
import QuoteAccessToken from "../models/QuoteAccessToken.js";
import { sendQuoteToClient } from "../lib/email/index.js";
import { formatExpiry, generateShortId, formatFullName } from "../util/util.js";

const TOKEN_EXPIRY_DAYS = 7;

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
        name: formatFullName(updated.contact_first_name, updated.contact_last_name),
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
export const viewQuoteByToken = async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
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

    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    return res.status(200).json({ quote });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};



