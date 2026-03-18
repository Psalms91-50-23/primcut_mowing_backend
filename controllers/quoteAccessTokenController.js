import crypto from "crypto";
import Quote from "../models/Quote.js";
import QuoteAccessToken from "../models/QuoteAccessToken.js";
import { createChangeLogSafe } from "../util/createChangeLogSafe.js";
import { sendQuoteToClient } from "../lib/email/index.js";
import { formatExpiry, formatFullName, generatePrefixedId } from "../util/util.js";
import supabase from "../config/db.js";

const TOKEN_EXPIRY_DAYS = 3;

const hashToken = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");

const generateShortUuid = async () => {
  let uuid;
  let exists;

  do {
    uuid = generatePrefixedId("QT", 7);
    exists = await QuoteAccessToken.findByUUID(uuid);
  } while (exists);

  return uuid;
};

export const viewQuotePdf = async (req, res) => {
  const { uuid } = req.params;
  const rawToken = String(req.query.token || "").trim();

  if (!uuid) return res.status(400).json({ message: "Quote uuid is required" });
  if (!rawToken) return res.status(401).json({ message: "Missing token" });

  try {
    const quote = await Quote.findByUUID(uuid);
    if (!quote) return res.status(404).json({ message: "Quote not found" });

    const token_hash = hashToken(rawToken);

    const tokenRow = await QuoteAccessToken.findValidToken({
      quote_uuid: uuid,
      token_hash,
    });

    if (!tokenRow) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (quote.expiry_end && new Date(quote.expiry_end) < new Date()) {
      return res.status(410).json({ message: "Quote has expired" });
    }

    const pdfPath = quote.quote_pdf_url;
    if (!pdfPath) {
      return res.status(404).json({ message: "Quote PDF not available" });
    }

    const { data, error } = await supabase.storage
      .from("quotes-pdf")
      .download(pdfPath);

    if (error) {
      console.error("Supabase download error:", error);
      return res.status(500).json({ message: "Failed to load PDF" });
    }

    const arrayBuffer = await data.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", "application/pdf");

    const filename = `quote-${uuid}.pdf`;
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error("viewQuotePdf error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// 1️⃣ Create token (Admin only)
export const create = async (req, res) => {
  const { quote_uuid } = req.body;
  const actorUserUuid = req.user?.uuid || null;

  if (!quote_uuid) {
    return res.status(400).json({ error: "quote_uuid is required" });
  }

  try {
    const quote = await Quote.findByUUID(quote_uuid);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    await QuoteAccessToken.revokeAllByQuoteUUID(quote_uuid);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const token_hash = hashToken(rawToken);

    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + TOKEN_EXPIRY_DAYS);

    const tokenUuid = await generateShortUuid();

    const createdToken = await QuoteAccessToken.create({
      quote_uuid,
      token_hash,
      expires_at: expires_at.toISOString(),
      uuid: tokenUuid,
    });

    const quoteViewLink = `${process.env.CLIENT_URL}/quotes/view/${quote_uuid}?token=${rawToken}`;

    await sendQuoteToClient({
      to: quote.contact_email,
      subject: "Your Quote is Ready",
      data: {
        quoteUUID: quote_uuid,
        name: formatFullName(quote.contact_first_name, quote.contact_last_name),
        mobile: quote.contact_mobile,
        landline: quote.contact_landline,
        message: quote.message,
        email: quote.contact_email,
        total: quote.total_amount,
        subtotal: quote.subtotal_amount,
        gst: quote.gst_amount,
        services: quote.services,
        images: quote.images,
        quoteLink: quoteViewLink,
        expiry: formatExpiry(expires_at),
      },
    });

    await createChangeLogSafe({
      table_name: "quote_access_tokens",
      record_uuid: createdToken?.uuid || tokenUuid,
      user_uuid: actorUserUuid,
      action: "create",
      summary: "Quote access token created and quote email sent to client.",
      changed_fields: {
        uuid: {
          old: null,
          new: createdToken?.uuid || tokenUuid,
        },
        quote_uuid: {
          old: null,
          new: quote_uuid,
        },
        expires_at: {
          old: null,
          new: expires_at.toISOString(),
        },
      },
      source: "dashboard",
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
  const actorUserUuid = req.user?.uuid || null;

  if (!quote_uuid) {
    return res.status(400).json({ error: "quote_uuid is required" });
  }

  try {
    await QuoteAccessToken.revokeAllByQuoteUUID(quote_uuid);

    await createChangeLogSafe({
      table_name: "quotes",
      record_uuid: quote_uuid,
      user_uuid: actorUserUuid,
      action: "update",
      summary: "All quote access tokens revoked.",
      changed_fields: {
        access_tokens_revoked: true,
      },
      source: "dashboard",
    });

    return res.status(200).json({ message: "Tokens revoked" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 3️⃣ Validate token & return quote
export const viewPublicQuote = async (req, res) => {
  const { uuid } = req.params;
  const { token } = req.query;

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

    const quote = await Quote.findByUUID(tokenRecord.quote_uuid);
    console.log({ quote }, " view public quote");

    if (!quote || quote.status === "draft") {
      return res.status(404).json({ error: "Quote not available" });
    }

    const accessTokenViewCounter = await QuoteAccessToken.incrementViewCount(tokenRecord.uuid);
    if (!accessTokenViewCounter) {
      console.warn("Quote access updated failed for token:", tokenRecord.uuid);
    }

    return res.status(200).json({ quote });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const validateQuoteAccessToken = async (req, res) => {
  const { uuid } = req.params;
  const { token } = req.body;

  console.log("validate quote token access as no cookies");

  if (!uuid || !token) {
    return res.status(400).json({ message: "Quote UUID and token are required" });
  }

  try {
    const tokenHash = hashToken(token);
    const now = new Date();
    const tokenRecord = await QuoteAccessToken.findOne(uuid, tokenHash);
    if (!tokenRecord) {

      res.clearCookie("quote_session", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      return res.status(401).json({ message: "Invalid or expired quote link" });

    }

    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < now) {
      res.clearCookie("quote_session", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      return res.status(401).json({ message: "Invalid or expired quote link" });
    }

    const quote = await Quote.findByUUID(uuid);
    if (!quote) {
       res.clearCookie("quote_session", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
        return res.status(401).json({ message: "Invalid or expired quote link" });
    }

    const quoteExpiry = new Date(quote.expiry_end);
    
     if (Number.isNaN(quoteExpiry.getTime()) || quoteExpiry < now) {
      res.clearCookie("quote_session", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      return res.status(401).json({ message: "Invalid or expired quote link" });
    }

    const maxAgeMs = quoteExpiry.getTime() - now.getTime();

    res.cookie("quote_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: maxAgeMs > 0 ? maxAgeMs : 0,
    });

    const quoteAccessToken = await QuoteAccessToken.incrementViewCount(tokenRecord.uuid);
    if (!quoteAccessToken) {
      console.warn("Quote access updated failed for token:", tokenRecord.uuid);
    }

    return res.status(200).json({ quote });
    // return res.status(200).json({ quote, accessToken: quoteAccessToken });
  } catch (err) {
    console.error("Quote token validation error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// export const validateQuoteSession = async (req, res) => {
//   try {
//     const sessionToken = req.cookies?.quote_session;

//     if (!sessionToken) {
//       return res.status(401).json({ message: "No active session" });
//     }

//     const tokenHash = hashToken(sessionToken);

//     const tokenRecord = await QuoteAccessToken.findByTokenHash(tokenHash);

//     if (!tokenRecord) {
//       return res.status(401).json({ message: "Invalid or expired session" });
//     }

//     const quote = await Quote.findByUUID(tokenRecord.quote_uuid);
//     if (!quote || quote.status === "draft") {
//       return res.status(404).json({ message: "Quote not available" });
//     }

//     const now = new Date();
//     const quoteExpiry = new Date(quote.expiry_end);
//     if (quoteExpiry < now) {
//       return res.status(401).json({ message: "Quote has expired" });
//     }

//     await QuoteAccessToken.incrementViewCount(tokenRecord.uuid);

//     return res.status(200).json({ quote });
//   } catch (err) {
//     console.error("Session validation error:", err);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// };

export const validateQuoteSession = async (req, res) => {
  try {
    const { uuid } = req.params;
    const sessionToken = req.cookies?.quote_session;

    if (!uuid) {
      return res.status(400).json({ message: "Quote UUID is required" });
    }

    if (!sessionToken) {
      return res.status(401).json({ message: "No active session" });
    }

    const tokenHash = hashToken(sessionToken);
    const tokenRecord = await QuoteAccessToken.findByTokenHash(tokenHash);

    if (!tokenRecord) {
      res.clearCookie("quote_session", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });

      return res.status(401).json({ message: "Invalid or expired session" });
    }

    if (tokenRecord.quote_uuid !== uuid) {
      res.clearCookie("quote_session", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });

      return res.status(403).json({ message: "Session does not match requested quote" });
    }

    const quote = await Quote.findByUUID(uuid);
    if (!quote || quote.status === "draft") {
      return res.status(404).json({ message: "Quote not available" });
    }

    const now = new Date();
    const quoteExpiry = new Date(quote.expiry_end);
    if (quoteExpiry < now) {
      return res.status(401).json({ message: "Quote has expired" });
    }

    await QuoteAccessToken.incrementViewCount(tokenRecord.uuid);

    return res.status(200).json({ quote });
  } catch (err) {
    console.error("Session validation error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
