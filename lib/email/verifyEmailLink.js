// import { Resend } from "resend";

// const resend = new Resend(process.env.RESEND_API_KEY);

// export default async function verifyEmailLink({
//   to,
//   name,
//   verifyLink,
//   expiryMinutes,
// }) {
//   const html = `
//   <div style="font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: auto;">

//     <!-- HEADER -->
//     <div style="background: #064e3b; padding: 20px 16px; border-radius: 10px 10px 0 0; display: flex; align-items: center;">
//       <h1 style="margin: 0; font-weight: bold; font-size: 28px; color: #fff; display: flex; align-items: center;">
//         <span style="font-size: 36px; margin: 0;">H</span>
//         <img
//           src="https://${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png"
//           alt="Happy Property Logo"
//           style="width: 64px; height: 64px; display: block; margin: 0 8px;"
//         />
//         <span style="font-size: 36px; margin: 0;">appy Property</span>
//       </h1>
//     </div>

//     <!-- CONTENT -->
//     <div style="background: #fff; padding: 20px 16px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">

//       <h2 style="color: #1f7a6b;">Set Up Your Account</h2>

//       <p>Hi ${name || "there"},</p>

//       <p>
//         You've been invited to create an account with <strong>Happy Property</strong>.
//         To complete your registration and set your password, please click the button below.
//       </p>

//       <div style="margin: 30px 0;">
//         <a
//           href="${verifyLink}"
//           style="
//             background: #1f7a6b;
//             color: white;
//             padding: 14px 22px;
//             border-radius: 8px;
//             text-decoration: none;
//             font-weight: bold;
//             display:inline-block; 
//             min-width:200px; 
//             text-align:center;
//           "
//         >
//           Set Up Your Account
//         </a>
//       </div>

//       <p style="font-size: 14px; color: #555;">
//         This link will expire in <strong>${expiryMinutes}</strong> minutes.
//       </p>

//       <p style="font-size:12px;color:#888;">
//         If the button doesn't work, copy and paste this link into your browser:
//       </p>

//       <p style="font-size:12px;word-break:break-all;">
//         ${verifyLink}
//       </p>

//       <p style="font-size: 12px; color: #999; margin-top: 30px;">
//         If you were not expecting this email, you can safely ignore it.
//       </p>

//     </div>
//   </div>
//   `;

//   const text = `
//   Hi ${name || "there"},

//   You've been invited to create an account with Happy Property.

//   To complete your registration and set your password, click the link below:

//   ${verifyLink}

//   This link will expire in ${expiryMinutes} minutes.

//   If you were not expecting this email, you can safely ignore this message.
//   `;

//   await resend.emails.send({
//     from: process.env.EMAIL_USER,
//     to,
//     subject: "Complete your Happy Property account setup",
//     html,
//     text,
//   });

//   console.log("Registration email sent via Resend!");
// }
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function prettifyRole(role) {
  if (!role) return null;
  const r = role.toLowerCase();

  if (r === "admin") return "Administrator";
  if (r === "owner") return "Owner";
  if (r === "employee") return "Employee";
  if (r === "customer") return "Customer";

  return role;
}

export default async function verifyEmailLink({
  to,
  name,
  verifyLink,
  expiryMinutes,
  role = null,
  invitedBy = null,
}) {

  const prettyRole = prettifyRole(role);

  const html = `
  <div style="font-family: Arial, sans-serif; color:#333; max-width:700px; margin:auto;">

    <!-- HEADER -->
    <div style="background:#064e3b;padding:20px 16px;border-radius:10px 10px 0 0;display:flex;align-items:center;">
      <h1 style="margin:0;font-weight:bold;font-size:28px;color:#fff;display:flex;align-items:center;">
        <span style="font-size:36px;margin:0;">H</span>
        <img
          src="${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/happy-house-1.png"
          alt="Happy Property Logo"
          style="width:64px;height:64px;display:block;margin:0 0 0 2px;"
        />
        <span style="font-size:36px;margin:0;">ppy Property</span>
      </h1>
    </div>

    <!-- CONTENT -->
    <div style="background:#fff;padding:22px 18px;border-radius:0 0 10px 10px;border:1px solid #eee;border-top:none;">

      <h2 style="color:#1f7a6b;margin-top:0;">Complete Your Account Setup</h2>

      <p>Hi ${name || "there"},</p>

      ${
        prettyRole
          ? `<p>You have been invited to join <strong>Happy Property</strong> as a <strong>${prettyRole}</strong>.</p>`
          : `<p>You've requested to create an account with <strong>Happy Property</strong>.</p>`
      }

      ${
        invitedBy
          ? `<p>This invitation was sent by <strong>${invitedBy}</strong>.</p>`
          : ""
      }

      <p>
        To verify your email and finish setting up your account, please click the button below.
      </p>

      <div style="margin:30px 0;text-align:center;">
        <a
          href="${verifyLink}"
          style="
            background:#1f7a6b;
            color:white;
            padding:14px 22px;
            border-radius:8px;
            text-decoration:none;
            font-weight:bold;
            display:inline-block;
            min-width:220px;
            text-align:center;
            font-size:16px;
          "
        >
          Verify Email & Set Password
        </a>
      </div>

      <p style="font-size:14px;color:#555;">
        This link will expire in <strong>${expiryMinutes}</strong> minutes.
      </p>

      <p style="font-size:12px;color:#888;">
        If the button above doesn't work, copy and paste this link into your browser:
      </p>

      <p style="font-size:12px;word-break:break-all;">
        ${verifyLink}
      </p>

      <p style="font-size:12px;color:#999;margin-top:30px;">
        If you were not expecting this email, you can safely ignore it.
      </p>

    </div>
  </div>
  `;

  const text = `
Hi ${name || "there"},

${
  prettyRole
    ? `You have been invited to join Happy Property as a ${prettyRole}.`
    : `You've requested to create an account with Happy Property.`
}

${invitedBy ? `Invitation sent by: ${invitedBy}` : ""}

To verify your email and complete your account setup, open the link below:

${verifyLink}

This link will expire in ${expiryMinutes} minutes.

If you were not expecting this email, you can safely ignore this message.

Happy Property
`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: prettyRole
      ? `You're invited to join Happy Property`
      : `Verify your Happy Property account`,
    html,
    text,
  });
}
