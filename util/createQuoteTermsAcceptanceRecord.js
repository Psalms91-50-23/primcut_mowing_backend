//util/quoteTermsAcceptanceService.js

import QuoteTermsAcceptance from "../models/QuoteTermsAcceptance.js";
import Quote from "../models/Quote.js";
import TermsAndConditions from "../models/TermsAndConditions.js";
import { generatePrefixedId } from "./util.js";

export async function createQuoteTermsAcceptanceRecord({
  quote,
  req,
  acceptedAt,
}) {
  if (!quote?.uuid) {
    throw new Error("Quote uuid is required");
  }

  if (!quote?.terms_uuid) {
    throw new Error("Quote terms uuid is required");
  }

  if (!quote?.terms_version) {
    throw new Error("Quote terms version is required");
  }

  const existingAcceptance =
    await QuoteTermsAcceptance.findByQuoteAndVersion(
      quote.uuid,
      quote.terms_version
    );

  if (existingAcceptance) {
    return existingAcceptance;
  }

  let acceptanceUUID;
  while (true) {
    acceptanceUUID = generatePrefixedId("QTA", 8);
    const exists = await QuoteTermsAcceptance.findByUUID(acceptanceUUID);
    if (!exists) break;
  }

  const forwarded = req.headers["x-forwarded-for"];
  const ipAddress = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === "string"
    ? forwarded.split(",")[0].trim()
    : req.ip || null;

  const userAgent = req.headers["user-agent"] || null;

  return await QuoteTermsAcceptance.create({
    uuid: acceptanceUUID,
    quote_uuid: quote.uuid,
    terms_uuid: quote.terms_uuid,
    version: quote.terms_version,
    accepted_at: acceptedAt || new Date().toISOString(),
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}