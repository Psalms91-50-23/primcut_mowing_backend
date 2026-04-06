import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatScheduledDateNZ(value) {
  if (!value) return "To be confirmed";

  const stringValue = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    const [year, month, day] = stringValue.split("-").map(Number);
    const d = new Date(year, month - 1, day);

    if (Number.isNaN(d.getTime())) return "To be confirmed";

    return d.toLocaleDateString("en-NZ", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const d = new Date(stringValue);
  if (Number.isNaN(d.getTime())) return "To be confirmed";

  return d.toLocaleDateString("en-NZ", {
    timeZone: "Pacific/Auckland",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getWindowLabel(windowPreset, windowMins) {
  const presetMap = {
    anytime: "Anytime (9am–5pm)",
    morning: "Morning (9am–12pm)",
    midday: "Midday (12pm–3pm)",
    afternoon: "Afternoon (3pm–5pm)",
    "2hour": "2-hour arrival window",
    "3hour": "3-hour arrival window",
  };

  if (windowPreset && presetMap[windowPreset]) {
    return presetMap[windowPreset];
  }

  if (windowMins && Number(windowMins) > 0) {
    return `${Number(windowMins)} minute arrival window`;
  }

  return "Arrival window to be confirmed";
}

function formatMoney(value) {
  const num = Number(value || 0);
  return `$${num.toFixed(2)}`;
}

function isLawnCareService(service) {
  const haystack = [
    service?.category,
    service?.service_category,
    service?.code,
    service?.label,
    service?.value,
    service?.name,
    service?.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    haystack.includes("lawn") ||
    haystack.includes("mow") ||
    haystack.includes("edging") ||
    haystack.includes("weed") ||
    haystack.includes("garden") ||
    haystack.includes("hedge") ||
    haystack.includes("grass") ||
    haystack.includes("lawn_care")
  );
}

export default async function sendJobScheduleToClient({ to, subject, data }) {
  if (!to) {
    throw new Error("Recipient email is required");
  }

  if (!data) {
    throw new Error("Job schedule email data is required");
  }

  const {
    jobUUID,
    customerName,
    address,
    services = [],
    scheduledAt,
    scheduledWindowMins,
    scheduledWindowPreset,
    customMessage,
    notificationType = "schedule_update",
    hasUrgentFee = false,
    urgentFeeAmount = 0,
    subtotalAmount = 0,
    gstAmount = 0,
    totalAmount = 0,
  } = data;

  const safeCustomerName = escapeHtml(customerName || "there");
  const safeJobUUID = escapeHtml(jobUUID || "-");
  const safeAddress = escapeHtml(address || "Address not provided");
  const safeScheduledDate = escapeHtml(formatScheduledDateNZ(scheduledAt));
  const safeArrivalWindow = escapeHtml(
    getWindowLabel(scheduledWindowPreset, scheduledWindowMins)
  );
  const safeCustomMessage = escapeHtml(customMessage || "");

  const urgentFeeValue = Number(urgentFeeAmount || 0);
  const showUrgentFee = Boolean(hasUrgentFee) && urgentFeeValue > 0;

  const subtotalValue = Number(subtotalAmount || 0);
  const gstValue = Number(gstAmount || 0);
  const totalValue = Number(totalAmount || 0);

  const serviceCostValue = Math.max(
    0,
    subtotalValue - (showUrgentFee ? urgentFeeValue : 0)
  );

  const containsLawnCare = Array.isArray(services) && services.some(isLawnCareService);

  const isRescheduled = notificationType === "rescheduled";
  const headingText = isRescheduled ? "Job Rescheduled" : "Job Schedule Update";
  const introText = isRescheduled
    ? "Your job has been rescheduled. Please review the updated details below."
    : "Your job schedule has now been updated. Please review the details below.";

  const servicesRowsHtml = (services || [])
    .map((service, index) => {
      const label = escapeHtml(service?.label || service?.value || "Service");
      const quantity = Number(service?.quantity || 1);
      const unitPrice = Number(service?.unit_price || 0);
      const rawLineTotal = Number(service?.line_total);
      const lineTotal =
        Number.isFinite(rawLineTotal) && rawLineTotal > 0
          ? rawLineTotal
          : quantity * unitPrice;

      return `
        <tr style="background:${index % 2 === 0 ? "#ffffff" : "#f9fafb"};">
          <td style="padding:10px;border:1px solid #e5e7eb;">${label}</td>
          <td style="padding:10px;border:1px solid #e5e7eb;text-align:center;">${quantity}</td>
          <td style="padding:10px;border:1px solid #e5e7eb;text-align:right;">${escapeHtml(
            formatMoney(lineTotal)
          )}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(headingText)}</title>
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
                            src="${process.env.FRONTEND_URL_HAPPY_PROPERTY}/images/happy-house-1.png"
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
                    <p style="margin-top:0;">Hi ${safeCustomerName},</p>

                    <h2 style="margin:0 0 12px 0; color:#14532d;">${escapeHtml(headingText)}</h2>

                    <p style="line-height:1.6;color:#374151;">
                      ${escapeHtml(introText)}
                    </p>

                    ${
                      safeCustomMessage
                        ? `
                      <div style="margin:20px 0;padding:16px;border-left:4px solid #15803d;background:#f0fdf4;border-radius:8px;">
                        <p style="margin:0 0 8px 0;font-weight:700;color:#14532d;">Message from our team</p>
                        <div style="white-space:pre-line;color:#374151;line-height:1.6;">${safeCustomMessage}</div>
                      </div>
                    `
                        : ""
                    }

                    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                      <tbody>
                        <tr>
                          <td style="padding:8px 10px;font-weight:bold;width:35%;background:#f9fafb;border:1px solid #eee;">Job ID</td>
                          <td style="padding:8px 10px;border:1px solid #eee;">${safeJobUUID}</td>
                        </tr>
                        <tr>
                          <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Customer</td>
                          <td style="padding:8px 10px;border:1px solid #eee;">${safeCustomerName}</td>
                        </tr>
                        <tr>
                          <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Property address</td>
                          <td style="padding:8px 10px;border:1px solid #eee;">${safeAddress}</td>
                        </tr>
                        <tr>
                          <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Scheduled date</td>
                          <td style="padding:8px 10px;border:1px solid #eee;">${safeScheduledDate}</td>
                        </tr>
                        <tr>
                          <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">Arrival window</td>
                          <td style="padding:8px 10px;border:1px solid #eee;">${safeArrivalWindow}</td>
                        </tr>
                      </tbody>
                    </table>

                    <h3 style="margin:24px 0 10px 0;color:#14532d;">Scheduled services</h3>

                    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                      <thead>
                        <tr style="background:#15803d;color:#ffffff;">
                          <th style="padding:10px;border:1px solid #15803d;text-align:left;">Service</th>
                          <th style="padding:10px;border:1px solid #15803d;text-align:center;width:80px;">Qty</th>
                          <th style="padding:10px;border:1px solid #15803d;text-align:right;width:120px;">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${
                          servicesRowsHtml ||
                          `
                          <tr>
                            <td colspan="3" style="padding:12px;border:1px solid #e5e7eb;text-align:center;">
                              No services listed
                            </td>
                          </tr>
                        `
                        }
                      </tbody>
                    </table>

                    <table style="width:100%;border-collapse:collapse;margin-top:10px;">
                      <tbody>

                        ${
                          showUrgentFee
                            ? `
                        <tr>
                          <td style="padding:8px 10px;font-weight:bold;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;">
                            Urgent fee
                          </td>
                          <td style="padding:8px 10px;border:1px solid #fed7aa;text-align:right;color:#9a3412;">
                            ${escapeHtml(formatMoney(urgentFeeValue))}
                          </td>
                        </tr>
                        `
                            : ""
                        }

                        <tr>
                          <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">
                            Subtotal
                          </td>
                          <td style="padding:8px 10px;border:1px solid #eee;text-align:right;">
                            ${escapeHtml(formatMoney(subtotalValue))}
                          </td>
                        </tr>

                        <tr>
                          <td style="padding:8px 10px;font-weight:bold;background:#f9fafb;border:1px solid #eee;">
                            GST (15%)
                          </td>
                          <td style="padding:8px 10px;border:1px solid #eee;text-align:right;">
                            ${escapeHtml(formatMoney(gstValue))}
                          </td>
                        </tr>

                        <tr>
                          <td style="padding:10px 10px;font-weight:bold;background:#14532d;color:#ffffff;border:1px solid #14532d;">
                            Total
                          </td>
                          <td style="padding:10px 10px;font-weight:bold;background:#14532d;color:#ffffff;border:1px solid #14532d;text-align:right;">
                            ${escapeHtml(formatMoney(totalValue))}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    ${
                      containsLawnCare
                        ? `
                      <div style="margin:20px 0;padding:16px;border-left:4px solid #2563eb;background:#eff6ff;border-radius:8px;">
                        <p style="margin:0 0 8px 0;font-weight:700;color:#1d4ed8;">Access and site readiness</p>
                        <div style="color:#374151;line-height:1.6;">
                          To help us complete your lawn care service safely and efficiently, please ensure that pets are secured and that any hazards, obstacles, vehicles, toys, hoses, or other items that may restrict access are removed before our team arrives. If access is obstructed or additional clearing is required on site, extra charges may apply.
                        </div>
                      </div>
                    `
                        : ""
                    }

                    <p style="margin-top:28px;color:#4b5563;line-height:1.6;">
                      If you have any questions, please reply to this email and our team will be happy to help.
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

  const text = `Happy Property

    ${headingText}

    Hi ${customerName || "there"},

    ${introText}

    Job ID: ${jobUUID || "-"}
    Customer: ${customerName || "-"}
    Property address: ${address || "Address not provided"}
    Scheduled date: ${formatScheduledDateNZ(scheduledAt)}
    Arrival window: ${getWindowLabel(scheduledWindowPreset, scheduledWindowMins)}

    Scheduled services:
    ${
      (services || []).length > 0
        ? services
            .map((s) => {
              const quantity = Number(s?.quantity || 1);
              const unitPrice = Number(s?.unit_price || 0);
              const rawLineTotal = Number(s?.line_total);
              const lineTotal =
                Number.isFinite(rawLineTotal) && rawLineTotal > 0
                  ? rawLineTotal
                  : quantity * unitPrice;
              return `- ${s?.label || s?.value || "Service"} x ${quantity} (${formatMoney(lineTotal)})`;
            })
            .join("\n")
        : "- No services listed"
    }

    Service cost: ${formatMoney(serviceCostValue)}
    ${showUrgentFee ? `Urgent fee: ${formatMoney(urgentFeeValue)}` : ""}
    Subtotal: ${formatMoney(subtotalValue)}
    GST: ${formatMoney(gstValue)}
    Total: ${formatMoney(totalValue)}

    ${
      containsLawnCare
        ? `Access and site readiness:
    To help us complete your lawn care service safely and efficiently, please ensure that pets are secured and that any hazards, obstacles, vehicles, toys, hoses, or other items that may restrict access are removed before our team arrives. If access is obstructed or additional clearing is required on site, extra charges may apply.

    `
        : ""
    }${
      customMessage
        ? `Message from our team:
    ${customMessage}

    `
        : ""
    }If you have any questions, please reply to this email and our team will be happy to help.
    `;

  const result = await resend.emails.send({
    from: process.env.NOTIFICAITONS_EMAIL,
    to,
    reply_to: process.env.REPLY_TO_ADMIN,
    subject,
    html,
    text,
  });

  console.log("Job schedule email sent to client via Resend", result);

  return result;
}