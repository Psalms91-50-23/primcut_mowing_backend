// import { Resend } from "resend";

// const resend = new Resend(process.env.RESEND_API_KEY);

// export default async function sendQuoteAccepted({ to, quote, pdfBuffer }) {
//   const {
//     uuid,
//     contact_first_name,
//     contact_last_name,
//     contact_email,
//     contact_mobile,
//     contact_landline,
//     services = [],
//     images = [],
//     responded_at,
//     gst_amount,
//     total_amount,
//     subtotal_amount,
//   } = quote;

//   const name = `${contact_first_name} ${contact_last_name}`;

//   // ===== DETAILS ROWS =====
//   const detailsRows = [
//     ["Quote #", uuid],
//     ["Customer", name],
//     ...(contact_mobile ? [["Mobile", contact_mobile]] : []),
//     ...(contact_landline ? [["Landline", contact_landline]] : []),
//     ["Email", contact_email],
//     ["Status", "Accepted"],
//     ["Responded at", responded_at ? new Date(responded_at).toLocaleString() : "-"],
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
//         <td style="padding: 12px; text-align: right;">${s.unit_price != null ? "$" + s.unit_price.toFixed(2) : "-"}</td>
//         <td style="padding: 12px; text-align: right;">${s.quantity != null ? s.quantity : "-"}</td>
//         <td style="padding: 12px; text-align: right;">${
//           s.unit_price != null && s.quantity != null ? (s.unit_price * s.quantity).toFixed(2) : "-"
//         }</td>
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
//               style="display:block; border-radius:6px; border:1px solid #ddd;"
//               alt="Quote Image"
//             />
//           </a>
//         </td>
//       `;
//     })
//     .join("");

//   // ===== HTML EMAIL =====
//   const html = `
//   <div style="font-family: Arial, sans-serif; max-width: 700px; margin: auto; color: #1f2937;">
//     <!-- HEADER -->
//     <div style="background: #14532D; padding: 20px; border-radius: 10px 10px 0 0; text-align:center; color:#fff;">
//       <h1 style="margin: 0; font-weight: bold; font-size: 28px; color: #fff; display: flex; align-items: center; gap: 4px;">
//         <span style="font-size: 36px;">H</span>
//         <img src="https://${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/seedream-image.png"
//           alt="Happy Lawns" style="width: 64px; height: 64px; margin-left: -2px;" />
//         <span style="font-size: 36px;">ppy Lawns</span>
//       </h1>
//     </div>

//     <!-- BODY -->
//     <div style="background: #ffffff; padding: 24px; border-radius: 0 0 10px 10px; border:1px solid #e5e7eb; border-top:none;">
//       <h2 style="color: #065f46; margin-top:0;">Quote Accepted ✅</h2>
//       <p><span style="font-size:1.5rem">👋</span> Hi ${name},</p>
//       <p>Thank you for accepting your quote. We will contact you shortly to proceed.</p>

//       <!-- QUOTE DETAILS -->
//       <h3>Quote Details</h3>
//       <table style="width:100%; border-collapse: collapse; margin-bottom:20px;">
//         <tbody>
//           ${detailsRows}
//         </tbody>
//       </table>

//       <!-- SERVICES TABLE -->
//       <h3>Services</h3>
//       <table style="width:100%; border-collapse: collapse; margin-bottom:20px;">
//         <thead>
//           <tr style="background:#15803D; color:#fff;">
//             <th style="padding:10px; text-align:left;">Service</th>
//             <th style="padding:10px; text-align:right;">Unit Price</th>
//             <th style="padding:10px; text-align:right;">Qty</th>
//             <th style="padding:10px; text-align:right;">Subtotal</th>
//           </tr>
//         </thead>
//         <tbody>
//           ${servicesHtml || `<tr><td colspan="4" style="text-align:center;">No services provided</td></tr>`}
//         </tbody>
//       </table>

//       <!-- IMAGES -->
//       ${imagesHtml.length > 0 ? `
//         <h3>Images</h3>
//         <table style="border-collapse: separate; border-spacing: 10px;">
//           <tr>
//             ${imagesHtml}
//           </tr>
//         </table>
//       ` : ""}

//       <!-- TOTALS -->
//       <p><strong>Subtotal:</strong> $${subtotal_amount.toFixed(2)}</p>
//       <p><strong>GST 15%:</strong> $${gst_amount.toFixed(2)}</p>
//       <p><strong>Total:</strong> $${total_amount.toFixed(2)}</p>

//       <p style="margin-top:24px; font-size:12px; color:#6b7280;">If you have any questions, simply reply to this email.</p>
//     </div>
//   </div>
//   `;

//   // ===== PLAIN TEXT =====
//   const text = `
// Hi ${name},

// Your quote #${uuid} has been accepted ✅

// Services:
// ${(services || [])
//     .map(
//       (s) =>
//         `${s.label} - ${s.unit_price != null ? "$" + s.unit_price.toFixed(2) : "-"} x ${s.quantity || "-"} = ${
//           s.unit_price != null && s.quantity != null ? "$" + (s.unit_price * s.quantity).toFixed(2) : "-"
//         }`
//     )
//     .join("\n")}

// Subtotal: $${subtotal_amount.toFixed(2)}
// GST 15%: $${gst_amount.toFixed(2)}
// Total: $${total_amount.toFixed(2)}

// Responded at: ${responded_at ? new Date(responded_at).toLocaleString() : "-"}

// If you have any questions, reply to this email.
//   `;

//   // ===== SEND EMAIL VIA RESEND =====
//   await resend.emails.send({
//     from: process.env.EMAIL_USER,     // Verified Resend sender
//     to,                               // Client email
//     reply_to: process.env.REPLY_TO,  // Optional reply-to
//     subject: `Quote ID ${uuid} Accepted ✅`,
//     html,
//     text,
//     attachments: pdfBuffer
//     ? [
//         {
//           filename: `quote-${quote.quoteUUID}.pdf`,
//           content: pdfBuffer,
//         },
//       ]
//     : [],
//   });

//   console.log("Quote accepted email sent to client via Resend!");
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

export default async function sendQuoteAccepted({ to, quote }) {
  const {
    uuid,
    contact_first_name,
    contact_last_name,
    contact_email,
    contact_mobile,
    contact_landline,
    services = [],
    images = [],
    responded_at,
    gst_amount,
    total_amount,
    subtotal_amount,
  } = quote;

  const name = `${contact_first_name} ${contact_last_name}`;

  // Quote details rows for HTML
  const detailsRows = [
    ["Quote #", uuid],
    ["Customer", name],
    ...(contact_mobile ? [["Mobile", contact_mobile]] : []),
    ...(contact_landline ? [["Landline", contact_landline]] : []),
    ["Email", contact_email],
    ["Status", "Accepted"],
    ["Responded at", responded_at ? new Date(responded_at).toLocaleString() : "-"],
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

  // Services table rows for HTML
  const servicesHtml = (services || [])
    .map(
      (s, i) => `
      <tr style="background: ${i % 2 === 0 ? "#f0fdf4" : "#f0fdf4"};">
        <td style="padding: 12px; text-align: left;">${s.label}</td>
        ${s.unit_price != null ? `<td style="padding: 12px; text-align: right;">$${s.unit_price.toFixed(2)}</td>` : `<td style="padding: 12px;">-</td>`}
        ${s.quantity != null ? `<td style="padding: 12px; text-align: right;">${s.quantity}</td>` : `<td style="padding: 12px;">-</td>`}
        ${s.unit_price != null && s.quantity != null ? `<td style="padding: 12px; text-align: right;">$${(s.unit_price * s.quantity).toFixed(2)}</td>` : `<td style="padding: 12px;">-</td>`}
      </tr>
    `
    )
    .join("");

    const imagesHtml = (images || [])
    .map((img) => {
      const url = img.url || img;
      return `
        <table style="width: 100%; max-width: 220px; margin-bottom: 12px;">
          <tr>
            <td style="padding:0;">
              <a href="${url}" target="_blank" style="text-decoration: none;">
                <img
                  src="${url}"
                  width="60"
                  height="60"
                  alt="Quote image"
                  style="display: block; border-radius: 6px; border: 1px solid #ddd; "
                />
              </a>
            </td>
          </tr>
        </table>
      `;
    })
    .join("");

  const html = `
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
    <div style="background: #ffffff; padding: 24px; border-radius: 0 0 10px 10px; border:1px solid #e5e7eb; border-top:none;">
      <h2 style="color: #065f46; margin-top:0;">Quote Accepted ✅</h2>
      <p><span style="font-size:1.5rem">👋</span> Hi ${name},</p>
      <p>Thank you for accepting your quote. We will contact you shortly to proceed.</p>

      <!-- QUOTE DETAILS -->
      <h3 style="margin-top:24px; color:#065f46;">Quote Details</h3>
      <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        <tbody>
          ${detailsRows}
        </tbody>
      </table>

      <!-- SERVICES -->
      <h3 style="margin-top:24px; color: #065f46;">Services</h3>
      <table style="width:100%; border-collapse:collapse; margin-top:8px;">
        <thead>
          <tr style="background: #15803D; color: #ffffff;">
            <th style="padding:12px; text-align:left;">Service</th>
            <th style="padding:12px; text-align:right;">Unit Price ($)</th>
            <th style="padding:12px; text-align:right;">Quantity</th>
            <th style="padding:12px; text-align:right;">Subtotal ($)</th>
          </tr>
        </thead>
        <tbody>
          ${servicesHtml || `<tr><td colspan="4" style="padding:12px;text-align:center;">No services provided</td></tr>`}
        </tbody>
      </table>
      <!-- TOTALS -->
      <table style="width:100%; border-collapse:collapse; margin-top:16px;">
      </table>
       <!-- IMAGES -->
        ${imagesHtml.length > 0 ? `
          <h3 style="margin-bottom: 8px; color: #064e3b;">Images</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              ${imagesHtml}
            </tr>
          </table>
        ` : ""}
        <tbody>
          <tr>
            <td style="padding:8px 10px; text-align:right; font-weight:bold;">SubTotal ($)</td>
            <td style="padding:8px 10px; text-align:right;">${subtotal_amount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px; text-align:right; font-weight:bold;">GST 15% ($)</td>
            <td style="padding:8px 10px; text-align:right;">${gst_amount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px; text-align:right; font-weight:bold; font-size:16px;">Total ($)</td>
            <td style="padding:8px 10px; text-align:right; font-size:16px;">${total_amount.toFixed(2)}</td>
          </tr>
        </tbody>
      <p style="margin-top:24px; font-size:12px; color:#6b7280;">If you have any questions, simply reply to this email.</p>
       <p style="margin-top: 30px; font-size: 12px; color: #999;">
          Thanks,<br/>
          The Happy Property's Team
        </p>
    </div>
  </div>
  `;

  const text = `
Hi ${name},

Your quote #${uuid} has been accepted ✅

Services:
${(services || [])
    .map(
      (s) =>
        `${s.label} - ${s.unit_price != null ? "$" + s.unit_price.toFixed(2) : "-"} x ${s.quantity || "-"} = ${
          s.unit_price != null && s.quantity != null ? "$" + (s.unit_price * s.quantity).toFixed(2) : "-"
        }`
    )
    .join("\n")}

Subtotal: $${subtotal_amount.toFixed(2)}
GST 15%: $${gst_amount.toFixed(2)}
Total: $${total_amount.toFixed(2)}

Responded at: ${responded_at ? new Date(responded_at).toLocaleString() : "-"}

If you have any questions, reply to this email.
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: `Quote ID ${uuid} Accepted ✅`,
    html,
    text,
  });
}