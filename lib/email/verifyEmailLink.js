import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function verifyEmailLink({
  to,
  name,
  verifyLink,
  expiryMinutes,
}) {
  const html = `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: auto;">

    <!-- HEADER -->
    <div style="background: #064e3b; padding: 20px 16px; border-radius: 10px 10px 0 0; display: flex; align-items: center;">
      <h1 style="margin: 0; font-weight: bold; font-size: 28px; color: #fff; display: flex; align-items: center;">
        <span style="font-size: 36px; margin: 0 4px 0 0; transform: translateX(2px);">H</span>
        <span style="margin: 0 4px;">
          <img src="https://yourdomain.com/images/seedream-image.png" alt="Happy Logo" style="width: 64px; height: 64px; vertical-align: middle; margin-left: 4px;" />
        </span>
        <span style="font-size: 36px; margin: 0 4px;">ppy Lawns</span>
      </h1>
    </div>
    
    <!-- CONTENT -->
    <div style="background: #fff; padding: 20px 16px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
      <h2 style="color: #1f7a6b;">Verify Your Email</h2>

      <p>Hi ${name || "there"},</p>

      <p>
        Thanks for creating an account with <strong>PrimCut</strong>.
        Please confirm your email address to activate your account.
      </p>

      <div style="margin: 30px 0;">
        <a
          href="${verifyLink}"
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
          Verify Email Address
        </a>
      </div>

      <p style="font-size: 14px; color: #555;">
        This link will expire in <strong>${expiryMinutes}</strong> minutes.
      </p>

      <p style="font-size: 12px; color: #999; margin-top: 30px;">
        If you did not create this account, you can safely ignore this email.
      </p>
    </div>
  </div>
  `;

  const text = `
Hi ${name || "there"},

Thanks for creating an account with PrimCut.

Please verify your email address by clicking the link below:
${verifyLink}

This link will expire in ${expiryMinutes} minutes.

If you did not create this account, you can safely ignore this email.
  `;

  // ===== SEND EMAIL USING RESEND =====
  await resend.emails.send({
    from: process.env.EMAIL_USER,   // Verified Resend sender
    to,
    subject: "Verify your email address",
    html,
    text,
  });

  console.log("Verification email sent via Resend!");
}
