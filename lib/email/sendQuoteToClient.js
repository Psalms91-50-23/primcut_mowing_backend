
// import { Resend } from "resend";

// const resend = new Resend(process.env.RESEND_API_KEY);

// const formatMoney = (value) => Number(value || 0).toFixed(2);

// const escapeHtml = (value = "") =>
//   String(value)
//     .replace(/&/g, "&amp;")
//     .replace(/</g, "&lt;")
//     .replace(/>/g, "&gt;")
//     .replace(/"/g, "&quot;")
//     .replace(/'/g, "&#39;");

// const escapeAttribute = (value = "") =>
//   String(value)
//     .replace(/&/g, "&amp;")
//     .replace(/"/g, "&quot;")
//     .replace(/</g, "&lt;")
//     .replace(/>/g, "&gt;");

// export default async function sendQuoteToClient({
//   to,
//   subject,
//   data,
//   pdfBuffer,
//   termsPdfBuffer = null,
//   termsFileName = "terms-and-conditions.pdf",
// }) {
//   if (!to) throw new Error("Recipient email is required");
//   if (!data) throw new Error("Email data is required");

//   const {
//     quoteUUID,
//     name,
//     mobile,
//     landline,
//     message,
//     email,
//     subtotal,
//     gst,
//     total,
//     services = [],
//     images = [],
//     quoteLink,
//     expiry,
//     employer_message,
//     termsUrl = "",
//     termsVersion = "",
//     termsTitle = "Terms & Conditions",
//     has_urgent_fee = false,
//     urgent_fee_amount = 0,
//   } = data;

//   const safeSubtotal = Number(subtotal || 0);
//   const safeGST = Number(gst || 0);
//   const safeTotal = Number(total || 0);
//   const safeUrgentFee =
//     has_urgent_fee && Number.isFinite(Number(urgent_fee_amount))
//       ? Number(urgent_fee_amount || 0)
//       : 0;

//   const servicesOnlySubtotal = Number(
//     services.reduce((sum, s) => {
//       const unitPrice = Number(s.unit_price || 0);
//       const qty = Number(s.quantity || 1);
//       return sum + unitPrice * qty;
//     }, 0)
//   );

//   const safeBaseUrl = (process.env.FRONTEND_URL_HAPPY_LAWNS || "").replace(/\/+$/, "");
//   const logoUrl = `${safeBaseUrl}/images/happy-house-1.png`;

//   const servicesHtml = (services || [])
//     .map((s, i) => {
//       const unitPrice = Number(s.unit_price || 0);
//       const qty = Number(s.quantity || 1);
//       const lineTotal = unitPrice * qty;

//       return `
//         <tr style="background:${i % 2 === 0 ? "#f0fdf4" : "#dcfce7"};">
//           <td style="padding:12px;border:1px solid #d1d5db;text-align:left;">
//             ${escapeHtml(s.label || "Service")}
//           </td>
//           <td style="padding:12px;border:1px solid #d1d5db;text-align:center;">
//             $${formatMoney(unitPrice)}
//           </td>
//           <td style="padding:12px;border:1px solid #d1d5db;text-align:center;">
//             ${qty}
//           </td>
//           <td style="padding:12px;border:1px solid #d1d5db;text-align:right;">
//             $${formatMoney(lineTotal)}
//           </td>
//         </tr>
//       `;
//     })
//     .join("");

//   const imagesHtml = (images || [])
//     .map((img) => {
//       const rawUrl = img?.url || img || "";
//       const href = escapeAttribute(rawUrl);
//       const src = escapeAttribute(rawUrl);

//       return `
//         <td style="padding:0 10px 10px 0;" align="left">
//           <a href="${href}" target="_blank" style="text-decoration:none;">
//             <img
//               src="${src}"
//               width="60"
//               height="60"
//               style="display:block; width:60px; height:60px; border-radius:8px; border:1px solid #ddd;"
//               alt="Quote Image"
//             />
//           </a>
//         </td>
//       `;
//     })
//     .join("");

//   const detailsRows = [
//     ["Quote ID", quoteUUID],
//     ["Customer", name],
//     ...(mobile ? [["Mobile", mobile]] : []),
//     ...(landline ? [["Landline", landline]] : []),
//     ["Email", email],
//     ...(message ? [["Message", message]] : []),
//   ]
//     .map(
//       ([label, value]) => `
//       <tr>
//         <td style="padding:8px 10px;font-weight:bold;width:35%;background:#f9fafb;border:1px solid #eee;vertical-align:top;">
//           ${escapeHtml(label)}
//         </td>
//         <td style="padding:8px 10px;border:1px solid #eee;">
//           ${escapeHtml(value ?? "-")}
//         </td>
//       </tr>
//     `
//     )
//     .join("");

//   const urgentFeeRowHtml =
//     has_urgent_fee && safeUrgentFee > 0
//       ? `
//         <tr style="background:#fef2f2;">
//           <td style="padding:12px;border:1px solid #d1d5db;text-align:left;font-weight:bold;color:#991b1b;">
//             Urgent Fee
//           </td>
//           <td style="padding:12px;border:1px solid #d1d5db;text-align:center;">-</td>
//           <td style="padding:12px;border:1px solid #d1d5db;text-align:center;">-</td>
//           <td style="padding:12px;border:1px solid #d1d5db;text-align:right;font-weight:bold;color:#991b1b;">
//             $${formatMoney(safeUrgentFee)}
//           </td>
//         </tr>
//       `
//       : "";

//   const termsSectionHtml =
//     termsPdfBuffer || termsUrl
//       ? `
//         <div style="margin-top:24px;padding:16px;border:1px solid #d1fae5;background:#f0fdf4;border-radius:8px;">
//           <h3 style="margin:0 0 10px 0;color:#065f46;">Terms &amp; Conditions</h3>
//           <p style="margin:0 0 10px 0;">
//             Please review our ${escapeHtml(termsTitle)}${
//               termsVersion ? ` (Version ${escapeHtml(termsVersion)})` : ""
//             }.
//           </p>
//           ${
//             termsUrl
//               ? `
//                 <p style="margin:0 0 10px 0;">
//                   <a
//                     href="${escapeAttribute(termsUrl)}"
//                     target="_blank"
//                     style="color:#065f46;font-weight:bold;text-decoration:underline;"
//                   >
//                     View Terms &amp; Conditions
//                   </a>
//                 </p>
//               `
//               : ""
//           }
//           <p style="margin:0;font-size:13px;color:#374151;">
//             A PDF copy of the Terms &amp; Conditions is also attached to this email.
//           </p>
//         </div>
//       `
//       : "";

//   const safeName = escapeHtml(name || "there");
//   const safeExpiry = escapeHtml(expiry || "");
//   const safeEmployerMessage = escapeHtml(employer_message || "");
//   const safeQuoteLink = escapeAttribute(quoteLink || "");
//   const safeQuoteLinkText = escapeHtml(quoteLink || "");
//   const safeLogoUrl = escapeAttribute(logoUrl);

//   const html = `
//     <!DOCTYPE html>
//     <html lang="en">
//       <head>
//         <meta charset="UTF-8" />
//         <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//         <title>Your Quote is Ready</title>
//       </head>
//       <body style="margin:0; padding:20px; background:#f5f5f5; font-family:Arial, sans-serif; color:#1f2937;">
//         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;">
//           <tr>
//             <td align="center">
//               <table
//                 role="presentation"
//                 width="720"
//                 cellpadding="0"
//                 cellspacing="0"
//                 border="0"
//                 style="width:100%; max-width:720px; background:#ffffff; border:1px solid #e5e7eb; border-radius:10px;"
//               >
//                 <tr>
//                   <td style="background:#14532D; padding:20px; border-radius:10px 10px 0 0;">
//                     <table role="presentation" cellpadding="0" cellspacing="0" border="0">
//                       <tr>
//                         <td style="vertical-align:middle; color:#ffffff; font-size:27px; font-weight:bold; line-height:1; white-space:nowrap;">
//                           H
//                         </td>

//                         <td style="vertical-align:middle; padding:0 2px;">
//                           <img
//                             src="${safeLogoUrl}"
//                             alt="Happy Property Logo"
//                             width="44"
//                             height="44"
//                             style="display:block; width:44px; height:44px; border:0; outline:none; text-decoration:none;"
//                           />
//                         </td>

//                         <td style="vertical-align:middle; color:#ffffff; font-size:27px; font-weight:bold; line-height:1; white-space:nowrap;">
//                           ppy Property
//                         </td>
//                       </tr>
//                     </table>
//                   </td>
//                 </tr>

//                 <tr>
//                   <td style="padding:24px;">
//                     <h2 style="margin:0 0 16px 0; color:#065f46;">Your Quote is Ready</h2>

//                     <p style="margin-top:0;">Hi ${safeName},</p>
//                     <p style="line-height:1.6;color:#374151;">
//                       Your quote is ready and valid until <strong>${safeExpiry}</strong>.
//                     </p>

//                     ${
//                       employer_message
//                         ? `
//                         <div style="margin:20px 0;padding:16px;border-left:4px solid #15803D;background:#f0fdf4;border-radius:8px;">
//                           <p style="margin:0 0 8px 0;font-weight:700;color:#14532d;">Message from our team</p>
//                           <div style="margin:0; white-space:pre-wrap; color:#374151; line-height:1.6;">${safeEmployerMessage}</div>
//                         </div>
//                         `
//                         : ""
//                     }

//                     <table style="width:100%;border-collapse:collapse;margin-top:16px;">
//                       <tbody>
//                         ${detailsRows}
//                       </tbody>
//                     </table>

//                     <h3 style="margin:24px 0 10px 0;color:#14532d;">Services</h3>

//                     <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
//                       <thead>
//                         <tr style="background:#15803D;color:#fff;">
//                           <th style="padding:10px;border:1px solid #15803D;text-align:left;">Service</th>
//                           <th style="padding:10px;border:1px solid #15803D;text-align:center;">Unit</th>
//                           <th style="padding:10px;border:1px solid #15803D;text-align:center;">Qty</th>
//                           <th style="padding:10px;border:1px solid #15803D;text-align:right;">Total</th>
//                         </tr>
//                       </thead>
//                       <tbody>
//                         ${
//                           servicesHtml ||
//                           `<tr><td colspan="4" style="padding:12px;border:1px solid #d1d5db;text-align:center;">No services provided</td></tr>`
//                         }
//                         ${urgentFeeRowHtml}
//                       </tbody>
//                     </table>

//                     ${
//                       imagesHtml
//                         ? `
//                         <h3 style="margin:24px 0 10px 0;color:#14532d;">Images</h3>
//                         <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
//                           <tr>
//                             ${imagesHtml}
//                           </tr>
//                         </table>
//                         `
//                         : ""
//                     }

//                     <div style="margin-top:24px;">
//                       <p style="margin:0 0 8px 0;"><strong>Services Subtotal:</strong> $${formatMoney(
//                         servicesOnlySubtotal
//                       )}</p>
//                       ${
//                         has_urgent_fee
//                           ? `<p style="margin:0 0 8px 0;"><strong>Urgent Fee:</strong> $${formatMoney(
//                               safeUrgentFee
//                             )}</p>`
//                           : ""
//                       }
//                       <p style="margin:0 0 8px 0;"><strong>Subtotal:</strong> $${formatMoney(
//                         safeSubtotal
//                       )}</p>
//                       <p style="margin:0 0 8px 0;"><strong>GST:</strong> $${formatMoney(
//                         safeGST
//                       )}</p>
//                       <p style="margin:0;"><strong>Total:</strong> $${formatMoney(safeTotal)}</p>
//                     </div>

//                     ${termsSectionHtml}

//                     <div style="margin-top:24px;">
//                       <a
//                         href="${safeQuoteLink || "#"}"
//                         style="display:inline-block;background:#10b981;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;"
//                       >
//                         View &amp; Respond
//                       </a>
//                     </div>

//                     <p style="font-size:12px;margin-top:16px;word-break:break-all;color:#4b5563;">
//                       ${safeQuoteLinkText}
//                     </p>
//                   </td>
//                 </tr>
//               </table>
//             </td>
//           </tr>
//         </table>
//       </body>
//     </html>
//   `;

//   const text = `Hi ${name || "there"},

// Your quote is ready and valid until ${expiry}.

// Quote ID: ${quoteUUID}

// Services Subtotal: $${formatMoney(servicesOnlySubtotal)}
// ${has_urgent_fee ? `Urgent Fee: $${formatMoney(safeUrgentFee)}\n` : ""}Subtotal: $${formatMoney(
//     safeSubtotal
//   )}
// GST: $${formatMoney(safeGST)}
// Total: $${formatMoney(safeTotal)}

// ${termsVersion ? `Terms version: ${termsVersion}\n` : ""}${
//     termsUrl ? `Terms & Conditions: ${termsUrl}\n` : ""
//   }
// View & Respond: ${quoteLink}
// `;

//   const attachments = [];

//   if (pdfBuffer) {
//     attachments.push({
//       filename: `quote-${quoteUUID}.pdf`,
//       content: pdfBuffer,
//     });
//   }

//   if (termsPdfBuffer) {
//     attachments.push({
//       filename: termsFileName,
//       content: termsPdfBuffer,
//     });
//   }

//   const { data: resendData, error } = await resend.emails.send({
//     from: process.env.QUOTES_EMAIL,
//     to,
//     reply_to: process.env.REPLY_TO_QUOTES,
//     subject,
//     html,
//     text,
//     attachments,
//   });

//   if (error) {
//     console.error("Resend error:", error);
//     throw error;
//   }

//   return resendData;
// }

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const formatMoney = (value) =>
  Number(value || 0).toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeAttribute = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const formatRecurrenceLabel = (value = "one_off") => {
  switch (value) {
    case "weekly":
      return "Weekly";
    case "fortnightly":
      return "Fortnightly";
    case "monthly":
      return "Monthly";
    case "one_off":
    default:
      return "One-off";
  }
};

export default async function sendQuoteToClient({
  to,
  subject,
  data,
  pdfBuffer,
  termsPdfBuffer = null,
  termsFileName = "terms-and-conditions.pdf",
}) {
  if (!to) throw new Error("Recipient email is required");
  if (!data) throw new Error("Email data is required");

  const {
    quoteUUID,
    name,
    mobile,
    landline,
    message,
    email,
    subtotal,
    gst,
    total,
    services = [],
    images = [],
    quoteLink,
    expiry,
    employer_message,
    recurrence_frequency = "one_off",
    termsUrl = "",
    termsVersion = "",
    termsTitle = "Terms & Conditions",
    termsSummary = "",
    has_urgent_fee = false,
    urgent_fee_amount = 0,
  } = data;

  const safeSubtotal = Number(subtotal || 0);
  const safeGST = Number(gst || 0);
  const safeTotal = Number(total || 0);
  const safeUrgentFee =
    has_urgent_fee && Number.isFinite(Number(urgent_fee_amount))
      ? Number(urgent_fee_amount || 0)
      : 0;

  const servicesOnlySubtotal = Number(
    services.reduce((sum, s) => {
      const unitPrice = Number(s.unit_price || 0);
      const qty = Number(s.quantity || 1);
      return sum + unitPrice * qty;
    }, 0)
  );

  const safeBaseUrl = (process.env.FRONTEND_URL_HAPPY_PROPERTY || "").replace(/\/+$/, "");
  const logoUrl = `${safeBaseUrl}/images/happy-house-1.png`;

  const servicesHtml = (services || [])
    .map((s, i) => {
      const unitPrice = Number(s.unit_price || 0);
      const qty = Number(s.quantity || 1);
      const lineTotal = unitPrice * qty;

      return `
        <tr style="background:${i % 2 === 0 ? "#f0fdf4" : "#dcfce7"};">
          <td style="padding:12px;border:1px solid #d1d5db;text-align:left;">
            ${escapeHtml(s.label || "Service")}
          </td>
          <td style="padding:12px;border:1px solid #d1d5db;text-align:center;">
            $${formatMoney(unitPrice)}
          </td>
          <td style="padding:12px;border:1px solid #d1d5db;text-align:center;">
            ${qty}
          </td>
          <td style="padding:12px;border:1px solid #d1d5db;text-align:right;">
            $${formatMoney(lineTotal)}
          </td>
        </tr>
      `;
    })
    .join("");

  const imagesHtml = (images || [])
    .map((img) => {
      const rawUrl = img?.url || img || "";
      const href = escapeAttribute(rawUrl);
      const src = escapeAttribute(rawUrl);

      return `
        <td style="padding:0 10px 10px 0;" align="left">
          <a href="${href}" target="_blank" style="text-decoration:none;">
            <img
              src="${src}"
              width="60"
              height="60"
              style="display:block; width:60px; height:60px; border-radius:8px; border:1px solid #ddd;"
              alt="Quote Image"
            />
          </a>
        </td>
      `;
    })
    .join("");

  const detailsRows = [
    ["Quote ID", quoteUUID],
    ["Customer", name],
    ["Service Frequency", formatRecurrenceLabel(recurrence_frequency)],
    ...(mobile ? [["Mobile", mobile]] : []),
    ...(landline ? [["Landline", landline]] : []),
    ["Email", email],
    ...(message ? [["Message", message]] : []),
  ]
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:8px 10px;font-weight:bold;width:35%;background:#f9fafb;border:1px solid #eee;vertical-align:top;">
          ${escapeHtml(label)}
        </td>
        <td style="padding:8px 10px;border:1px solid #eee;">
          ${escapeHtml(value ?? "-")}
        </td>
      </tr>
    `
    )
    .join("");

  const urgentFeeRowHtml =
    has_urgent_fee && safeUrgentFee > 0
      ? `
        <tr style="background:#fef2f2;">
          <td style="padding:12px;border:1px solid #d1d5db;text-align:left;font-weight:bold;color:#991b1b;">
            Urgent Fee
          </td>
          <td style="padding:12px;border:1px solid #d1d5db;text-align:center;">-</td>
          <td style="padding:12px;border:1px solid #d1d5db;text-align:center;">-</td>
          <td style="padding:12px;border:1px solid #d1d5db;text-align:right;font-weight:bold;color:#991b1b;">
            $${formatMoney(safeUrgentFee)}
          </td>
        </tr>
      `
      : "";

  const termsSectionHtml =
  termsPdfBuffer || termsUrl || termsSummary
    ? `
      <div style="margin-top:24px;padding:16px;border:1px solid #d1fae5;background:#f0fdf4;border-radius:8px;">
        <h3 style="margin:0 0 10px 0;color:#065f46;">Terms &amp; Conditions</h3>
        <p style="margin:0 0 10px 0;">
          Please review our ${escapeHtml(termsTitle)}${
            termsVersion ? ` (Version ${escapeHtml(termsVersion)})` : ""
          }.
        </p>
        ${
          termsSummary
            ? `
              <p style="margin:0 0 10px 0;color:#374151;line-height:1.6;">
                A summary of the main terms is provided below. Please read the attached PDF for the full Terms &amp; Conditions.
              </p>
              <div style="margin:0 0 12px 0; padding:12px; background:#ffffff; border:1px solid #d1d5db; border-radius:8px; color:#374151; line-height:1.6; white-space:pre-wrap;">
                ${escapeHtml(termsSummary)}
              </div>
            `
            : ""
        }
        ${
          termsUrl
            ? `
              <p style="margin:0 0 10px 0;">
                <a
                  href="${escapeAttribute(termsUrl)}"
                  target="_blank"
                  style="color:#065f46;font-weight:bold;text-decoration:underline;"
                >
                  View Terms &amp; Conditions
                </a>
              </p>
            `
            : ""
        }
        <p style="margin:0;font-size:13px;color:#374151;">
          A PDF copy of the Terms &amp; Conditions is also attached to this email.
        </p>
      </div>
    `
    : "";

  const safeName = escapeHtml(name || "there");
  const safeExpiry = escapeHtml(expiry || "");
  const safeEmployerMessage = escapeHtml(employer_message || "");
  const safeQuoteLink = escapeAttribute(quoteLink || "");
  const safeQuoteLinkText = escapeHtml(quoteLink || "");
  const safeLogoUrl = escapeAttribute(logoUrl);

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Your Quote is Ready</title>
      </head>
      <body style="margin:0; padding:20px; background:#f5f5f5; font-family:Arial, sans-serif; color:#1f2937;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;">
          <tr>
            <td align="center">
              <table
                role="presentation"
                width="720"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="width:100%; max-width:720px; background:#ffffff; border:1px solid #e5e7eb; border-radius:10px;"
              >
                <tr>
                  <td style="background:#14532D; padding:20px; border-radius:10px 10px 0 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="vertical-align:middle; color:#ffffff; font-size:27px; font-weight:bold; line-height:1; white-space:nowrap;">
                          H
                        </td>

                        <td style="vertical-align:middle; padding:0 2px;">
                          <img
                            src="${safeLogoUrl}"
                            alt="Happy Property Logo"
                            width="44"
                            height="44"
                            style="display:block; width:44px; height:44px; border:0; outline:none; text-decoration:none;"
                          />
                        </td>

                        <td style="vertical-align:middle; color:#ffffff; font-size:27px; font-weight:bold; line-height:1; white-space:nowrap;">
                          ppy Property
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:24px;">
                    <h2 style="margin:0 0 16px 0; color:#065f46;">Your Quote is Ready</h2>

                    <p style="margin-top:0;">Hi ${safeName},</p>
                    <p style="line-height:1.6;color:#374151;">
                      Your quote is ready and valid until <strong>${safeExpiry}</strong>.
                    </p>

                    ${
                      employer_message
                        ? `
                        <div style="margin:20px 0;padding:16px;border-left:4px solid #15803D;background:#f0fdf4;border-radius:8px;">
                          <p style="margin:0 0 8px 0;font-weight:700;color:#14532d;">Message from our team</p>
                          <div style="margin:0; white-space:pre-wrap; color:#374151; line-height:1.6;">${safeEmployerMessage}</div>
                        </div>
                        `
                        : ""
                    }

                    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
                      <tbody>
                        ${detailsRows}
                      </tbody>
                    </table>

                    <h3 style="margin:24px 0 10px 0;color:#14532d;">Services</h3>

                    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                      <thead>
                        <tr style="background:#15803D;color:#fff;">
                          <th style="padding:10px;border:1px solid #15803D;text-align:left;">Service</th>
                          <th style="padding:10px;border:1px solid #15803D;text-align:center;">Unit</th>
                          <th style="padding:10px;border:1px solid #15803D;text-align:center;">Qty</th>
                          <th style="padding:10px;border:1px solid #15803D;text-align:right;">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${
                          servicesHtml ||
                          `<tr><td colspan="4" style="padding:12px;border:1px solid #d1d5db;text-align:center;">No services provided</td></tr>`
                        }
                        ${urgentFeeRowHtml}
                      </tbody>
                    </table>

                    ${
                      imagesHtml
                        ? `
                        <h3 style="margin:24px 0 10px 0;color:#14532d;">Images</h3>
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                          <tr>
                            ${imagesHtml}
                          </tr>
                        </table>
                        `
                        : ""
                    }

                    <div style="margin-top:24px;">
                      <p style="margin:0 0 8px 0;"><strong>Services Subtotal:</strong> $${formatMoney(
                        servicesOnlySubtotal
                      )}</p>
                      ${
                        has_urgent_fee
                          ? `<p style="margin:0 0 8px 0;"><strong>Urgent Fee:</strong> $${formatMoney(
                              safeUrgentFee
                            )}</p>`
                          : ""
                      }
                      <p style="margin:0 0 8px 0;"><strong>Subtotal:</strong> $${formatMoney(
                        safeSubtotal
                      )}</p>
                      <p style="margin:0 0 8px 0;"><strong>GST:</strong> $${formatMoney(
                        safeGST
                      )}</p>
                      <p style="margin:0;"><strong>Total:</strong> $${formatMoney(safeTotal)}</p>
                    </div>

                    ${termsSectionHtml}

                    <div style="margin-top:24px;">
                      <a
                        href="${safeQuoteLink || "#"}"
                        style="display:inline-block;background:#10b981;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;"
                      >
                        View &amp; Respond
                      </a>
                    </div>

                    <p style="font-size:12px;margin-top:16px;word-break:break-all;color:#4b5563;">
                      ${safeQuoteLinkText}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = `Hi ${name || "there"},

Your quote is ready and valid until ${expiry}.

Quote ID: ${quoteUUID}
Service Frequency: ${formatRecurrenceLabel(recurrence_frequency)}

Services Subtotal: $${formatMoney(servicesOnlySubtotal)}
${has_urgent_fee ? `Urgent Fee: $${formatMoney(safeUrgentFee)}\n` : ""}Subtotal: $${formatMoney(
    safeSubtotal
  )}
GST: $${formatMoney(safeGST)}
Total: $${formatMoney(safeTotal)}

${termsVersion ? `Terms version: ${termsVersion}\n` : ""}${
    termsSummary ? `Terms summary: ${termsSummary}\n` : ""
  }${termsUrl ? `Terms & Conditions: ${termsUrl}\n` : ""}
View & Respond: ${quoteLink}
`;

  const attachments = [];

  if (pdfBuffer) {
    attachments.push({
      filename: `quote-${quoteUUID}.pdf`,
      content: pdfBuffer,
    });
  }

  if (termsPdfBuffer) {
    attachments.push({
      filename: termsFileName,
      content: termsPdfBuffer,
    });
  }

  const { data: resendData, error } = await resend.emails.send({
    from: process.env.QUOTES_EMAIL,
    to,
    reply_to: process.env.REPLY_TO_QUOTES,
    subject,
    html,
    text,
    attachments,
  });

  if (error) {
    console.error("Resend error:", error);
    throw error;
  }

  return resendData;
}