import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function formatName(name) {
  if (!name) return "Customer";

  return name
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map(
      (word) => word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

function formatDateOnly(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "full",
  }).format(d);
}

function buildArrivalWindow(startISO, mins) {
  if (!startISO) return "-";

  const start = new Date(startISO);
  if (Number.isNaN(start.getTime())) return "-";

  const safeMins =
    Number.isInteger(mins) && Number(mins) > 0 ? Number(mins) : 180;

  const end = new Date(start.getTime() + safeMins * 60 * 1000);

  const fmt = new Intl.DateTimeFormat("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export default async function sendJobRecurrenceRescheduledToClient({
  to,
  subject,
  data,
}) {
  if (!data) throw new Error("Reschedule email data is required");

  const {
    jobUUID,
    recurrenceUUID,
    recurrenceId,
    customerName,
    mobile,
    address,
    services = [],
    previousScheduledAt,
    previousScheduledWindowMins,
    scheduledAt,
    scheduledWindowMins,
    customMessage,
    dashboardLink,
    reasonLabel,
  } = data;

  const safeCustomerName = formatName(customerName);
  const safeReasonLabel = reasonLabel || "Schedule updated";
  const isRescheduled = safeReasonLabel.toLowerCase() === "rescheduled";

  const titleText = isRescheduled ? "Service Rescheduled" : "Schedule Updated";
  const introActionText = isRescheduled ? "rescheduled" : "updated";

  const previousDate = formatDateOnly(previousScheduledAt);
  const previousWindow = buildArrivalWindow(
    previousScheduledAt,
    previousScheduledWindowMins
  );
  const newDate = formatDateOnly(scheduledAt);
  const newWindow = buildArrivalWindow(scheduledAt, scheduledWindowMins);

  const safeSubject =
    subject ||
    `${titleText} - ${jobUUID || recurrenceUUID || recurrenceId || "Job"}`;

  const detailsRows = [
    ...(jobUUID ? [["Job #", jobUUID]] : []),
    ...(recurrenceUUID ? [["Recurrence UUID", recurrenceUUID]] : []),
    ...(recurrenceId ? [["Recurrence ID", String(recurrenceId)]] : []),
    ["Customer", safeCustomerName],
    ...(mobile ? [["Mobile", mobile]] : []),
    ...(address ? [["Address", address]] : []),
    ["Previous scheduled date", previousDate],
    ["Previous arrival window", previousWindow],
    ["New scheduled date", newDate],
    ["New arrival window", newWindow],
    ["Update type", safeReasonLabel],
  ]
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 10px;font-weight:bold;width:35%;background:#f9fafb;border:1px solid #eee;">
            ${label}
          </td>
          <td style="padding:8px 10px;border:1px solid #eee;">
            ${value || "-"}
          </td>
        </tr>
      `
    )
    .join("");

  const servicesHtml =
    (services || [])
      .map(
        (s, i) => `
          <tr style="background:${i % 2 === 0 ? "#f0fdf4" : "#dcfce7"};">
            <td style="padding:12px;text-align:left;">${s.label || "Service"}</td>
            <td style="padding:12px;text-align:center;">${Number(s.quantity || 1)}</td>
          </tr>
        `
      )
      .join("") ||
    `
      <tr>
        <td colspan="2" style="padding:12px;text-align:center;">No services listed</td>
      </tr>
    `;

  const customMessageHtml = customMessage
    ? `
      <div style="margin:20px 0;padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
        <p style="margin:0 0 8px 0;font-weight:bold;color:#166534;">
          Message from our team
        </p>
        <p style="margin:0;white-space:pre-line;">
          ${customMessage}
        </p>
      </div>
    `
    : "";

  const dashboardLinkHtml = dashboardLink
    ? `
      <div style="margin-top:24px;">
        <a
          href="${dashboardLink}"
          style="display:inline-block;background:#166534;color:#fff;padding:12px 18px;border-radius:8px;font-weight:bold;text-decoration:none;"
        >
          View Updated Schedule
        </a>
      </div>
    `
    : "";

  const html = `
  <div style="background:#f3f4f6;padding:24px;font-family:Arial,sans-serif;">
    <div style="max-width:760px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;">

      <div style="background:#14532D;padding:20px;text-align:center;color:#fff;">
        <h1 style="margin:0;font-size:26px;font-weight:bold;">
          Happy Property
        </h1>
      </div>

      <div style="padding:28px;">

        <h2 style="color:#065f46;margin-top:0;">
          ${titleText}
        </h2>

        <p>👋 Hi <strong>${safeCustomerName}</strong>,</p>

        <p>
          Just a quick update — your service has been <strong>${introActionText}</strong>.
        </p>

        <p>Please review the updated details below.</p>

        <p style="color:#6b7280;font-size:14px;">
          Changes may occur due to weather, access, safety, or operational needs.
          Thank you for your understanding.
        </p>

        ${customMessageHtml}

        <h3 style="margin-top:24px;">Schedule Details</h3>

        <table style="width:100%;border-collapse:collapse;margin-top:10px;">
          ${detailsRows}
        </table>

        <h3 style="margin-top:24px;">Services</h3>

        <table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <thead>
            <tr style="background:#15803D;color:#fff;">
              <th style="padding:10px;text-align:left;">Service</th>
              <th style="padding:10px;text-align:center;">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${servicesHtml}
          </tbody>
        </table>

        <div style="margin-top:20px;padding:16px;background:#f0fdf4;border-radius:8px;">
          <strong>New Date:</strong> ${newDate}<br/>
          <strong>Arrival Window:</strong> ${newWindow}
        </div>

        ${dashboardLinkHtml}

        <p style="margin-top:24px;">
          If you have any questions, feel free to reply to this email — we're happy to help.
        </p>

        <p style="margin-top:20px;">
          Kind regards,<br/>
          <strong>The Happy Property Team</strong>
        </p>

        <p style="margin-top:20px;font-size:12px;color:#9ca3af;">
          This is an automated service update.
        </p>

      </div>
    </div>
  </div>
  `;

  const text = `
Hi ${safeCustomerName},

Your service has been ${introActionText}.

New date: ${newDate}
Arrival window: ${newWindow}

If you have any questions, just reply to this email.

Kind regards,
The Happy Property Team
`;

  await resend.emails.send({
    from: process.env.NOTIFICAITONS_EMAIL,
    to,
    reply_to: process.env.REPLY_TO_ADMIN,
    subject: safeSubject,
    html,
    text,
  });

  console.log("Recurrence email sent!");
}