import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendTestEmail = async (req, res) => {
  try {
    const { to } = req.body;
    const recipient = to || process.env.SEND_TO;

    const response = await resend.emails.send({
      from: "onboarding@resend.dev",  
      to: recipient,
      subject: "Test Email from Happy Lawns Backend",
      text: "Hello! This is a test email from your backend using Resend.",
      html: `<p>Hello! This is a <strong>test email</strong> from your backend using Resend.</p>
             <img src="${process.env.FRONTEND_URL_HAPPY_PROPERTY}/images/seedream-image.png" alt="Logo" width="64" />`,
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