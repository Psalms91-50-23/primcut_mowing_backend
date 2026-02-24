// controllers/quotePdf.controller.js
import supabase from "../config/db.js"; // your server supabase client (service role recommended)
import Quote from "../models/Quote.js";
import QuoteAccessToken from "../models/QuoteAccessToken.js";
import { hashToken } from "../util/util.js";

/**
 * GET /api/quotes/:uuid/pdf?token=RAW_TOKEN
 * Streams the stored quote PDF from Supabase Storage AFTER validating the quote access token.
 *
 * Notes:
 * - Keep your "quotes-pdf" bucket PRIVATE.
 * - Store quote_pdf_url as a STORAGE PATH like: quotes/<uuid>/quote-v1.pdf
 */
export const viewQuotePdf = async (req, res) => {
  const { uuid } = req.params;
  const rawToken = String(req.query.token || "").trim();

  if (!uuid) return res.status(400).json({ message: "Quote uuid is required" });
  if (!rawToken) return res.status(401).json({ message: "Missing token" });

  try {
    // 1) Validate quote exists
    const quote = await Quote.findByUUID(uuid);
    if (!quote) return res.status(404).json({ message: "Quote not found" });

    // 2) Validate token (hash match + expiry)
    const token_hash = hashToken(rawToken);

    // Implement this however your model is structured:
    // Should return the token row if valid and not revoked/expired, else null
    const tokenRow = await QuoteAccessToken.findValidToken({
      quote_uuid: uuid,
      token_hash
    });

    if (!tokenRow) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Optional: also enforce quote expiry_end
    if (quote.expiry_end && new Date(quote.expiry_end) < new Date()) {
      return res.status(410).json({ message: "Quote has expired" });
    }

    // 3) Ensure we have a stored PDF path
    const pdfPath = quote.quote_pdf_url; // this should be a storage PATH
    if (!pdfPath) {
      return res.status(404).json({ message: "Quote PDF not available" }); 
    }

    // 4) Download from Supabase Storage (server-side)
    const { data, error } = await supabase.storage
      .from("quotes-pdf")
      .download(pdfPath);

    if (error) {
      console.error("Supabase download error:", error);
      return res.status(500).json({ message: "Failed to load PDF" });
    }

    // supabase-js returns a Blob in many environments; convert to Buffer for Node
    const arrayBuffer = await data.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // 5) Stream to client
    res.setHeader("Content-Type", "application/pdf");

    // inline = open in browser; attachment = force download
    const filename = `quote-${uuid}.pdf`;
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    // caching: usually avoid caching for private docs
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error("viewQuotePdf error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};