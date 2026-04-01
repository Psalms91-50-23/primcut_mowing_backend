import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
    customerEmail,
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

  const safeCustomerName = customerName || "Customer";
  const previousDate = formatDateOnly(previousScheduledAt);
  const previousWindow = buildArrivalWindow(
    previousScheduledAt,
    previousScheduledWindowMins
  );
  const newDate = formatDateOnly(scheduledAt);
  const newWindow = buildArrivalWindow(scheduledAt, scheduledWindowMins);

  const safeSubject =
    subject ||
    `Service Rescheduled - ${jobUUID || recurrenceUUID || recurrenceId || "Job"}`;

  const detailsRows = [
    ...(jobUUID ? [["Job #", jobUUID]] : []),
    ...(recurrenceUUID ? [["Recurrence UUID", recurrenceUUID]] : []),
    ...(recurrenceId ? [["Recurrence ID", String(recurrenceId)]] : []),
    ["Customer", safeCustomerName],
    ...(mobile ? [["Mobile", mobile]] : []),
    ...(customerEmail ? [["Email", customerEmail]] : []),
    ...(address ? [["Address", address]] : []),
    ["Previous scheduled date", previousDate],
    ["Previous arrival window", previousWindow],
    ["New scheduled date", newDate],
    ["New arrival window", newWindow],
    ...(reasonLabel ? [["Reason", reasonLabel]] : []),
    ["Status", "Rescheduled"],
  ]
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 10px;font-weight:bold;width:35%;background:#f9fafb;border:1px solid #eee;vertical-align:top;">
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
      <div style="margin:20px 0;padding:14px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
        <p style="margin:0 0 8px 0;font-weight:bold;color:#166534;">
          Message from our team
        </p>
        <p style="margin:0;white-space:pre-line;color:#1f2937;">
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
          style="display:inline-block;background:#166534;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold;"
        >
          View Updated Schedule
        </a>
      </div>
    `
    : "";

  const html = `
  <div style="background:#f3f4f6;min-height:100%;padding:24px;font-family:Arial,sans-serif;">
    <div style="max-width:760px;margin:24px auto;color:#1f2937;background:#ffffff;">
      <div style="background:#14532D;padding:20px;border-radius:10px 10px 0 0;text-align:center;color:#fff;">
        <h1 style="margin:0;font-weight:bold;font-size:28px;color:#fff;display:flex;align-items:center;justify-content:left;gap:4px;">
          <span style="font-size:36px;">H</span>
          <img
            src="${process.env.FRONTEND_URL_HAPPY_PROPERTY}/images/happy-house-1.png"
            alt="Happy Property Logo"
            style="width:64px;height:64px;margin-left:-2px;"
          />
          <span style="font-size:36px;">ppy Property</span>
        </h1>
      </div>

      <div style="background:#ffffff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;border-top:none;">
        <h2 style="color:#065f46;margin-top:0;font-size:1.5rem;font-weight:bold;">
          Schedule Updated
        </h2>

        <p>
          <span style="font-size:1.5rem;">👋</span> Hi ${safeCustomerName},
        </p>

        <p>
          We wanted to let you know that your scheduled service has been
          <strong> rescheduled</strong>.
        </p>

        <p>
          This can sometimes happen due to weather conditions, site access issues,
          safety concerns, staffing availability, or other operational reasons.
          We appreciate your understanding.
        </p>

        ${customMessageHtml}

        <h3 style="margin-top:24px;padding:1rem 0;font-size:1.2rem;font-weight:bold;">
          Updated Schedule Details
        </h3>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tbody>
            ${detailsRows}
          </tbody>
        </table>

        <h3 style="width:100%;border-collapse:collapse;padding:1rem 0;font-size:1.2rem;font-weight:bold;">
          Services
        </h3>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
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

        <div style="padding:16px;border:1px solid #d1d5db;border-radius:8px;background:#fafafa;margin-bottom:20px;">
          <p style="margin:0 0 8px 0;">
            <strong>New scheduled date:</strong> ${newDate}
          </p>
          <p style="margin:0;">
            <strong>Arrival window:</strong> ${newWindow}
          </p>
        </div>

        ${dashboardLinkHtml}

        <p style="margin-top:24px;font-size:12px;color:#6b7280;">
          If you have any questions, simply reply to this email.
        </p>
      </div>
    </div>
  </div>
  `;

  const text = `
Hi ${safeCustomerName},

We wanted to let you know that your scheduled service has been rescheduled.

This can sometimes happen due to weather conditions, site access issues, safety concerns, staffing availability, or other operational reasons.

${customMessage ? `Message from our team:\n${customMessage}\n` : ""}

${jobUUID ? `Job #: ${jobUUID}\n` : ""}${
    recurrenceUUID ? `Recurrence UUID: ${recurrenceUUID}\n` : ""
  }${recurrenceId ? `Recurrence ID: ${recurrenceId}\n` : ""}${
    mobile ? `Mobile: ${mobile}\n` : ""
  }${customerEmail ? `Email: ${customerEmail}\n` : ""}${
    address ? `Address: ${address}\n` : ""
  }

Previous scheduled date: ${previousDate}
Previous arrival window: ${previousWindow}

New scheduled date: ${newDate}
New arrival window: ${newWindow}

${reasonLabel ? `Reason: ${reasonLabel}\n` : ""}

Services:
${
  (services || []).length > 0
    ? (services || [])
        .map((s) => `- ${s.label || "Service"} x ${Number(s.quantity || 1)}`)
        .join("\n")
    : "- No services listed"
}

${dashboardLink ? `View updated schedule: ${dashboardLink}\n` : ""}

If you have any questions, simply reply to this email.
  `;

  await resend.emails.send({
    from: process.env.EMAIL_USER,
    to,
    reply_to: process.env.REPLY_TO,
    subject: safeSubject,
    html,
    text,
  });

  console.log("Recurrence reschedule email sent to client via Resend!");
}