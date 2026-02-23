// import { Resend } from 'resend';

// const resend = new Resend(process.env.RESEND_API_KEY);

// export default async function sendQuoteToBusiness({
//   quoteUuid,
//   firstName,
//   lastName,
//   mobile,
//   landline,
//   email,
//   message,
//   services = [],
//   images = [],
//   employeeLink,
// }) {
//   console.log("FRONTEND_URL_HAPPY_LAWNS =", process.env.FRONTEND_URL_HAPPY_LAWNS);
//   // ===== SERVICES ROWS =====
//   const servicesRowsHtml = (services || [])
//     .map((service) => {
//       const qty = service.quantity ?? 1;
//       const unit = service.unit_price ?? 0;
//       const lineTotal = qty * unit;

//       return `
//         <tr>
//           <td style="padding: 10px; border-bottom: 1px solid #eee;">${service.label || service.value || "—"}</td>
//           <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${qty}</td>
//           <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">$${unit.toFixed(2)}</td>
//           <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">$${lineTotal.toFixed(2)}</td>
//         </tr>
//       `;
//     })
//     .join("");

//   // ===== IMAGES =====
//   const imagesHtml = (images || [])
//     .map((img) => {
//       const url = img.url || img;
//       return `
//         <td align="left" style="padding:0;">
//           <a href="${url}" target="_blank" style="text-decoration:none;">
//             <img 
//               src="${url}" 
//               width="60" 
//               height="60" 
//               style="display:block; border-radius:6px; border:1px solid #ddd;" 
//               alt="Quote image" 
//             />
//           </a>
//         </td>
//       `;
//     })
//     .join("");
    
//   // ===== HTML BODY =====
//   const htmlContent = `
//     <!DOCTYPE html>
//     <html lang="en">
//     <head><meta charset="UTF-8"><title>New Quote</title></head>
//     <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; color: #1f2937;">
//       <div style="max-width: 720px; margin: auto; background: #fff; border-radius: 10px; overflow: hidden; border: 1px solid #eee;">
//         <div style="background: #14532D; padding: 20px; text-align: center;">
//           <h1 style="margin: 0; font-size: 28px; color: #fff; display: flex; align-items: center; justify-content: center; gap: 8px;">
//             <span style="font-size: 36px;">H</span>
//             <img
//               src="https://${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png"
//               alt="Happy Property Logo"
//               style="width: 56px; height: 56px; display:block;"
//             />
//             <span style="font-size: 36px;">ppy Lawns</span>
//           </h1>
//         </div>

//         <div style="padding: 20px;">
//           <h2 style="margin-top: 0; color: #064e3b;">New Quote Request</h2>
//           <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
//             <tbody>
//               ${[
//                 ["Quote ID", quoteUuid],
//                 ["Customer", `${firstName || ""} ${lastName || ""}`],
//                 ["Mobile", mobile || "—"],
//                 ["Landline", landline || "—"],
//                 ["Email", email || "—"],
//                 ["Message", message || "—"],
//               ].map(([label, value]) => `
//                 <tr>
//                   <td style="padding: 8px 10px; font-weight: bold; width: 35%; background: #f9fafb;">${label}</td>
//                   <td style="padding: 8px 10px;">${value}</td>
//                 </tr>
//               `).join("")}
//             </tbody>
//           </table>

//           <h3 style="margin-bottom: 8px; color: #064e3b;">Requested Services</h3>
//           <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
//             <thead>
//               <tr style="background: #15803D;">
//                 <th style="padding: 10px; text-align: left; color: #ffffff; border-top-left-radius: 6px;">Service</th>
//                 <th style="padding: 10px; text-align: center; color: #ffffff;">Qty</th>
//                 <th style="padding: 10px; text-align: right; color: #ffffff;">Unit</th>
//                 <th style="padding: 10px; text-align: right; color: #ffffff; border-top-right-radius: 6px;">Total</th>
//               </tr>
//             </thead>
//             <tbody>
//               ${servicesRowsHtml || `
//                 <tr>
//                   <td colspan="4" style="padding: 10px; text-align: center;">No services provided</td>
//                 </tr>
//               `}
//             </tbody>
//           </table>

//           ${imagesHtml.length > 0 ? `
//             <h3 style="margin-bottom: 8px; color: #064e3b;">Images</h3>
//             <table style="border-collapse: separate; border-spacing: 10px; margin-bottom: 20px;">
//               <tr>${imagesHtml}</tr>
//             </table>
//           ` : ""}

//           <div style="padding-top: 16px; border-top: 1px solid #eee;">
//             <strong>Manage Quote:</strong><br />
//             <a href="${employeeLink}" style="color: #064e3b; word-break: break-all;">${employeeLink}</a>
//           </div>

//         </div>
//       </div>
//     </body>
//     </html>
//   `;

//   // ===== SEND EMAIL USING RESEND =====
//   await resend.emails.send({
//     from: process.env.EMAIL_USER,        // verified Resend email for live testing
//     to: process.env.SEND_TO,              // your partner or business email
//     reply_to: process.env.REPLY_TO,     // optional, replies go to your Gmail
//     subject: "New Quote Request",
//     html: htmlContent,
//   });

//   console.log("Quote email sent via Resend!");
// }

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  // service: "gmail",
  host: "smtp.gmail.com",
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export default async function sendQuoteToBusiness({
  quoteUuid,
  firstName,
  lastName,
  mobile,
  landline,
  email,
  message,
  services = [],
  images = [],
  employeeLink,
}) {

  // ✅ put verify INSIDE the function and await it
  try {
    await transporter.verify();
    console.log("SMTP connection OK");
  } catch (err) {
    console.error("SMTP connection failed:", err);
    throw err; // optional, but helpful so you can see failures upstream
  }

  // ===== SERVICES ROWS =====
  const servicesRowsHtml = (services || [])
    .map((service) => {
      const qty = service.quantity ?? 1;
      const unit = service.unit_price ?? 0;
      const lineTotal = qty * unit;

      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${service.label || service.value || "—"}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${qty}</td>
          <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">$${unit.toFixed(2)}</td>
          <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">$${lineTotal.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  // ===== IMAGES =====
const imagesHtml = (images || [])
  .map((img) => {
    const url = img.url || img;
    return `
      <td align="left" style="padding:0;">
        <a href="${url}" target="_blank" style="text-decoration:none;">
          <img 
            src="${url}" 
            width="60" 
            height="60" 
            style="display:block; border-radius:6px; border:1px solid #ddd;" 
            alt="Quote image" 
          />
        </a>
      </td>
    `;
  })
  .join("");

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.SEND_TO,
    subject: "New Quote Request",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>New Quote</title>
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; color: #1f2937;">
        <div style="max-width: 720px; margin: auto; background: #fff; border-radius: 10px; overflow: hidden; border: 1px solid #eee;">

          <!-- HEADER -->
          <div style="background: #14532D; padding: 20px; border-radius: 10px 10px 0 0; display: flex; align-items: center; justify-content: space-between;">
            <h1 style="margin: 0; font-weight: bold; font-size: 28px; color: #fff; display: flex; align-items: center; gap: 4px;">
              <span style="font-size: 36px;">H</span>
              <img src="https://${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png"
                alt="Happy Property Logo" style="width: 64px; height: 64px; margin-left: -2px;" />
              <span style="font-size: 36px;">ppy Property</span>
            </h1>
          </div>

          <!-- BODY -->
          <div style="padding: 20px;">

            <h2 style="margin-top: 0; color: #064e3b;">New Quote Request</h2>

            <!-- DETAILS TABLE -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tbody>
                ${[
                  ["Quote ID", quoteUuid],
                  ["Customer", `${firstName || ""} ${lastName || ""}`],
                  ["Mobile", mobile || "—"],
                  ["Landline", landline || "—"],
                  ["Email", email || "—"],
                  ["Message", message || "—"],
                ].map(([label, value]) => `
                  <tr>
                    <td style="padding: 8px 10px; font-weight: bold; width: 35%; background: #f9fafb;">${label}</td>
                    <td style="padding: 8px 10px;">${value}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>

            <!-- SERVICES -->
            <h3 style="margin-bottom: 8px; color: #064e3b;">Requested Services</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background: #15803D;">
                  <th style="padding: 10px; text-align: left; color: #ffffff; border-top-left-radius: 6px;">Service</th>
                  <th style="padding: 10px; text-align: center; color: #ffffff;">Qty</th>
                  <th style="padding: 10px; text-align: right; color: #ffffff;">Unit</th>
                  <th style="padding: 10px; text-align: right; color: #ffffff; border-top-right-radius: 6px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${servicesRowsHtml || `
                  <tr>
                    <td colspan="4" style="padding: 10px; text-align: center;">No services provided</td>
                  </tr>
                `}
              </tbody>
            </table>

            <!-- IMAGES -->
           ${imagesHtml.length > 0 ? `
            <h3 style="margin-bottom: 8px; color: #064e3b;">Images</h3>

            <table 
              style="border-collapse: separate; border-spacing: 10px; margin-bottom: 20px;"
            >
              <tr>
                ${imagesHtml}
              </tr>
            </table>
          ` : ""}

            <!-- ADMIN LINK -->
            <div style="padding-top: 16px; border-top: 1px solid #eee;">
              <strong>Manage Quote:</strong><br />
              <a href="${employeeLink}" style="color: #064e3b; word-break: break-all;">${employeeLink}</a>
            </div>

          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
}