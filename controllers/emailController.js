import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// export const sendTestEmail = async (req, res) => {
//     try {
//          console.log("FRONTEND_URL_HAPPY_LAWNS =", process.env.FRONTEND_URL_HAPPY_LAWNS);
//       console.log("send email test")
//     const { to } = req.body;

//     if (!to) {
//       return res.status(400).json({ error: "Recipient email (to) is required" });
//     }

//     const response = await resend.emails.send({
//       from: "onboarding@resend.dev",  // must be verified in Resend
//       to,
//       subject: "Test Email from Happy Lawns Backend",
//       text: "Hello! This is a test email from your backend using Resend.",
//       html: "<p>Hello! This is a <strong>test email</strong> from your backend using Resend.</p>",
//     });

//     console.log("Test email sent:", response);
//     return res.status(200).json({ message: "Test email sent successfully", response });
//   } catch (error) {
//     console.error("Error sending test email:", error);
//     return res.status(500).json({ error: "Failed to send test email", details: error.message });
//   }
// };

export const sendTestEmail = async (req, res) => {
  try {
    const { to } = req.body;
    const recipient = to || process.env.SEND_TO; // fallback to verified email

    console.log("Sending test email to:", recipient);
    console.log("FRONTEND_HAPPY_LAWNS =", process.env.FRONTEND_URL_HAPPY_LAWNS);

    const response = await resend.emails.send({
      from: "onboarding@resend.dev",  // must be verified
      to: recipient,
      subject: "Test Email from Happy Lawns Backend",
      text: "Hello! This is a test email from your backend using Resend.",
      html: `<p>Hello! This is a <strong>test email</strong> from your backend using Resend.</p>
             <img src="https://${process.env.FRONTEND_URL_HAPPY_LAWNS}/images/seedream-image.png" alt="Logo" width="64" />`,
    });

    console.log("Test email sent:", response);
    return res.status(200).json({ message: "Test email sent successfully", response });
  } catch (error) {
    console.error("Error sending test email:", error);

    // Always return JSON — prevents unhandled exceptions from killing Railway
    return res.status(error.statusCode || 500).json({
      message: "Failed to send test email",
      details: error.message,
      name: error.name,
    });
  }
};