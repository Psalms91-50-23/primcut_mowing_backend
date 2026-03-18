// import { Resend } from "resend";

// const resend = new Resend(process.env.RESEND_API_KEY);

// function formatDateOnly(value) {
//   if (!value) return "Not scheduled";

//   const d = new Date(value);
//   if (Number.isNaN(d.getTime())) return "Not scheduled";

//   return new Intl.DateTimeFormat("en-NZ", {
//     dateStyle: "full",
//   }).format(d);
// }

// function formatTime(value) {
//   if (!value) return "";

//   const d = new Date(value);
//   if (Number.isNaN(d.getTime())) return "";

//   return new Intl.DateTimeFormat("en-NZ", {
//     hour: "numeric",
//     minute: "2-digit",
//   }).format(d);
// }

// function addMinutes(dateLike, mins) {
//   const d = new Date(dateLike);
//   if (Number.isNaN(d.getTime())) return null;
//   return new Date(d.getTime() + Number(mins || 0) * 60000);
// }

// function buildArrivalWindow(startISO, windowMins) {
//   if (!startISO || !windowMins) return "Not scheduled";

//   const start = new Date(startISO);
//   if (Number.isNaN(start.getTime())) return "Not scheduled";

//   const end = addMinutes(startISO, windowMins);
//   if (!end) return "Not scheduled";

//   return `${formatTime(startISO)} – ${formatTime(end)}`;
// }

// export default async function sendJobScheduleToClient({
//   to,
//   subject,
//   data,
// }) {
//   if (!data) throw new Error("Schedule email data is required");

//   const {
//     jobUUID,
//     recurrenceId,
//     customerName,
//     customerEmail,
//     mobile,
//     address,
//     services = [],
//     scheduledAt,
//     scheduledWindowMins,
//     customMessage,
//     isRecurring,
//     recurrenceLabel,
//     dashboardLink,
//   } = data;

//   const scheduledDate = formatDateOnly(scheduledAt);
//   const arrivalWindow = buildArrivalWindow(scheduledAt, scheduledWindowMins);

//   const servicesHtml = (services || [])
//     .map(
//       (s, i) => `
//         <tr style="background:${i % 2 === 0 ? "#f0fdf4" : "#dcfce7"};">
//           <td style="padding:12px;text-align:left;">${s.label || "Service"}</td>
//           <td style="padding:12px;text-align:center;">${Number(s.quantity || 1)}</td>
//         </tr>
//       `
//     )
//     .join("");

//   const recurrenceText = isRecurring
//     ? recurrenceLabel || "Recurring service"
//     : "One-off service";

//   const html = `
//   <!DOCTYPE html>
//   <html lang="en">
//   <body style="font-family:Arial,sans-serif;max-width:700px;margin:auto;color:#1f2937;background:#f9fafb;">
//     <div style="background:#14532D;padding:20px;text-align:center;">
//       <h1 style="margin:0;font-size:28px;color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;">
//         <span style="font-size:36px;">H</span>
//         <img
//           src="https://${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png"
//           alt="Happy Property Logo"
//           style="width:56px;height:56px;display:block;"
//         />
//         <span style="font-size:36px;">ppy Property</span>
//       </h1>
//     </div>

//     <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;">
//       <h2 style="color:#065f46;margin-top:0;">Your Job Schedule Has Been Updated</h2>

//       <p><span style="font-size:1.5rem;">👋</span> Hi ${customerName || "there"},</p>

//       <p>
//         We’ve scheduled your job and this is the latest expected arrival window.
//       </p>

//       ${
//         customMessage
//           ? `
//         <div style="margin:20px 0;padding:16px;border-left:4px solid #15803D;background:#f0fdf4;border-radius:6px;">
//           <p style="margin:0;font-weight:600;color:#14532d;">Message from our team</p>
//           <p style="margin-top:8px;color:#374151;white-space:pre-line;">
//             ${customMessage}
//           </p>
//         </div>
//       `
//           : ""
//       }

//       <table style="width:100%;border-collapse:collapse;margin:20px 0;">
//         <tbody>
//           <tr>
//             <td style="padding:8px 10px;font-weight:bold;width:35%;background:#f9fafb;border:1px solid #eee;">Job ID</td>
//             <td style="padding:8px 10px;border:1px solid #eee;">${jobUUID || "-"}</td>
//           </tr>
//           ${
//             recurrenceId
//               ? `
//             <tr>
//               <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Recurrence</td>
//               <td style="padding:8px 10px;border:1px solid #eee;">#${recurrenceId}</td>
//             </tr>
//           `
//               : ""
//           }
//           <tr>
//             <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Customer</td>
//             <td style="padding:8px 10px;border:1px solid #eee;">${customerName || "-"}</td>
//           </tr>
//           <tr>
//             <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Email</td>
//             <td style="padding:8px 10px;border:1px solid #eee;">${customerEmail || "-"}</td>
//           </tr>
//           ${
//             mobile
//               ? `
//             <tr>
//               <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Mobile</td>
//               <td style="padding:8px 10px;border:1px solid #eee;">${mobile}</td>
//             </tr>
//           `
//               : ""
//           }
//           <tr>
//             <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Address</td>
//             <td style="padding:8px 10px;border:1px solid #eee;">${address || "-"}</td>
//           </tr>
//           <tr>
//             <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Service Type</td>
//             <td style="padding:8px 10px;border:1px solid #eee;">${recurrenceText}</td>
//           </tr>
//           <tr>
//             <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Scheduled Date</td>
//             <td style="padding:8px 10px;border:1px solid #eee;">${scheduledDate}</td>
//           </tr>
//           <tr>
//             <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Arrival Window</td>
//             <td style="padding:8px 10px;border:1px solid #eee;">${arrivalWindow}</td>
//           </tr>
//         </tbody>
//       </table>

//       <h3 style="margin-bottom:10px;">Services</h3>
//       <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
//         <thead>
//           <tr style="background:#15803D;color:#fff;">
//             <th style="padding:10px;text-align:left;">Service</th>
//             <th style="padding:10px;text-align:center;">Qty</th>
//           </tr>
//         </thead>
//         <tbody>
//           ${
//             servicesHtml ||
//             `<tr><td colspan="2" style="padding:12px;text-align:center;">No services listed</td></tr>`
//           }
//         </tbody>
//       </table>

//       <div style="padding:16px;border:1px solid #d1d5db;border-radius:8px;background:#fafafa;margin-bottom:20px;">
//         <p style="margin:0 0 8px 0;">
//           <strong>Scheduled date:</strong> ${scheduledDate}
//         </p>
//         <p style="margin:0;">
//           <strong>Arrival window:</strong> ${arrivalWindow}
//         </p>
//       </div>

//       ${
//         dashboardLink
//           ? `
//         <p style="padding:10px 0;">
//           <a href="${dashboardLink}"
//             style="background:#10b981;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;">
//             View Job
//           </a>
//         </p>
//       `
//           : ""
//       }

//       <p style="margin-top:24px;color:#4b5563;">
//         Please contact us if you need to discuss access, timing, or any changes.
//       </p>
//     </div>
//   </body>
//   </html>
//   `;

//   const text = `
// Happy Property

// Your job schedule has been updated.

// Hi ${customerName || "there"},

// We’ve scheduled your job and this is the latest expected arrival window.

// Scheduled date: ${scheduledDate}
// Arrival window: ${arrivalWindow}

// ${customMessage ? `Message from our team:\n${customMessage}\n` : ""}

// Job ID: ${jobUUID || "-"}
// ${recurrenceId ? `Recurrence: #${recurrenceId}\n` : ""}Customer: ${customerName || "-"}
// Email: ${customerEmail || "-"}
// ${mobile ? `Mobile: ${mobile}\n` : ""}Address: ${address || "-"}
// Service Type: ${recurrenceText}

// ${
//   (services || []).length > 0
//     ? `Services:\n${(services || [])
//         .map((s) => `- ${s.label || "Service"} x ${Number(s.quantity || 1)}`)
//         .join("\n")}\n`
//     : "Services:\n- No services listed\n"
// }

// ${dashboardLink ? `View Job: ${dashboardLink}\n` : ""}

// Please contact us if you need to discuss access, timing, or any changes.
// `;

//   await resend.emails.send({
//     from: process.env.EMAIL_USER,
//     to,
//     reply_to: process.env.REPLY_TO,
//     subject,
//     html,
//     text,
//   });

//   console.log("Job schedule email sent to client via Resend");
// }

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function formatDateOnly(value) {
  if (!value) return "Not scheduled";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Not scheduled";

  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "full",
  }).format(d);
}

function formatTime(value) {
  if (!value) return "";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function addMinutes(dateLike, mins) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + Number(mins || 0) * 60000);
}

function buildArrivalWindow(startISO, windowMins) {
  if (!startISO || !windowMins) return "Not scheduled";

  const start = new Date(startISO);
  if (Number.isNaN(start.getTime())) return "Not scheduled";

  const end = addMinutes(startISO, windowMins);
  if (!end) return "Not scheduled";

  return `${formatTime(startISO)} – ${formatTime(end)}`;
}

export default async function sendJobScheduleToClient({
  to,
  subject,
  data,
}) {
  if (!data) throw new Error("Schedule email data is required");

  const {
    jobUUID,
    recurrenceId,
    customerName,
    customerEmail,
    mobile,
    address,
    services = [],
    scheduledAt,
    scheduledWindowMins,
    customMessage,
    isRecurring,
    recurrenceLabel,
    dashboardLink,
  } = data;

  const scheduledDate = formatDateOnly(scheduledAt);
  const arrivalWindow = buildArrivalWindow(scheduledAt, scheduledWindowMins);

  const servicesHtml = (services || [])
    .map(
      (s, i) => `
        <tr style="background:${i % 2 === 0 ? "#f0fdf4" : "#dcfce7"};">
          <td style="padding:12px;text-align:left;">${s.label || "Service"}</td>
          <td style="padding:12px;text-align:center;">${Number(s.quantity || 1)}</td>
        </tr>
      `
    )
    .join("");

  const recurrenceText = isRecurring
    ? recurrenceLabel || "Recurring service"
    : "One-off service";

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <body style="font-family:Arial,sans-serif;max-width:700px;margin:auto;color:#1f2937;background:#f9fafb;">
    <div style="background:#14532D;padding:20px;text-align:center;">
      <h1 style="margin:0;font-size:28px;color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;">
        <span style="font-size:36px;">H</span>
        <img
          src="https://${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png"
          alt="Happy Property Logo"
          style="width:56px;height:56px;display:block;"
        />
        <span style="font-size:36px;">ppy Property</span>
      </h1>
    </div>

    <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;">
      <h2 style="color:#065f46;margin-top:0;">Your Job Schedule Has Been Updated</h2>

      <p><span style="font-size:1.5rem;">👋</span> Hi ${customerName || "there"},</p>

      <p>
        We’ve scheduled your job and this is the latest expected arrival window.
      </p>

      ${
        customMessage
          ? `
        <div style="margin:20px 0;padding:16px;border-left:4px solid #15803D;background:#f0fdf4;border-radius:6px;">
          <p style="margin:0;font-weight:600;color:#14532d;">Message from our team</p>
          <p style="margin-top:8px;color:#374151;white-space:pre-line;">
            ${customMessage}
          </p>
        </div>
      `
          : ""
      }

      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tbody>
          <tr>
            <td style="padding:8px 10px;font-weight:bold;width:35%;background:#f9fafb;border:1px solid #eee;">Job ID</td>
            <td style="padding:8px 10px;border:1px solid #eee;">${jobUUID || "-"}</td>
          </tr>
          ${
            recurrenceId
              ? `
            <tr>
              <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Recurrence</td>
              <td style="padding:8px 10px;border:1px solid #eee;">#${recurrenceId}</td>
            </tr>
          `
              : ""
          }
          <tr>
            <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Customer</td>
            <td style="padding:8px 10px;border:1px solid #eee;">${customerName || "-"}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Email</td>
            <td style="padding:8px 10px;border:1px solid #eee;">${customerEmail || "-"}</td>
          </tr>
          ${
            mobile
              ? `
            <tr>
              <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Mobile</td>
              <td style="padding:8px 10px;border:1px solid #eee;">${mobile}</td>
            </tr>
          `
              : ""
          }
          <tr>
            <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Address</td>
            <td style="padding:8px 10px;border:1px solid #eee;">${address || "-"}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Service Type</td>
            <td style="padding:8px 10px;border:1px solid #eee;">${recurrenceText}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Scheduled Date</td>
            <td style="padding:8px 10px;border:1px solid #eee;">${scheduledDate}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Arrival Window</td>
            <td style="padding:8px 10px;border:1px solid #eee;">${arrivalWindow}</td>
          </tr>
        </tbody>
      </table>

      <h3 style="margin-bottom:10px;">Services</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
          <tr style="background:#15803D;color:#fff;">
            <th style="padding:10px;text-align:left;">Service</th>
            <th style="padding:10px;text-align:center;">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${
            servicesHtml ||
            `<tr><td colspan="2" style="padding:12px;text-align:center;">No services listed</td></tr>`
          }
        </tbody>
      </table>

      <div style="padding:16px;border:1px solid #d1d5db;border-radius:8px;background:#fafafa;margin-bottom:20px;">
        <p style="margin:0 0 8px 0;">
          <strong>Scheduled date:</strong> ${scheduledDate}
        </p>
        <p style="margin:0;">
          <strong>Arrival window:</strong> ${arrivalWindow}
        </p>
      </div>

      ${
        dashboardLink
          ? `
        <p style="padding:10px 0;">
          <a href="${dashboardLink}"
            style="background:#10b981;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;">
            View Job
          </a>
        </p>
      `
          : ""
      }

      <p style="margin-top:24px;color:#4b5563;">
        Please contact us if you need to discuss access, timing, or any changes.
      </p>
    </div>
  </body>
  </html>
  `;

  const text = `
Happy Property

Your job schedule has been updated.

Hi ${customerName || "there"},

We’ve scheduled your job and this is the latest expected arrival window.

Scheduled date: ${scheduledDate}
Arrival window: ${arrivalWindow}

${customMessage ? `Message from our team:\n${customMessage}\n` : ""}

Job ID: ${jobUUID || "-"}
${recurrenceId ? `Recurrence: #${recurrenceId}\n` : ""}Customer: ${customerName || "-"}
Email: ${customerEmail || "-"}
${mobile ? `Mobile: ${mobile}\n` : ""}Address: ${address || "-"}
Service Type: ${recurrenceText}

${
  (services || []).length > 0
    ? `Services:\n${(services || [])
        .map((s) => `- ${s.label || "Service"} x ${Number(s.quantity || 1)}`)
        .join("\n")}\n`
    : "Services:\n- No services listed\n"
}

${dashboardLink ? `View Job: ${dashboardLink}\n` : ""}

Please contact us if you need to discuss access, timing, or any changes.
`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    replyTo: process.env.REPLY_TO,
    subject,
    html,
    text,
  });

  console.log("Job schedule email sent to client via Nodemailer");
}