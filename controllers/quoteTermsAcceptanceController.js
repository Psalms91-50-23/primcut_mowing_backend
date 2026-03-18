import QuoteTermsAcceptance from "../models/QuoteTermsAcceptance.js";
import Quote from "../models/Quote.js";
import TermsAndConditions from "../models/TermsAndConditions.js";

function getRequestIP(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    null
  );
}

export const createQuoteTermsAcceptance = async (req, res) => {
  try {
    const { quote_uuid, terms_uuid, version, accepted_at } = req.body;

    if (!quote_uuid) {
      return res.status(400).json({ message: "quote_uuid is required" });
    }

    if (!terms_uuid) {
      return res.status(400).json({ message: "terms_uuid is required" });
    }

    if (!version) {
      return res.status(400).json({ message: "version is required" });
    }

    const quote = await Quote.findByUUID(quote_uuid);
    if (!quote) {
      return res.status(404).json({
        message: `Quote not found with uuid: ${quote_uuid}`,
      });
    }

    const terms = await TermsAndConditions.findByUUID(terms_uuid);
    if (!terms) {
      return res.status(404).json({
        message: `Terms and conditions not found with uuid: ${terms_uuid}`,
      });
    }

    if (terms.version !== version) {
      return res.status(400).json({
        message: "Provided version does not match the terms record version",
      });
    }

    const alreadyAccepted =
      await QuoteTermsAcceptance.existsForQuoteAndVersion(quote_uuid, version);

    if (alreadyAccepted) {
      return res.status(409).json({
        message: "Terms already accepted for this quote and version",
      });
    }

    const acceptance = await QuoteTermsAcceptance.create({
      quote_uuid,
      terms_uuid,
      version,
      accepted_at: accepted_at || new Date().toISOString(),
      ip_address: getRequestIP(req),
      user_agent: req.headers["user-agent"] || null,
    });

    return res.status(201).json({
      message: "Quote terms acceptance created successfully",
      acceptance,
    });
  } catch (error) {
    console.error("createQuoteTermsAcceptance error:", error);
    return res.status(500).json({
      message: error.message || "Failed to create quote terms acceptance",
    });
  }
};

export const getQuoteTermsAcceptanceByUUID = async (req, res) => {
  try {
    const { uuid } = req.params;

    if (!uuid) {
      return res.status(400).json({ message: "Acceptance uuid is required" });
    }

    const acceptance = await QuoteTermsAcceptance.findByUUID(uuid);

    if (!acceptance) {
      return res.status(404).json({
        message: `Quote terms acceptance not found with uuid: ${uuid}`,
      });
    }

    return res.status(200).json(acceptance);
  } catch (error) {
    console.error("getQuoteTermsAcceptanceByUUID error:", error);
    return res.status(500).json({
      message:
        error.message || "Failed to fetch quote terms acceptance by uuid",
    });
  }
};

export const getQuoteTermsAcceptancesByQuoteUUID = async (req, res) => {
  try {
    const { quote_uuid } = req.params;

    if (!quote_uuid) {
      return res.status(400).json({ message: "Quote uuid is required" });
    }

    const quote = await Quote.findByUUID(quote_uuid);
    if (!quote) {
      return res.status(404).json({
        message: `Quote not found with uuid: ${quote_uuid}`,
      });
    }

    const acceptances = await QuoteTermsAcceptance.findByQuoteUUID(quote_uuid);

    return res.status(200).json({
      quote_uuid,
      count: acceptances.length,
      acceptances,
    });
  } catch (error) {
    console.error("getQuoteTermsAcceptancesByQuoteUUID error:", error);
    return res.status(500).json({
      message:
        error.message ||
        "Failed to fetch quote terms acceptances by quote uuid",
    });
  }
};

export const getLatestQuoteTermsAcceptanceByQuoteUUID = async (req, res) => {
  try {
    const { quote_uuid } = req.params;

    if (!quote_uuid) {
      return res.status(400).json({ message: "Quote uuid is required" });
    }

    const quote = await Quote.findByUUID(quote_uuid);
    if (!quote) {
      return res.status(404).json({
        message: `Quote not found with uuid: ${quote_uuid}`,
      });
    }

    const acceptance =
      await QuoteTermsAcceptance.findLatestByQuoteUUID(quote_uuid);

    if (!acceptance) {
      return res.status(404).json({
        message: `No terms acceptance found for quote uuid: ${quote_uuid}`,
      });
    }

    return res.status(200).json(acceptance);
  } catch (error) {
    console.error("getLatestQuoteTermsAcceptanceByQuoteUUID error:", error);
    return res.status(500).json({
      message:
        error.message ||
        "Failed to fetch latest quote terms acceptance by quote uuid",
    });
  }
};