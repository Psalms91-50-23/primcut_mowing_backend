// import nodemailer from "nodemailer";

// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   port: Number(process.env.EMAIL_PORT || 587),
//   secure: false,
//   requireTLS: true,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// export default async function sendInquiryToBusiness({
//   inquiryUuid,
//   firstName,
//   lastName,
//   email,
//   phone,
//   message,
//   services = [],
//   inquiryLink
// }) {
//   try {
//     await transporter.verify();
//     console.log("SMTP connection OK");
//   } catch (err) {
//     console.error("SMTP connection failed:", err);
//     throw err;
//   }

//   const safeFullName = `${firstName || ""} ${lastName || ""}`.trim() || "—";

//   const servicesHtml =
//     Array.isArray(services) && services.length > 0
//       ? `
//         <tr>
//           <td style="padding:8px 10px;font-weight:bold;width:35%;background:#f9fafb;border:1px solid #eee;">
//             Services
//           </td>
//           <td style="padding:8px 10px;border:1px solid #eee;">
//             ${services.map((service) => service || "—").join(", ")}
//           </td>
//         </tr>
//       `
//       : "";

//   const detailsRowsHtml = `
//     <tr>
//       <td style="padding:8px 10px;font-weight:bold;width:35%;background:#f9fafb;border:1px solid #eee;">
//         Inquiry ID
//       </td>
//       <td style="padding:8px 10px;border:1px solid #eee;">
//         ${inquiryUuid || "—"}
//       </td>
//     </tr>
//     <tr>
//       <td style="padding:8px 10px;font-weight:bold;width:35%;background:#f9fafb;border:1px solid #eee;">
//         Customer
//       </td>
//       <td style="padding:8px 10px;border:1px solid #eee;">
//         ${safeFullName}
//       </td>
//     </tr>
//     <tr>
//       <td style="padding:8px 10px;font-weight:bold;width:35%;background:#f9fafb;border:1px solid #eee;">
//         Email
//       </td>
//       <td style="padding:8px 10px;border:1px solid #eee;">
//         ${email || "—"}
//       </td>
//     </tr>
//     <tr>
//       <td style="padding:8px 10px;font-weight:bold;width:35%;background:#f9fafb;border:1px solid #eee;">
//         Phone
//       </td>
//       <td style="padding:8px 10px;border:1px solid #eee;">
//         ${phone || "—"}
//       </td>
//     </tr>
//     ${servicesHtml}
//     <tr>
//       <td style="padding:8px 10px;font-weight:bold;width:35%;background:#f9fafb;border:1px solid #eee;">
//         Message
//       </td>
//       <td style="padding:8px 10px;border:1px solid #eee;">
//         ${message || "—"}
//       </td>
//     </tr>
//   `;

//   const actionHtml = `
//   <table
//     width="100%"
//     cellpadding="0"
//     cellspacing="0"
//     border="0"
//     style="margin-top:20px;"
//   >
//     <tr>
//       <td align="center">
//         <a
//           href="${inquiryLink}"
//           style="
//             display:inline-block;
//             padding:12px 20px;
//             background:#14532D;
//             color:#ffffff;
//             text-decoration:none;
//             border-radius:6px;
//             font-weight:bold;
//           "
//         >
//           View Inquiry
//         </a>
//       </td>
//     </tr>
//   </table>
// `;

//   const mailOptions = {
//     from: process.env.EMAIL_USER,
//     to: process.env.SEND_TO,
//     replyTo: email || undefined,
//     subject: "New Inquiry Received",
//     html: `
//       <!DOCTYPE html>
//       <html lang="en">
//       <head>
//         <meta charset="UTF-8" />
//         <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//         <title>New Inquiry</title>
//       </head>
//       <body style="margin:0; padding:20px; background:#f5f5f5; font-family:Arial, sans-serif; color:#1f2937;">
      
//         <table width="100%" cellpadding="0" cellspacing="0" border="0">
//           <tr>
//             <td align="center">
//               <table
//                 width="720"
//                 cellpadding="0"
//                 cellspacing="0"
//                 border="0"
//                 style="width:100%; max-width:720px; background:#ffffff; border:1px solid #e5e7eb; border-radius:10px;"
//               >
//                 <tr>
//                   <td style="background:#14532D; padding:20px; border-radius:10px 10px 0 0;">
//                     <table>
//                       <tr>
//                         <td style="color:#ffffff; font-size:27px; font-weight:bold;">
//                           H
//                         </td>
//                         <td style="padding:0 2px;">
//                           <img
//                             src="https://${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png"
//                             alt="Happy Property Logo"
//                             width="44"
//                             height="44"
//                             style="display:block;"
//                           />
//                         </td>
//                         <td style="color:#ffffff; font-size:27px; font-weight:bold;">
//                           ppy Property
//                         </td>
//                       </tr>
//                     </table>
//                   </td>
//                 </tr>

//                 <tr>
//                   <td style="padding:16px;">
//                     <h2 style="margin:0 0 10px 0; color:#064e3b;">
//                       New Inquiry Received
//                     </h2>

//                     <table
//                       width="100%"
//                       cellpadding="0"
//                       cellspacing="0"
//                       border="0"
//                       style="border-collapse:collapse; margin-bottom:20px;"
//                     >
//                       <tbody>
//                         ${detailsRowsHtml}
//                       </tbody>
//                     </table>
//                      ${actionHtml}
//                     <div style="padding-top:12px; border-top:1px solid #d1d5db; font-size:14px;">
//                       <strong>Action:</strong><br/>
//                       Reply directly to this email or contact the customer via phone/email above.
//                     </div>
//                   </td>
//                 </tr>

//               </table>
//             </td>
//           </tr>
//         </table>

//       </body>
//       </html>
//     `,
//   };

//   await transporter.sendMail(mailOptions);
// }

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function sendInquiryToBusiness({
  to = process.env.SEND_TO_INQUIRY,
  subject,
  data,
}) {
  if (!data) throw new Error("Inquiry email data is required");

  const {
    inquiryUuid,
    firstName,
    lastName,
    email,
    phone,
    message,
    services = [],
    inquiryLink,
    created_at,
  } = data;

  const safeFullName =
    `${firstName || ""} ${lastName || ""}`.trim() || "—";

  const normalizedServices = Array.isArray(services)
    ? services
    : services
    ? [services]
    : [];

  const detailsRows = [
    ["Inquiry ID", inquiryUuid],
    ["Customer", safeFullName],
    ["Email", email],
    ...(phone ? [["Phone", phone]] : []),
    ...(created_at ? [["Submitted", created_at]] : []),
    ...(message ? [["Message", message]] : []),
  ]
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:8px 10px;font-weight:bold;width:35%;background:#f9fafb;border:1px solid #eee;">
          ${label}
        </td>
        <td style="padding:8px 10px;border:1px solid #eee;">
          ${value ?? "—"}
        </td>
      </tr>
    `
    )
    .join("");

  const servicesHtml = normalizedServices.length
    ? normalizedServices
        .map(
          (item, i) => `
          <tr style="background:${i % 2 === 0 ? "#f0fdf4" : "#dcfce7"};">
            <td style="padding:12px;text-align:left;">
              ${
                typeof item === "string"
                  ? item
                  : item?.label || item?.name || item?.code || "Service"
              }
            </td>
          </tr>
        `
        )
        .join("")
    : "";

  const actionHtml = inquiryLink
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
        <tr>
          <td align="center">
            <a
              href="${inquiryLink}"
              style="
                display:inline-block;
                padding:12px 20px;
                background:#14532D;
                color:#ffffff;
                text-decoration:none;
                border-radius:6px;
                font-weight:bold;
              "
            >
              View Inquiry
            </a>
          </td>
        </tr>
      </table>
    `
    : "";

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <body style="font-family:Arial,sans-serif;max-width:700px;margin:auto;color:#1f2937;background:#f5f5f5;padding:20px;">

    <div style="background:#14532D;padding:20px;text-align:center;">
      <h1 style="margin:0;font-size:28px;color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;">
        <span style="font-size:36px;">H</span>
        <img
          src="${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png"
          alt="Happy Property Logo"
          style="width:56px;height:56px;display:block;"
        />
        <span style="font-size:36px;">ppy Property</span>
      </h1>
    </div>

    <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;">
      <h2 style="color:#065f46;margin-top:0;">New Inquiry Received</h2>

      <p>A new inquiry has been submitted through the website.</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tbody>
          ${detailsRows}
        </tbody>
      </table>

      ${
        servicesHtml
          ? `
        <h3>Requested Services</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <thead>
            <tr style="background:#15803D;color:#fff;">
              <th style="padding:10px;text-align:left;">Service</th>
            </tr>
          </thead>
          <tbody>
            ${servicesHtml}
          </tbody>
        </table>
      `
          : ""
      }

      ${actionHtml}

      <div style="padding-top:12px;border-top:1px solid #d1d5db;font-size:14px;">
        <strong>Action:</strong><br/>
        Reply directly to this email or contact the customer using the details above.
      </div>
    </div>
  </body>
  </html>
  `;

  const text = `
  New Inquiry Received

  Inquiry ID: ${inquiryUuid || "—"}
  Customer: ${safeFullName}
  Email: ${email || "—"}
  ${phone ? `Phone: ${phone}` : ""}
  ${created_at ? `Submitted: ${created_at}` : ""}
  ${message ? `Message: ${message}` : ""}

  ${
    normalizedServices.length
      ? `Requested Services:
  ${normalizedServices
    .map((item) =>
      typeof item === "string"
        ? `- ${item}`
        : `- ${item?.label || item?.name || item?.code || "Service"}`
    )
    .join("\n")}`
      : ""
  }

  ${inquiryLink ? `View Inquiry: ${inquiryLink}` : ""}

  Click the view page to reply to the customer or contact them directly using the details above.
  `.trim();

  const { data: resendData, error } = await resend.emails.send({
    from: process.env.INQUIRY_EMAIL,
    to,
    reply_to: process.env.SEND_TO_INQUIRY || undefined,
    subject: subject || `New Inquiry ID ${inquiryUuid}`,
    html,
    text,
  });

  if (error) {
    console.error("Resend error:", error);
    throw new Error(error.message || "Failed to send inquiry business email");
  }

  console.log("Inquiry notification email sent to business via Resend!", resendData);

  return resendData;
}