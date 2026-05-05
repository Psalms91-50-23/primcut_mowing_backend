import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
  address,
  recurrenceFrequency,
  subjectHeader,
  has_urgent_fee = false,
}) {

  const capitalize = (str) =>
  str
    ? str
        .toLowerCase()
        .split(" ")
        .map((word) =>
          word
            .split("-")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join("-")
        )
        .join(" ")
    : "";

  const safeFullName =
  `${capitalize(firstName)} ${capitalize(lastName)}`.trim() || "—";

  const servicesRowsHtml = (services || [])
    .map((service) => {
      const qty = Number(service.quantity ?? 1);
      const unit = Number(service.unit_price ?? 0);
      const lineTotal = qty * unit;

      return `
        <tr>
          <td style="padding: 10px; border: 1px solid #d1d5db;">
            ${service.label || service.value || "—"}
          </td>
          <td style="padding: 10px; text-align: center; border: 1px solid #d1d5db;">
            ${qty}
          </td>
          <td style="padding: 10px; text-align: right; border: 1px solid #d1d5db;">
            $${unit.toFixed(2)}
          </td>
          <td style="padding: 10px; text-align: right; border: 1px solid #d1d5db;">
            $${lineTotal.toFixed(2)}
          </td>
        </tr>
      `;
    })
    .join("");

  const imagesHtml = (images || [])
    .map((img) => {
      const url = img?.url || img;

      return `
        <td align="left" style="padding: 0 10px 10px 0;">
          <a href="${url}" target="_blank" style="text-decoration:none;">
            <img
              src="${url}"
              width="60"
              height="60"
              style="display:block; width:60px; height:60px; border-radius:6px; border:1px solid #d1d5db; object-fit:cover;"
              alt="Quote image"
            />
          </a>
        </td>
      `;
    })
    .join("");

  const detailsRowsHtml = [
    ["Quote ID", quoteUuid || "—"],
    ["Customer", safeFullName],
    ["Address", address || "—"],
    ["Mobile", mobile || "—"],
    ["Landline", landline || "—"],
    ["Email", email || "—"],
    ["Recurrence", recurrenceFrequency || "—"],
    ["Urgent Request", has_urgent_fee ? "Yes" : "No"],
    ["Message", message || "—"],
    
  ]
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 10px;font-weight:bold;width:35%;background:#f9fafb;border:1px solid #eee;">
            ${label}
          </td>
          <td style="padding:8px 10px;border:1px solid #eee;">
            ${value}
          </td>
        </tr>
      `
    )
    .join("");

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>New Quote Request</title>
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
                      <td style="vertical-align:middle; color:#ffffff; font-size:27px; font-weight:bold; line-height:1;">
                        H
                      </td>

                      <td style="vertical-align:middle; padding:0 2px;">
                        <img
                          src="${process.env.FRONTEND_URL_HAPPY_PROPERTY}/images/happy-house-1.png"
                          alt="Happy Property Logo"
                          width="44"
                          height="44"
                          style="display:block; width:44px; height:44px;"
                        />
                      </td>

                      <td style="vertical-align:middle; color:#ffffff; font-size:27px; font-weight:bold; line-height:1;">
                        ppy Property
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:16px;">
                  <h2 style="margin:0 0 10px 0; color:#064e3b; font-size:22px; line-height:1.3;">
                    New Quote Request
                  </h2>

                  <table
                    role="presentation"
                    width="100%"
                    cellpadding="0"
                    cellspacing="0"
                    border="0"
                    style="width:100%; border-collapse:collapse; table-layout:fixed; margin-bottom:20px;"
                  >
                    <tbody>
                      ${detailsRowsHtml}
                    </tbody>
                  </table>

                  <h3 style="margin:0 0 15px 0; color:#064e3b; font-size:18px;">
                    Requested Services
                  </h3>

                  <table
                    role="presentation"
                    width="100%"
                    cellpadding="0"
                    cellspacing="0"
                    border="0"
                    style="width:100%; border-collapse:collapse; table-layout:fixed; margin-bottom:20px;"
                  >
                    <thead>
                      <tr>
                        <th style="padding:10px; text-align:left; color:#ffffff; background:#15803D; border:1px solid #15803D;">
                          Service
                        </th>
                        <th style="padding:10px; text-align:center; color:#ffffff; background:#15803D; border:1px solid #15803D;">
                          Qty
                        </th>
                        <th style="padding:10px; text-align:center; color:#ffffff; background:#15803D; border:1px solid #15803D;">
                          Unit
                        </th>
                        <th style="padding:10px; text-align:right; color:#ffffff; background:#15803D; border:1px solid #15803D;">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      ${
                        servicesRowsHtml ||
                        `
                        <tr>
                          <td colspan="4" style="padding:10px; text-align:center; border:1px solid #d1d5db;">
                            No services provided
                          </td>
                        </tr>
                      `
                      }
                    </tbody>
                  </table>

                  ${
                    imagesHtml.length > 0
                      ? `
                    <h3 style="margin:0 0 8px 0; color:#064e3b; font-size:18px;">
                      Images
                    </h3>
                    <table
                      role="presentation"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      style="margin-bottom:20px;"
                    >
                      <tr>
                        ${imagesHtml}
                      </tr>
                    </table>
                  `
                      : ""
                  }

                  <table
                    role="presentation"
                    width="100%"
                    cellpadding="0"
                    cellspacing="0"
                    border="0"
                    style="width:100%; border-top:1px solid #d1d5db;"
                  >
                    <tr>
                      <td style="padding-top:16px; font-size:14px; line-height:1.5;">
                        <strong>Manage Quote:</strong><br />
                        <a
                          href="${employeeLink}"
                          style="color:#064e3b; word-break:break-all; text-decoration:underline;"
                        >
                          ${employeeLink}
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.QUOTES_EMAIL,
      to: process.env.ADMIN_EMAIL,
      reply_to: process.env.ADMIN_EMAIL,
      subject: subjectHeader || `New Quote Request Quote #${quoteUuid} from ${safeFullName}`,
      html: htmlContent,
    });

    if (error) {
      console.error("Resend failed:", error);
      throw new Error(error.message || "Failed to send email via Resend");
    }

    console.log("Quote email sent via Resend!", data);
    return data;
  } catch (err) {
    console.error("Quote email send failed:", err);
    throw err;
  }
}