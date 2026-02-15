import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export default async function sendInviteLink({
  to,
  firstName,
  lastName,
  inviteLink,
  expiryHours = 24,
}) {
  const fullName = `${firstName || ""} ${lastName || ""}`.trim() || "there";

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: "You're invited to Happy Lawns!",
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: auto;">

        <!-- HEADER -->
        <div style="background: #14532D; padding: 20px 16px; border-radius: 10px 10px 0 0; display: flex; align-items: center;">
          <h1 style="margin: 0; font-weight: bold; font-size: 28px; color: #fff; display: flex; align-items: center;">
            <span style="font-size: 36px; margin: 0;">P</span>
            <img
              src="https://${process.env.FRONTEND_URL}/images/seedream-image.png"
              alt="Happy Lawns Logo"
              style="
                width: 64px;
                height: 64px;
                display: block;
                margin: 0 8px;
                padding: 0;
              "
            />
            <span style="font-size: 36px; margin: 0;">rimCut</span>
          </h1>
        </div>

        <!-- CONTENT -->
        <div style="background: #fff; padding: 20px 16px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">

          <h2 style="margin-top: 0; color: #064e3b;">You're invited!</h2>

          <p>
            Hi ${fullName} 👋,
          </p>

          <p>
            You've been invited to join <strong>PrimCut</strong>. Click the button below to set your password and access your account.
          </p>

          <div style="margin: 30px 0; text-align: center;">
            <a
              href="${inviteLink}"
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
              Set Your Password
            </a>
          </div>

          <p style="font-size: 14px; color: #555;">
            This link will expire in <strong>${expiryHours} hours</strong>.
          </p>

          <p style="font-size: 14px; color: #555;">
            If you weren't expecting this invite, you can ignore this email.
          </p>

          <div style="margin-top: 20px; font-size: 12px; color: #999;">
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-word;">
              <a href="${inviteLink}" style="color: #064e3b;">${inviteLink}</a>
            </p>
          </div>

          <p style="margin-top: 30px; font-size: 12px; color: #999;">
            Thanks,<br/>
            The Happy Lawns Team
          </p>
        </div>
      </div>
    `,
    text: `
    Hi ${fullName},

    You've been invited to join Happy Lawns.

    Click the link below to set your password and access your account:
    ${inviteLink}

    This link will expire in ${expiryHours} hours.

    If you weren't expecting this invite, you can ignore this email.

    Thanks,
    The Happy Lawns Team
        `,
    };

    await transporter.sendMail(mailOptions);
}
