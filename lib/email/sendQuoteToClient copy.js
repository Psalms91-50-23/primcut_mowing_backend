export default async function sendClientToQuote({
  to,
  subject,
  data,
}) {
  const { name, subtotal, gst, total, services, images, quoteLink, expiry } = data;

  const servicesHtml = (services || [])
    .map((s) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${s.label}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">$${s.unit_price.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${s.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">$${(s.unit_price * s.quantity).toFixed(2)}</td>
      </tr>
    `)
    .join("");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: auto;">

      <!-- HEADER -->
      <div style="background: #064e3b; padding: 20px 16px; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; color: #fff; font-size: 28px;">PrimCut</h1>
      </div>

      <!-- CONTENT -->
      <div style="background: #fff; padding: 20px 16px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
        <h2 style="color: #1f7a6b;">Your Quote is Ready</h2>

        <p>Hi ${name},</p>
        <p>Your quote is ready and valid until <strong>${expiry}</strong>.</p>

        <h3 style="margin-top: 20px;">Services</h3>

        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 10px; text-align: left;">Service</th>
              <th style="padding: 10px; text-align: left;">Unit Price</th>
              <th style="padding: 10px; text-align: left;">Quantity</th>
              <th style="padding: 10px; text-align: left;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${servicesHtml}
          </tbody>
        </table>

        <div style="margin-top: 20px; font-size: 16px;">
          <p><strong>Subtotal:</strong> $${subtotal.toFixed(2)}</p>
          <p><strong>+ GST (15%):</strong> $${gst.toFixed(2)}</p>
          <p style="font-weight: bold; font-size: 18px;"><strong>Total Amount:</strong> $${total.toFixed(2)}</p>
        </div>

        <div style="margin-top: 30px;">
          <a href="${quoteLink}" style="background: #1f7a6b; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            View & Respond to Quote
          </a>
        </div>

        <p style="margin-top: 20px; font-size: 12px; color: #999;">
          If you have any questions, reply to this email.
        </p>
      </div>
    </div>
  `;

  const text = `
  👋 Hi ${name},

  Your quote is ready and valid until ${expiry}.

  Services
  Service \t Unit Price \t Quantity \t Total
  ${(services || []).map((s) => `${s.label} \t $${s.unit_price.toFixed(2)} \t ${s.quantity} \t $${(s.unit_price * s.quantity).toFixed(2)}`).join("\n")}

  Subtotal: $${subtotal.toFixed(2)}
  + GST (15%): $${gst.toFixed(2)}
  Total Amount: $${total.toFixed(2)}

  View & Respond to Quote: ${quoteLink}

  If you have any questions, reply to this email.
  `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
      text,
    };

    await transporter.sendMail(mailOptions);
}
