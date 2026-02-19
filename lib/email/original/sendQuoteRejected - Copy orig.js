import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export default async function sendQuoteRejected({ to, quote }) {
  const {
    uuid,
    contact_first_name,
    contact_last_name,
    contact_email,
    contact_mobile,
    contact_landline,
    services = [],
    responded_at,
  } = quote;

  const name = `${contact_first_name} ${contact_last_name}`;

  const detailsRows = [
    ["Quote #", uuid],
    ["Customer", name],
    ...(contact_mobile ? [["Mobile", contact_mobile]] : []),
    ...(contact_landline ? [["Landline", contact_landline]] : []),
    ["Email", contact_email],
    ["Status", "Rejected"],
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

  const servicesHtml = (services || [])
    .map(
      (s, i) => `
      <tr style="background: ${i % 2 === 0 ? "#f0fdf4" : "#dcfce7"};">
        <td style="padding: 12px; text-align: left;">${s.label}</td>
        <td style="padding: 12px;" colspan="3">Details hidden</td>
      </tr>
    `
    )
    .join("");

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 700px; margin: auto; color: #1f2937;">
    <!-- HEADER -->
    <div style="background: #14532D; padding: 20px; border-radius: 10px 10px 0 0;">
      <h1 style="margin:0; font-weight:bold; font-size:28px; color:#fff; display:flex; align-items:center; gap:4px;">
        <span style="font-size:36px;">H</span>
        <img src="https://${process.env?.FRONTEND_URL_HAPPY_LAWNS}/images/seedream-image.png" alt="Happy Lawns" style="width:64px;height:64px;" />
        <span style="font-size:36px;">ppy Lawns</span>
      </h1>
    </div>

    <!-- BODY -->
    <div style="background: #ffffff; padding: 24px; border-radius: 0 0 10px 10px; border:1px solid #e5e7eb; border-top:none;">
      <h2 style="color: #B91C1C; margin-top:0;">Quote Rejected ❌</h2>
      <p><span style="font-size:1.5rem">👋</span> Hi ${name},</p>
      <p>Your quote has been rejected. If you’d like a revised quote, please contact us.</p>

      <!-- QUOTE DETAILS -->
      <h3 style="margin-top:24px; color:#B91C1C;">Quote Details</h3>
      <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        <tbody>
          ${detailsRows}
        </tbody>
      </table>

      <!-- SERVICES -->
      <h3 style="margin-top:24px; color:#B91C1C;">Services (Details Hidden)</h3>
      <table style="width:100%; border-collapse:collapse; margin-top:8px;">
        <tbody>
          ${servicesHtml || `<tr><td colspan="4" style="padding:12px;text-align:center;">No services provided</td></tr>`}
        </tbody>
      </table>

      <p style="margin-top:24px; font-size:12px; color:#6b7280;">If you have any questions, simply reply to this email.</p>
    </div>
  </div>
  `;

  const text = `
Hi ${name},

Your quote #${uuid} has been rejected ❌

Services details are hidden.

Responded at: ${responded_at ? new Date(responded_at).toLocaleString() : "-"}

If you have any questions, reply to this email.
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: `Quote ID ${uuid} Rejected ❌`,
    html,
    text,
  });
}
