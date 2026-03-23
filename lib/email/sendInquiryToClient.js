import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function sendInquiryToClient({
  to,
  subject,
  data
}) {
  if (!data) throw new Error("Inquiry email data is required");

  const {
    inquiryUUID,
    firstName,
    lastName,
    email,
    phone,
    message,
    service = [],
    created_at
  } = data;

  const name =
    [firstName, lastName].filter(Boolean).join(" ") || "Valued Customer";

  const services = Array.isArray(service)
    ? service
    : service
    ? [service]
    : [];

  // ===============================
  // Details Table
  // ===============================
  const detailsRows = [
    ["Inquiry ID", inquiryUUID],
    ["Customer", name],
    ...(phone ? [["Phone", phone]] : []),
    ["Email", email],
    ...(created_at ? [["Submitted", created_at]] : []),
    ...(message ? [["Message", message]] : [])
  ]
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:8px 10px;font-weight:bold;width:35%;background:#f9fafb;border:1px solid #eee;">
          ${label}
        </td>
        <td style="padding:8px 10px;border:1px solid #eee;">
          ${value ?? "-"}
        </td>
      </tr>
    `
    )
    .join("");

  // ===============================
  // Services HTML
  // ===============================
  const servicesHtml = services.length
    ? services
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

  // ===============================
  // HTML Email Template
  // ===============================
  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <body style="font-family:Arial,sans-serif;max-width:700px;margin:auto;color:#1f2937;">

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
      <h2 style="color:#065f46;margin-top:0;">We Received Your Inquiry</h2>
      <p><span style="font-size:1.5rem">👋</span> Hi ${name},</p>

      <p>
        Thanks for contacting <strong>Happy Property</strong>. We’ve received your inquiry
        and will review it as soon as possible.
      </p>

      <p>
        A member of our team will get back to you shortly. If your request is urgent,
        feel free to reply directly to this email.
      </p>

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

      <div style="margin-top:24px;">
        <p style="margin-bottom:0;">Kind regards,</p>
        <p style="margin-top:6px;font-weight:bold;color:#14532d;">
          Happy Property
        </p>
      </div>
    </div>
  </body>
  </html>
  `;

  // ===============================
  // Plain Text
  // ===============================
  const text = `
    Hi ${name},

    Thanks for contacting Happy Property. We’ve received your inquiry and will review it as soon as possible.

    Inquiry ID: ${inquiryUUID}
    ${phone ? `Phone: ${phone}` : ""}
    Email: ${email}
    ${created_at ? `Submitted: ${created_at}` : ""}
    ${message ? `Message: ${message}` : ""}

    ${
    services.length
        ? `Requested Services:
    ${services
    .map((item) =>
        typeof item === "string"
        ? `- ${item}`
        : `- ${item?.label || item?.name || item?.code || "Service"}`
    )
    .join("\n")}`
        : ""
    }

    If your request is urgent, feel free to reply directly to this email.

    Kind regards,
    Happy Property
    `.trim();

    await resend.emails.send({
        from: process.env.INQUIRY_EMAIL,
        to,
        reply_to: process.env.INQUIRY_EMAIL,
        subject,
        html,
        text
    });

  console.log("Inquiry confirmation email sent to client via Resend!");
}