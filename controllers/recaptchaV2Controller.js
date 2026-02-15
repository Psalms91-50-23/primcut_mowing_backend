// controllers/recaptchaV2Controller.js
import fetch from "node-fetch";

/**
 * Verify reCAPTCHA v2 token
 * Expects body: { token: string }
 */
export const verifyRecaptchaV2 = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: "reCAPTCHA token is required" });
    }

    const secret = process.env.RECAPTCHA_V2_SECRET_KEY;
    const response = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`,
      { method: "POST" }
    );

    const data = await response.json();

    if (!data.success) {
      return res.status(400).json({ success: false, message: "reCAPTCHA verification failed", ...data });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Server error during reCAPTCHA verification" });
  }
};
