import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendQuoteToBusiness = async ({
  quoteUuid,
  firstName,
  lastName,
  mobile,
  landline,
  email,
  message,
  services = [],
  images = [],
  adminLink,
}) => {

 const servicesHtml = (services || [])
  .map((service) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">
        ${service.label || service.value || JSON.stringify(service)}
      </td>
    </tr>
  `)
  .join("");

  const imagesHtml = (images || [])
    .map((img) => {
      const url = img.url || img;

      return `
        <div style="padding: 8px;">
          <a href="${url}" target="_blank" style="text-decoration: none;">
            <img
              src="${url}"
              alt="Quote image"
              style="
                width: 100%;
                height: auto;
                max-width: 250px;
                max-height: 250px;
                border-radius: 8px;
                border: 1px solid #ddd;
                display: block;
              "
            />
          </a>
        </div>
      `;
    })
    .join("");

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.SEND_TO,
    subject: "New Quote Request",
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: auto;">

        <!-- HEADER -->
        <div style="background: #064e3b; padding: 20px 16px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; color: #fff; font-size: 28px;">PrimCut</h1>
        </div>

        <!-- CONTENT -->
        <div style="background: #fff; padding: 20px 16px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">

          <h2 style="margin-top: 0; color: #064e3b;">New Quote Request</h2>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tbody>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Quote UUID</td>
                <td style="padding: 8px;">${quoteUuid}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Full Name</td>
                <td style="padding: 8px;">${firstName || ""} ${lastName || ""}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Mobile</td>
                <td style="padding: 8px;">${mobile || "—"}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Landline</td>
                <td style="padding: 8px;">${landline || "—"}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Email</td>
                <td style="padding: 8px;">${email || "—"}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Message</td>
                <td style="padding: 8px;">${message || "—"}</td>
              </tr>
            </tbody>
          </table>

          <h3 style="margin-bottom: 8px;">Services</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tbody>
              ${servicesHtml}
            </tbody>
          </table>

          <h3 style="margin-bottom: 8px;">Images</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            ${imagesHtml}
          </div>

          <div style="margin-top: 20px;">
            <strong>Admin link:</strong>
            <a href="${adminLink}" style="color: #064e3b;">${adminLink}</a>
          </div>

        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};


export const sendClientQuote = async ({
  to,
  subject,
  data,
}) => {
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
          <p><strong>GST (15%):</strong> $${gst.toFixed(2)}</p>
          <p><strong>Total Amount:</strong> $${total.toFixed(2)}</p>
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
  Hi ${name},

  Your quote is ready and valid until ${expiry}.

  Services
  Service \t Unit Price \t Quantity \t Total
  ${(services || []).map((s) => `${s.label} \t $${s.unit_price.toFixed(2)} \t ${s.quantity} \t $${(s.unit_price * s.quantity).toFixed(2)}`).join("\n")}

  Subtotal: $${subtotal.toFixed(2)}
  GST (15%): $${gst.toFixed(2)}
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
};

export const resetPassword = async ({
  to,
  name,
  resetLink,
  expiryMinutes,
}) => {
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: auto;">

      <!-- HEADER -->
      <div style="background: #064e3b; padding: 20px 16px; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; color: #fff; font-size: 28px;">PrimCut</h1>
      </div>

      <!-- CONTENT -->
      <div style="background: #fff; padding: 20px 16px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
        <h2 style="color: #1f7a6b;">Reset Your Password</h2>

        <p>Hi ${name || "there"},</p>

        <p>
          We received a request to reset your password. Click the button below to choose a new password.
        </p>

        <div style="margin: 30px 0;">
          <a
            href="${resetLink}"
            style="
              background: #1f7a6b;
              color: white;
              padding: 14px 22px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: bold;
              display: inline-block;
            "
          >
            Reset Password
          </a>
        </div>

        <p style="font-size: 14px; color: #555;">
          This link will expire in <strong>${expiryMinutes}</strong> minutes.
        </p>

        <p style="font-size: 14px; color: #555;">
          If you didn't request a password reset, you can safely ignore this email.
        </p>

        <div style="margin-top: 20px; font-size: 12px; color: #999;">
          <p>
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="word-break: break-word;">
            <a href="${resetLink}" style="color: #064e3b;">${resetLink}</a>
          </p>
        </div>

        <p style="margin-top: 30px; font-size: 12px; color: #999;">
          Thanks,<br/>
          The PrimCut Team
        </p>
      </div>
    </div>
  `;

  const text = `
  Hi ${name || "there"},

  We received a request to reset your PrimCut password.

  Click the link below to reset your password:
  ${resetLink}

  This link will expire in ${expiryMinutes} minutes.

  If you didn't request this, you can ignore this email.

  Thanks,
  The PrimCut Team
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Reset your PrimCut password",
    html,
    text,
  });
};
