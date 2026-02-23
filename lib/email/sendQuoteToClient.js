// import { Resend } from "resend";

// const resend = new Resend(process.env.RESEND_API_KEY);

// export default async function sendQuoteToClient({ to, subject, data, pdfBuffer }) {
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
//   } = data;

//   // ===== DETAILS ROWS =====
//   const detailsRows = [
//     ["Quote #", quoteUUID],
//     ["Customer", name],
//     ...(mobile ? [["Mobile", mobile]] : []),
//     ...(landline ? [["Landline", landline]] : []),
//     ["Email", email],
//     ...(message ? [["Message", message]] : []),
//   ]
//     .map(
//       ([label, value]) => `
//       <tr>
//         <td style="padding: 8px 10px; font-weight: bold; width: 35%; background: #f9fafb; border: 1px solid #eee;">
//           ${label}
//         </td>
//         <td style="padding: 8px 10px; border: 1px solid #eee;">
//           ${value}
//         </td>
//       </tr>
//     `
//     )
//     .join("");

//   // ===== SERVICES ROWS =====
//   const servicesHtml = (services || [])
//     .map(
//       (s, i) => `
//       <tr style="background: ${i % 2 === 0 ? "#f0fdf4" : "#dcfce7"};">
//         <td style="padding: 12px; text-align: left;">${s.label}</td>
//         <td style="padding: 12px; text-align: center;">$${s.unit_price.toFixed(2)}</td>
//         <td style="padding: 12px; text-align: center;">${s.quantity}</td>
//         <td style="padding: 12px; text-align: right;">$${(s.unit_price * s.quantity).toFixed(2)}</td>
//       </tr>
//     `
//     )
//     .join("");

//   // ===== IMAGES HTML =====
//   const imagesHtml = (images || [])
//     .map((img) => {
//       const url = img.url || img;
//       return `
//         <td style="padding-right:10px;" align="left">
//           <a href="${url}" target="_blank" style="text-decoration:none; display:inline-block;">
//             <img
//               src="${url}"
//               width="60"
//               height="60"
//               style="display:block; border-radius:8px; border:1px solid #ddd;"
//               alt="Quote Image"
//             />
//           </a>
//         </td>
//       `;
//     })
//     .join("");

//   // ===== HTML EMAIL =====
//   const html = `
// <!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="UTF-8">
//   <title>Your Quote</title>
// </head>
// <body style="font-family: Arial, sans-serif; max-width: 700px; margin: auto; color: #1f2937;">

//   <!-- HEADER -->
//   <div style="background: #14532D; padding: 20px; text-align: center; color: #fff;">
//     <h1 style="margin: 0; font-weight: bold; font-size: 28px; color: #fff; display: flex; align-items: center; gap: 4px;">
//         <span style="font-size: 36px;">H</span>
//         <img src="https://${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/seedream-image.png"
//           alt="Happy Lawns" style="width: 64px; height: 64px; margin-left: -2px;" />
//         <span style="font-size: 36px;">ppy Lawns</span>
//       </h1>
//   </div>

//   <!-- BODY -->
//   <div style="background: #ffffff; padding: 24px; border:1px solid #e5e7eb; border-radius:0 0 10px 10px;">

//     <h2 style="color: #065f46;">Hi ${name}, your quote is ready!</h2>
//     <p>Your quote is valid until <strong>${expiry}</strong>.</p>

//     <!-- DETAILS TABLE -->
//     <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
//       <tbody>
//         ${detailsRows}
//       </tbody>
//     </table>

//     <!-- SERVICES TABLE -->
//     <h3>Services</h3>
//     <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
//       <thead>
//         <tr style="background: #15803D; color: #fff;">
//           <th style="padding:10px; text-align:left;">Service</th>
//           <th style="padding:10px; text-align:center;">Unit Price</th>
//           <th style="padding:10px; text-align:center;">Qty</th>
//           <th style="padding:10px; text-align:right;">Total</th>
//         </tr>
//       </thead>
//       <tbody>
//         ${servicesHtml || `<tr><td colspan="4" style="text-align:center;">No services provided</td></tr>`}
//       </tbody>
//     </table>

//     <!-- IMAGES -->
//     ${imagesHtml.length > 0 ? `
//       <h3>Images</h3>
//       <table style="border-collapse: separate; border-spacing: 10px;">
//         <tr>
//           ${imagesHtml}
//         </tr>
//       </table>
//     ` : ""}

//     <!-- TOTALS -->
//     <p><strong>Subtotal:</strong> $${subtotal.toFixed(2)}</p>
//     <p><strong>GST (15%):</strong> $${gst.toFixed(2)}</p>
//     <p><strong>Total:</strong> $${total.toFixed(2)}</p>

//     <p style="padding: 10px 0;"><a href="${quoteLink}" style="background:#10b981; color:white; padding:12px 20px; border-radius:8px; text-decoration:none;">View & Respond to Quote</a></p>

//   </div>
// </body>
// </html>
// `;

//   // ===== PLAIN TEXT =====
//   const text = `
//   Hi ${name},

//   Your quote is ready and valid until ${expiry}.

//   Quote ID ${quoteUUID}
//   ${mobile ? "Mobile: " + mobile : ""}
//   ${landline ? "Landline: " + landline : ""}
//   Email: ${email}
//   ${message ? "Message: " + message : ""}

//   Services:
//   ${(services || [])
//     .map(
//       (s) =>
//         `${s.label} - $${s.unit_price.toFixed(2)} x ${s.quantity} = $${(
//           s.unit_price * s.quantity
//         ).toFixed(2)}`
//     )
//     .join("\n")}

//   Subtotal: $${subtotal.toFixed(2)}
//   + GST (15%): $${gst.toFixed(2)}
//   Total: $${total.toFixed(2)}

//   View & Respond to Quote: ${quoteLink}

//   If you have any questions, reply to this email.
// `;

//   // ===== SEND EMAIL VIA RESEND =====
//   await resend.emails.send({
//     from: process.env.EMAIL_USER,      // Verified Resend sender
//     to,                                  // Client email
//     reply_to: process.env.REPLY_TO,    // Optional reply-to
//     subject,
//     html,
//     text,
//     attachments: pdfBuffer
//     ? [
//         {
//           filename: `quote-${data.quoteUUID}.pdf`,
//           content: pdfBuffer,
//         },
//       ]
//     : [],
//   });

//   console.log("Quote email sent to client via Resend!");
// }

// import { Resend } from "resend";

// const resend = new Resend(process.env.RESEND_API_KEY);

// const formatMoney = (value) => Number(value || 0).toFixed(2);

// export default async function sendQuoteToClient({
//   to,
//   subject,
//   data,
//   pdfBuffer
// }) {
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
//     employer_message
//   } = data;

//   const safeSubtotal = Number(subtotal || 0);
//   const safeGST = Number(gst || 0);
//   const safeTotal = Number(total || 0);

//   // ===============================
//   // Services HTML
//   // ===============================
//   const servicesHtml = (services || [])
//     .map((s, i) => {
//       const unitPrice = Number(s.unit_price || 0);
//       const qty = Number(s.quantity || 1);
//       const lineTotal = unitPrice * qty;

//       return `
//         <tr style="background:${i % 2 === 0 ? "#f0fdf4" : "#dcfce7"};">
//           <td style="padding:12px;text-align:left;">
//             ${s.label || "Service"}
//           </td>
//           <td style="padding:12px;text-align:center;">
//             $${formatMoney(unitPrice)}
//           </td>
//           <td style="padding:12px;text-align:center;">
//             ${qty}
//           </td>
//           <td style="padding:12px;text-align:right;">
//             $${formatMoney(lineTotal)}
//           </td>
//         </tr>
//       `;
//     })
//     .join("");

//   // ===============================
//   // Images HTML
//   // ===============================
//   const imagesHtml = (images || [])
//     .map((img) => {
//       const url = img.url || img;

//       return `
//         <td style="padding-right:10px;" align="left">
//           <a href="${url}" target="_blank" style="text-decoration:none;">
//             <img
//               src="${url}"
//               width="60"
//               height="60"
//               style="display:block;border-radius:8px;border:1px solid #ddd;"
//               alt="Quote Image"
//             />
//           </a>
//         </td>
//       `;
//     })
//     .join("");

//   // ===============================
//   // Details Table
//   // ===============================
//   const detailsRows = [
//     ["Quote ID", quoteUUID],
//     ["Customer", name],
//     ...(mobile ? [["Mobile", mobile]] : []),
//     ...(landline ? [["Landline", landline]] : []),
//     ["Email", email],
//     ...(message ? [["Message", message]] : [])
//   ]
//     .map(
//       ([label, value]) => `
//       <tr>
//         <td style="padding:8px 10px;font-weight:bold;width:35%;background:#f9fafb;border:1px solid #eee;">
//           ${label}
//         </td>
//         <td style="padding:8px 10px;border:1px solid #eee;">
//           ${value ?? "-"}
//         </td>
//       </tr>
//     `
//     )
//     .join("");

//   // ===============================
//   // HTML Email Template
//   // ===============================
//   const html = `
//   <!DOCTYPE html>
//   <html lang="en">
//   <body style="font-family:Arial,sans-serif;max-width:700px;margin:auto;color:#1f2937;">

//   <div style="background:#14532D;padding:20px;text-align:center;color:#fff;">
//   <h1 style="margin:0;font-weight:bold;font-size:28px;color:#fff;">
//   Happy Lawns
//   </h1>
//   </div>

//   <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;">
//   <h2 style="color: #065f46; margin-top: 0;">Your Quote is Ready</h2>
//   <p><span style="font-size: 1.5rem">👋</span> Hi ${name},</p>
//   <p>Your quote is valid until <strong>${expiry}</strong>.</p>

  // ${
  //   employer_message
  //     ? `
  //   <div style="margin:20px 0;padding:16px;border-left:4px solid #15803D;background:#f0fdf4;border-radius:6px;">
  //     <p style="margin:0;font-weight:600;color:#14532d;">Message from our team</p>
  //     <p style="margin-top:8px;color:#374151;white-space:pre-line;">
  //       ${employer_message}
  //     </p>
  //   </div>
  //   `
  //     : ""
  // }

//   <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
//   <tbody>
//   ${detailsRows}
//   </tbody>
//   </table>

//   <h3>Services</h3>

//   <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
//   <thead>
//   <tr style="background:#15803D;color:#fff;">
//   <th style="padding:10px;text-align:left;">Service</th>
//   <th style="padding:10px;text-align:center;">Unit Price</th>
//   <th style="padding:10px;text-align:center;">Qty</th>
//   <th style="padding:10px;text-align:right;">Total</th>
//   </tr>
//   </thead>

//   <tbody>
//   ${
//     servicesHtml ||
//     `<tr><td colspan="4" style="text-align:center;">No services provided</td></tr>`
//   }
//   </tbody>
//   </table>

//   ${
//     imagesHtml.length > 0
//       ? `
//   <h3>Images</h3>
//   <table style="border-collapse:separate;border-spacing:10px;">
//   <tr>${imagesHtml}</tr>
//   </table>
//   `
//       : ""
//   }

//   <p><strong>Subtotal:</strong> $${formatMoney(safeSubtotal)}</p>
//   <p><strong>GST (15%):</strong> $${formatMoney(safeGST)}</p>
//   <p><strong>Total:</strong> $${formatMoney(safeTotal)}</p>

//   <p style="padding:10px 0;">
//   <a href="${quoteLink}"
//   style="background:#10b981;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;">
//   View & Respond to Quote
//   </a>
//   </p>

//   </div>
//   </body>
//   </html>
//   `;

//   const text = html.replace(/<[^>]*>/g, "");

//   await resend.emails.send({
//     from: process.env.EMAIL_USER,
//     to,
//     reply_to: process.env.REPLY_TO,
//     subject,
//     html,
//     text,
    // attachments: pdfBuffer
    //   ? [
    //       {
    //         filename: `quote-${quoteUUID}.pdf`,
    //         content: pdfBuffer
    //       }
    //     ]
    //   : []
//   });

//   console.log("Quote email sent to client via Resend!");
// }

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export default async function sendQuoteToClient({ to, subject, data, pdfBuffer }) {
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
    employer_message
  } = data;

  // Conditional details rows (mobile, landline)
  const detailsRows = [
    ["Quote #", quoteUUID],
    ["Customer", name],
    ...(mobile ? [["Mobile", mobile]] : []),
    ...(landline ? [["Landline", landline]] : []),
    ["Email", email],
    ...(message ? [["Message", message]] : []),
  ]
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding: 8px 10px; font-weight: bold; width: 35%; background: #f9fafb; border: 1px solid #eee;">
          ${label}
        </td>
        <td style="padding: 8px 10px; border: 1px solid #eee;">
          ${value}
        </td>
      </tr>
    `
    )
    .join("");

  // Services rows HTML
  const servicesHtml = (services || [])
    .map(
      (s, i) => `
      <tr style="background: ${i % 2 === 0 ? "#f0fdf4" : "#dcfce7"};">
        <td style="padding: 12px; text-align: left;">${s.label}</td>
        <td style="padding: 12px; text-align: center;">$${s.unit_price.toFixed(2)}</td>
        <td style="padding: 12px; text-align: center;">${s.quantity}</td>
        <td style="padding: 12px; text-align: right;">$${(s.unit_price * s.quantity).toFixed(2)}</td>
      </tr>
    `
    )
    .join("");

  // Images HTML
  const imagesHtml = (images || [])
    .map((img) => {
      const url = img.url || img;
      return `
        <td style="padding-right:10px;" align="left">
          <a href="${url}" target="_blank" style="text-decoration:none; display:inline-block;">
            <img
              src="${url}"
              width="60"
              height="60"
              style="display:block; border-radius:8px; border:1px solid #ddd;"
              alt="Quote Image"
            />
          </a>
        </td>
      `;
    })
    .join("");

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Your Quote</title>
  </head>
  <body style="font-family: Arial, sans-serif; max-width: 700px; margin: auto; color: #1f2937;">
  <div style="font-family: Arial, sans-serif; max-width: 700px; margin: auto; color: #1f2937;">

    <!-- HEADER -->
    <div style="background: #14532D; padding: 20px; border-radius: 10px 10px 0 0; display: flex; align-items: center; justify-content: space-between;">
      <h1 style="margin: 0; font-weight: bold; font-size: 28px; color: #fff; display: flex; align-items: center; gap: 4px;">
        <span style="font-size: 36px;">H</span>
        <img src="https://${process.env?.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png"
          alt="Happy Property Logo" style="width: 64px; height: 64px; margin-left: -2px;" />
        <span style="font-size: 36px;">ppy Property</span>
      </h1>
    </div>

    <!-- BODY -->
    <div style="background: #ffffff; padding: 24px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
      <h2 style="color: #065f46; margin-top: 0;">Your Quote is Ready</h2>
      <p><span style="font-size: 1.5rem">👋</span> Hi ${name},</p>
      <p>Your quote is valid until <strong>${expiry}</strong>.</p>
      ${
        employer_message
          ? `
        <div style="margin:20px 0;padding:16px;border-left:4px solid #15803D;background:#f0fdf4;border-radius:6px;">
          <p style="margin:0;font-weight:600;color:#14532d;">Message from our team</p>
          <p style="margin-top:8px;color:#374151;white-space:pre-line;">
            ${employer_message}
          </p>
        </div>
        `
          : ""
      }
      <!-- QUOTE DETAILS -->
      <h3 style="margin-top: 24px; color: #065f46;">Quote Details</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tbody>
          ${detailsRows}
        </tbody>
      </table>

      <!-- SERVICES -->
      <h3 style="margin-top: 24px; color: #065f46;">Services</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        <thead>
          <tr style="background: #15803D; color: #ffffff;">
            <th style="padding: 12px; text-align: left;">Service</th>
            <th style="padding: 12px; text-align: center;">Unit Price ($)</th>
            <th style="padding: 12px; text-align: center;">Quantity</th>
            <th style="padding: 12px; text-align: right;">Subtotal ($)</th>
          </tr>
        </thead>
        <tbody>
          ${servicesHtml || `<tr><td colspan="4" style="padding:12px;text-align:center;">No services provided</td></tr>`}
        </tbody>
      </table>

      <!-- IMAGES -->
      ${images.length > 0 ? `
        <h3 style="margin-top: 24px; color: #065f46;">Images</h3>
        <table style="border-collapse:separate; border-spacing:10px 0; margin-bottom:20px;">
          <tr>
            ${imagesHtml}
          </tr>
        </table>
      ` : `<p>No images attached</p>`}

      <div style="margin-top: 24px; text-align: right; font-size: 16px;">
        <p><strong>Subtotal:</strong> $${subtotal.toFixed(2)}</p>
        <p><strong>+ GST (15%):</strong> $${gst.toFixed(2)}</p>
        <p style="font-weight: bold; font-size: 18px;"><strong>Total Amount:</strong> $${total.toFixed(2)}</p>
      </div>

      <div style="margin-top: 32px; text-align: center;">
        <a href="${quoteLink}" style="background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          View & Respond to Quote
        </a>
      </div>

      <p style="margin-top: 24px; font-size: 12px; color: #6b7280; text-align: center;">
        If you have any questions, simply reply to this email.
      </p>
      <p style="margin-top: 30px; font-size: 12px; color: #999;">
          Thanks,<br/>
          The Happy Property's Team
      </p>
    </div>
    </div>
  </body>
  </html>
  `;

  const text = `
  Hi ${name},

  Your quote is ready and valid until ${expiry}.

  Quote ID ${quoteUUID}
  ${mobile ? "Mobile: " + mobile : ""}
  ${landline ? "Landline: " + landline : ""}
  Email: ${email}
  ${message ? "Message: " + message : ""}

  Services:
  ${(services || [])
    .map(
      (s) =>
        `${s.label} - $${s.unit_price.toFixed(2)} x ${s.quantity} = $${(
          s.unit_price * s.quantity
        ).toFixed(2)}`
    )
    .join("\n")}

  Subtotal: $${subtotal.toFixed(2)}
  + GST (15%): $${gst.toFixed(2)}
  Total Amount: $${total.toFixed(2)}

  View & Respond to Quote: ${quoteLink}

  If you have any questions, reply to this email.
    `;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    html,
    text,
    attachments: pdfBuffer
      ? [
          {
            filename: `quote-${quoteUUID}.pdf`,
            content: pdfBuffer
          }
        ]
      : []
  };
  await transporter.sendMail(mailOptions);
}
