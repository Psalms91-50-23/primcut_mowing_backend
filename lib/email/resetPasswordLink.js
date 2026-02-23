// import { Resend } from "resend";

// const resend = new Resend(process.env.RESEND_API_KEY);

// export default async function resetPasswordLink({
//   to,
//   name,
//   resetLink,
//   expiryMinutes,
// }) {
//   const html = `
//   <div style="font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: auto;">

//     <!-- HEADER -->
//     <div style="background: #064e3b; padding: 20px 16px; border-radius: 10px 10px 0 0;">
//       <h1 style="margin: 0; font-weight: bold; font-size: 28px; color: #fff; display: flex; align-items: center;">
//         <span style="font-size: 36px; margin: 0;">P</span>
//         <img
//           src="https://${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png"
//           alt="Happy Property Logo"
//           style="width: 64px; height: 64px; display: block; margin: 0 8px; padding: 0;"
//         />
//         <span style="font-size: 36px; margin: 0;">rimCut</span>
//       </h1>
//     </div>

//     <!-- CONTENT -->
//     <div style="background: #fff; padding: 20px 16px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
//       <h2 style="color: #1f7a6b;">Reset Your Password</h2>

//       <p>
//         Hi ${name || "There"} 
//         <span style="font-size: 1.5em; line-height: 1; vertical-align: middle; margin-left: 4px;">
//           👋
//         </span>,
//       </p>

//       <p>
//         We received a request to reset your password. Click the button below to choose a new password.
//       </p>

//       <div style="margin: 30px 0;">
//         <a
//           href="${resetLink}"
//           style="
//             background: #1f7a6b;
//             color: white;
//             padding: 14px 22px;
//             border-radius: 8px;
//             text-decoration: none;
//             font-weight: bold;
//             display: inline-block;
//           "
//         >
//           Reset Password
//         </a>
//       </div>

//       <p style="font-size: 14px; color: #555;">
//         This link will expire in <strong>${expiryMinutes}</strong> minutes.
//       </p>

//       <p style="font-size: 14px; color: #555;">
//         If you didn't request a password reset, you can safely ignore this email.
//       </p>

//       <div style="margin-top: 20px; font-size: 12px; color: #999;">
//         <p>
//           If the button doesn't work, copy and paste this link into your browser:
//         </p>
//         <p style="word-break: break-word;">
//           <a href="${resetLink}" style="color: #064e3b;">${resetLink}</a>
//         </p>
//       </div>

//       <p style="margin-top: 30px; font-size: 12px; color: #999;">
//         Thanks,<br/>
//         The PrimCut Team
//       </p>
//     </div>
//   </div>
//   `;

//   const text = `
//   Hi ${name || "there"},

//   We received a request to reset your PrimCut password.

//   Click the link below to reset your password:
//   ${resetLink}

//   This link will expire in ${expiryMinutes} minutes.

//   If you didn't request this, you can ignore this email.

//   Thanks,
//   The Happy Lawns Team
//   `;

//   // ===== SEND EMAIL USING RESEND =====
//   await resend.emails.send({
//     from: process.env.EMAIL_USER,  // Verified Resend sender
//     to,
//     subject: "Reset your Happy Property password",
//     html,
//     text,
//   });

//   console.log("Reset password email sent via Resend!");
// }

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export default async function resetPasswordLink({
  to,
  name,
  resetLink,
  expiryMinutes,
}) {
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: auto;">

      <!-- HEADER -->
      <div style="background: #14532D; padding: 20px; border-radius: 10px 10px 0 0; display: flex; align-items: center; justify-content: space-between;">
      <h1 style="margin: 0; font-weight: bold; font-size: 28px; color: #fff; display: flex; align-items: center; gap: 4px;">
        <span style="font-size: 36px;">H</span>
        <img src="https://${process.env?.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png"
          alt="Happy Logo" style="width: 64px; height: 64px; margin-left: -2px;" />
        <span style="font-size: 36px;">ppy Property</span>
      </h1>
    </div>

      <!-- CONTENT -->
      <div style="background: #fff; padding: 20px 16px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
        <h2 style="color: #1f7a6b;">Reset Your Password</h2>

        <p>
          Hi ${name || "There"} 
          <span style="font-size: 1.5em; line-height: 1; vertical-align: middle; margin-left: 4px;">
            👋
          </span>,
        </p>

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
          The Happy Property's Team
        </p>
      </div>
    </div>
  `;

  const text = `
  Hi ${name || "there"},

  We received a request to reset your Happy Property password.

  Click the link below to reset your password:
  ${resetLink}

  This link will expire in ${expiryMinutes} minutes.

  If you didn't request this, you can ignore this email.

  Thanks,
  The Happy Property Team
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Reset your Happy Property password",
    html,
    text,
  });
};
