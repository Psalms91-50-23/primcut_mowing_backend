// controllers/recaptchaV3Controller.js
import fetch from "node-fetch";

/**
 * Verify reCAPTCHA v3 token
 * Expects body: { token: string, action?: string }
 */

export const verifyRecaptchaV3 = async (req, res) => {
  try {
    const { token, action } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: "reCAPTCHA token is required" });
    }

    const secret = process.env.RECAPTCHA_V3_SECRET_KEY;
    const response = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`,
      { method: "POST" }
    );

    const data = await response.json();
    // Optional: check action
    if (action && data.action !== action) {
      return res.status(400).json({ success: false, error: "reCAPTCHA action mismatch" });
    }

    // Consider score < 0.5 suspicious
    if (!data.success || data.score < 0.5) {
      return res.status(400).json({ success: false, message: "reCAPTCHA verification failed", score: data.score });
    }

    return res.status(200).json({ success: true, score: data.score });

  } catch (err) {
    console.error("reCAPTCHA v3 verification error:", err);
    return res.status(500).json({ success: false, error: "Server error during reCAPTCHA verification" });
  }
};
