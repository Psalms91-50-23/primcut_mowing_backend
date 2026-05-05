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
          src="${process.env.FRONTEND_URL_HAPPY_PROPERTY}/images/happy-house-1.png"
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