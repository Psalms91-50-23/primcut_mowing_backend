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

//     <div style="background: #14532D; padding: 20px; text-align: center;">
//       <h1 style="margin: 0; font-size: 28px; color: #fff; display: flex; align-items: center; justify-content: center; gap: 8px;">
//         <span style="font-size: 36px;">H</span>
//         <img
//           src="${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png"
//           alt="Happy Property Logo"
//           style="width: 56px; height: 56px; display:block;"
//         />
//         <span style="font-size: 36px;">ppy Property</span>
//       </h1>
//     </div>

//   <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;">
//   <h2 style="color: #065f46; margin-top: 0;">Your Quote is Ready</h2>
//   <p><span style="font-size: 1.5rem">👋</span> Hi ${name},</p>
//   <p>Your quote is valid until <strong>${expiry}</strong>.</p>

//   ${
//     employer_message
//       ? `
//     <div style="margin:20px 0;padding:16px;border-left:4px solid #15803D;background:#f0fdf4;border-radius:6px;">
//       <p style="margin:0;font-weight:600;color:#14532d;">Message from our team</p>
//       <p style="margin-top:8px;color:#374151;white-space:pre-line;">
//         ${employer_message}
//       </p>
//     </div>
//     `
//       : ""
//   }

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
//     attachments: pdfBuffer
//       ? [
//           {
//             filename: `quote-${quoteUUID}.pdf`,
//             content: pdfBuffer
//           }
//         ]
//       : []
//   });

//   console.log("Quote email sent to client via Resend!");
// }

// import nodemailer from "nodemailer";
// const formatMoney = (value) => Number(value || 0).toFixed(2);
// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   // host: "smtp.gmail.com",
//   port: Number(process.env.EMAIL_PORT || 587),
//   secure: false,
//   requireTLS: true,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// export default async function sendQuoteToClient({ 
//   to, 
//   subject, 
//   data, 
//   pdfBuffer }) {
//     if (!data) throw new Error("Email data is required");

//     // ✅ put verify INSIDE the function and await it
//   try {
//     await transporter.verify();
//     console.log("SMTP connection OK");
//   } catch (err) {
//     console.error("SMTP connection failed:", err);
//     throw err; // optional, but helpful so you can see failures upstream
//   }

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

//    // ✅ put verify INSIDE the function and await it
//   try {
//     await transporter.verify();
//     console.log("SMTP connection OK");
//   } catch (err) {
//     console.error("SMTP connection failed:", err);
//     throw err; // optional, but helpful so you can see failures upstream
//   }

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
//     <!DOCTYPE html>
//     <html lang="en">
//     <body style="font-family:Arial,sans-serif;max-width:700px;margin:auto;color:#1f2937;">
//       <div style="background: #ffffff;padding:20px 24px;text-align:left;">
//         <table
//           role="presentation"
//           align="left"
//           cellpadding="0"
//           cellspacing="0"
//           border="0"
//           style="border-collapse:collapse;
//           background: #14532D;
//           "
//         >
//           <tr>
//              <td style="vertical-align:middle; color:#ffffff; font-size:27px; font-weight:bold; line-height:1;">
//                 H
//             </td>
//             <td style="vertical-align:middle; padding:0 0px;">
//               <img
//                 src="https://${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png"
//                 alt="Happy Property Logo"
//                 width="44"
//                 height="44"
//                 style="display:block; width:44px; height:44px;"
//               />
//             </td>
//              <td style="vertical-align:middle; color: #ffffff; font-size:27px; font-weight:bold; line-height:1;">
//               ppy Property
//             </td>
//           </tr>
//         </table>
      
//         <div style="background: #ffffff; padding:24px;border:1px solid #e5e7eb;">
//         <h2 style="color: #065f46; margin-top: 0; font-size:22px; line-height:1.3;">Your Quote is Ready</h2>
//         <p><span style="font-size: 1.5rem">👋</span> Hi ${name},</p>
//         <p>Your quote is valid until <strong>${expiry}</strong>.</p>

//       ${
//         employer_message
//           ? `
//         <div style="margin:20px 0;padding:16px;border-left:4px solid #15803D;background:#f0fdf4;border-radius:6px;">
//           <p style="margin:0;font-weight:600;color:#14532d;">Message from our team</p>
//           <p style="margin-top:8px;color:#374151;white-space:pre-line;">
//             ${employer_message}
//           </p>
//         </div>
//         `
//           : ""
//       }

//       <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
//       <tbody>
//       ${detailsRows}
//       </tbody>
//       </table>

//       <h3>Services</h3>

//       <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
//       <thead>
//       <tr style="background:#15803D;color:#fff;">
//       <th style="padding:10px;text-align:left;">Service</th>
//       <th style="padding:10px;text-align:center;">Unit Price</th>
//       <th style="padding:10px;text-align:center;">Qty</th>
//       <th style="padding:10px;text-align:right;">Total</th>
//       </tr>
//       </thead>

//       <tbody>
//       ${
//         servicesHtml ||
//         `<tr><td colspan="4" style="text-align:center;">No services provided</td></tr>`
//       }
//       </tbody>
//       </table>

//       ${
//         imagesHtml.length > 0
//           ? `
//       <h3>Images</h3>
//       <table style="border-collapse:separate;border-spacing:10px;">
//       <tr>${imagesHtml}</tr>
//       </table>
//       `
//           : ""
//       }

//       <p><strong>Subtotal:</strong> $${formatMoney(safeSubtotal)}</p>
//       <p><strong>GST (15%):</strong> $${formatMoney(safeGST)}</p>
//       <p><strong>Total:</strong> $${formatMoney(safeTotal)}</p>

//       <p style="padding:10px 0;">
//       <a href="${quoteLink}"
//       style="background:#10b981;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;">
//       View & Respond to Quote
//       </a>
//       </p>

//       <p style="font-size:12px;color:#888; padding-top: 1rem;">
//         If the button doesn't work, copy and paste this link into your browser:
//       </p>

//       <p style="font-size:12px;word-break:break-all; padding: 1rem 0rem;">
//         ${quoteLink}
//       </p

//       </div>
//       </body>
//       </html>
//       `;

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
//   Total Amount: $${total.toFixed(2)}

//   View & Respond to Quote: ${quoteLink}

//   If you have any questions, reply to this email.
//     `;

//   const mailOptions = {
//     from: process.env.EMAIL_USER,
//     to,
//     reply_to: process.env.REPLY_TO,
//     subject,
//     html,
//     text,
//     attachments: pdfBuffer
//       ? [
//           {
//             filename: `quote-${quoteUUID}.pdf`,
//             content: pdfBuffer
//           }
//         ]
//       : []
//   };
//   await transporter.sendMail(mailOptions);
// }

// </div>
//       <div style="background: #14532D; padding: 20px; text-align: center;">
//         <h1 style="margin: 0; font-size: 28px; color: #fff; display: flex; align-items: center; justify-content: center; gap: 8px;">
//           <span style="font-size: 36px;">H</span>
//           <img
//             src="https://${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png"
//             alt="Happy Property Logo"
//             style="width: 56px; height: 56px; display:block;"
//           />
//           <span style="font-size: 36px;">ppy Property</span>
//         </h1>
//       </div>

//original
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
//     <!DOCTYPE html>
//     <html lang="en">
//     <body style="font-family:Arial,sans-serif;max-width:700px;margin:auto;color:#1f2937;">
//       <div style="background:#ffffff;padding:20px 24px;text-align:left;">

//         <table role="presentation" style="background:#14532D;">
//           <tr>
//             <td style="color:#fff;font-size:27px;font-weight:bold;">H</td>
//             <td>
//               <img src="https://${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png"
//                    width="44" height="44" />
//             </td>
//             <td style="color:#fff;font-size:27px;font-weight:bold;">ppy Property</td>
//           </tr>
//         </table>

//         <div style="padding:24px;border:1px solid #e5e7eb;">
//           <h2 style="color:#065f46;">Your Quote is Ready</h2>

//           <p>👋 Hi ${name},</p>
//           <p>Your quote is valid until <strong>${expiry}</strong>.</p>

//           ${
//             employer_message
//               ? `
//               <div style="margin:20px 0;padding:16px;border-left:4px solid #15803D;background:#f0fdf4;">
//                 <strong>Message from our team</strong>
//                 <p>${employer_message}</p>
//               </div>`
//               : ""
//           }

//           <table>${detailsRows}</table>

//           <h3>Services</h3>
//           <table>
//             <thead>
//               <tr style="background:#15803D;color:#fff;">
//                 <th>Service</th><th>Unit</th><th>Qty</th><th>Total</th>
//               </tr>
//             </thead>
//             <tbody>
//               ${
//                 servicesHtml ||
//                 `<tr><td colspan="4">No services provided</td></tr>`
//               }
//             </tbody>
//           </table>

//           ${
//             imagesHtml
//               ? `<h3>Images</h3><table><tr>${imagesHtml}</tr></table>`
//               : ""
//           }

//           <p><strong>Subtotal:</strong> $${formatMoney(safeSubtotal)}</p>
//           <p><strong>GST:</strong> $${formatMoney(safeGST)}</p>
//           <p><strong>Total:</strong> $${formatMoney(safeTotal)}</p>

//           <a href="${quoteLink}" style="background:#10b981;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;">
//             View & Respond
//           </a>

//           <p style="font-size:12px;">${quoteLink}</p>
//         </div>
//       </div>
//     </body>
//     </html>
//   `;

//   const text = `
// Hi ${name},

// Your quote is ready and valid until ${expiry}.

// Quote ID: ${quoteUUID}

// View & Respond: ${quoteLink}
// `;

//   // ===============================
//   // RESEND SEND
//   // ===============================
//   const { data: resendData, error } = await resend.emails.send({
//     from: process.env.EMAIL_USER, // must be verified domain in Resend
//     to,
//     reply_to: process.env.REPLY_TO,
//     subject,
//     html,
//     text,
//     attachments: pdfBuffer
//       ? [
//           {
//             filename: `quote-${quoteUUID}.pdf`,
//             content: pdfBuffer
//           }
//         ]
//       : []
//   });

//   if (error) {
//     console.error("Resend error:", error);
//     throw error;
//   }

//   return resendData;
// }

// import { Resend } from "resend";

// const resend = new Resend(process.env.RESEND_API_KEY);

// const formatMoney = (value) => Number(value || 0).toFixed(2);

// export default async function sendQuoteToClient({
//   to,
//   subject,
//   data,
//   pdfBuffer,
//   termsPdfBuffer = null,
//   termsFileName = "terms-and-conditions.pdf",
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

//   const urgentFeeRowHtml =
//     has_urgent_fee && safeUrgentFee > 0
//       ? `
//         <tr style="background:#fef2f2;">
//           <td style="padding:12px;text-align:left;font-weight:bold;color:#991b1b;">
//             Urgent Fee
//           </td>
//           <td style="padding:12px;text-align:center;">-</td>
//           <td style="padding:12px;text-align:center;">-</td>
//           <td style="padding:12px;text-align:right;font-weight:bold;color:#991b1b;">
//             $${formatMoney(safeUrgentFee)}
//           </td>
//         </tr>
//       `
//       : "";

//   const termsSectionHtml =
//     termsPdfBuffer || termsUrl
//       ? `
//         <div style="margin-top:24px;padding:16px;border:1px solid #d1fae5;background:#f0fdf4;border-radius:8px;">
//           <h3 style="margin:0 0 10px 0;color:#065f46;">Terms & Conditions</h3>
//           <p style="margin:0 0 10px 0;">
//             Please review our ${termsTitle}${termsVersion ? ` (Version ${termsVersion})` : ""}.
//           </p>
//           ${
//             termsUrl
//               ? `
//                 <p style="margin:0 0 10px 0;">
//                   <a
//                     href="${termsUrl}"
//                     target="_blank"
//                     style="color:#065f46;font-weight:bold;text-decoration:underline;"
//                   >
//                     View Terms & Conditions
//                   </a>
//                 </p>
//               `
//               : ""
//           }
//           <p style="margin:0;font-size:13px;color:#374151;">
//             A PDF copy of the Terms & Conditions is also attached to this email.
//           </p>
//         </div>
//       `
//       : "";

//   const html = `
//     <!DOCTYPE html>
//     <html lang="en">
//     <body style="font-family:Arial,sans-serif;max-width:700px;margin:auto;color:#1f2937;">
//       <div style="background:#ffffff;padding:20px 24px;text-align:left;">

//         <div style="background:#14532D;padding:20px;text-align:center;">
//           <h1 style="margin:0;font-size:28px;color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;">
//             <span style="font-size:36px;">H</span>
//             <img
//               src="https://${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png"
//               alt="Happy Property Logo"
//               style="width:56px;height:56px;display:block;"
//             />
//             <span style="font-size:36px;">ppy Property</span>
//           </h1>
//         </div>

//         <div style="padding:24px;border:1px solid #e5e7eb;">
//           <h2 style="color:#065f46;">Your Quote is Ready</h2>

//           <p>Hi ${name || "there"},</p>
//           <p>Your quote is valid until <strong>${expiry}</strong>.</p>

//           ${
//             employer_message
//               ? `
//               <div style="margin:20px 0;padding:16px;border-left:4px solid #15803D;background:#f0fdf4;">
//                 <strong>Message from our team</strong>
//                 <p style="margin:8px 0 0 0;">${employer_message}</p>
//               </div>
//               `
//               : ""
//           }

//           <table style="width:100%;border-collapse:collapse;margin-top:16px;">
//             ${detailsRows}
//           </table>

//           <h3 style="margin-top:24px;">Services</h3>
//           <table style="width:100%;border-collapse:collapse;">
//             <thead>
//               <tr style="background:#15803D;color:#fff;">
//                 <th style="padding:10px;text-align:left;">Service</th>
//                 <th style="padding:10px;text-align:center;">Unit</th>
//                 <th style="padding:10px;text-align:center;">Qty</th>
//                 <th style="padding:10px;text-align:right;">Total</th>
//               </tr>
//             </thead>
//             <tbody>
//               ${
//                 servicesHtml ||
//                 `<tr><td colspan="4" style="padding:12px;">No services provided</td></tr>`
//               }
//               ${urgentFeeRowHtml}
//             </tbody>
//           </table>

//           ${
//             imagesHtml
//               ? `<h3 style="margin-top:24px;">Images</h3><table><tr>${imagesHtml}</tr></table>`
//               : ""
//           }

//           <div style="margin-top:24px;">
//             <p><strong>Services Subtotal:</strong> $${formatMoney(servicesOnlySubtotal)}</p>
//             ${
//               has_urgent_fee
//                 ? `<p><strong>Urgent Fee:</strong> $${formatMoney(safeUrgentFee)}</p>`
//                 : ""
//             }
//             <p><strong>Subtotal:</strong> $${formatMoney(safeSubtotal)}</p>
//             <p><strong>GST:</strong> $${formatMoney(safeGST)}</p>
//             <p><strong>Total:</strong> $${formatMoney(safeTotal)}</p>
//           </div>

//           ${termsSectionHtml}

//           <div style="margin-top:24px;">
//             <a
//               href="${quoteLink}"
//               style="display:inline-block;background:#10b981;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;"
//             >
//               View & Respond
//             </a>
//           </div>

//           <p style="font-size:12px;margin-top:16px;word-break:break-all;">${quoteLink}</p>
//         </div>
//       </div>
//     </body>
//     </html>
//   `;

//   const text = `
//   Hi ${name || "there"},

//   Your quote is ready and valid until ${expiry}.

//   Quote ID: ${quoteUUID}

//   Services Subtotal: $${formatMoney(servicesOnlySubtotal)}
//   ${has_urgent_fee ? `Urgent Fee: $${formatMoney(safeUrgentFee)}\n` : ""}Subtotal: $${formatMoney(safeSubtotal)}
//   GST: $${formatMoney(safeGST)}
//   Total: $${formatMoney(safeTotal)}

//   ${termsVersion ? `Terms version: ${termsVersion}\n` : ""}${termsUrl ? `Terms & Conditions: ${termsUrl}\n` : ""}
//   View & Respond: ${quoteLink}
//     `;

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

const formatMoney = (value) => Number(value || 0).toFixed(2);

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
    termsUrl = "",
    termsVersion = "",
    termsTitle = "Terms & Conditions",
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

  const safeBaseUrl = (process.env.FRONTEND_URL_HAPPY_LAWNS || "").replace(/\/+$/, "");
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
    termsPdfBuffer || termsUrl
      ? `
        <div style="margin-top:24px;padding:16px;border:1px solid #d1fae5;background:#f0fdf4;border-radius:8px;">
          <h3 style="margin:0 0 10px 0;color:#065f46;">Terms &amp; Conditions</h3>
          <p style="margin:0 0 10px 0;">
            Please review our ${escapeHtml(termsTitle)}${
              termsVersion ? ` (Version ${escapeHtml(termsVersion)})` : ""
            }.
          </p>
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

Services Subtotal: $${formatMoney(servicesOnlySubtotal)}
${has_urgent_fee ? `Urgent Fee: $${formatMoney(safeUrgentFee)}\n` : ""}Subtotal: $${formatMoney(
    safeSubtotal
  )}
GST: $${formatMoney(safeGST)}
Total: $${formatMoney(safeTotal)}

${termsVersion ? `Terms version: ${termsVersion}\n` : ""}${
    termsUrl ? `Terms & Conditions: ${termsUrl}\n` : ""
  }
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