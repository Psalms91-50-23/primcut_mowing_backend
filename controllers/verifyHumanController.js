import { RecaptchaEnterpriseServiceClient } from "@google-cloud/recaptcha-enterprise";

// Load service account JSON
const client = new RecaptchaEnterpriseServiceClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS, // path to your JSON key
});

// Your project ID
const projectId = process.env.GOOGLE_CLOUD_PROJECT; // e.g., happy-lawn

/**
 * Verifies if a request is from a human using reCAPTCHA Enterprise
 * @param token - reCAPTCHA token from frontend
 * @param action - the action string used in frontend ('login', 'register', 'reset')
 * @returns boolean - true if human, false otherwise
 */
export const verifyHuman = async (token, action) => {
  if (!token) throw new Error("Missing reCAPTCHA token");

  const request = {
    parent: `projects/${projectId}`,
    assessment: {
      event: {
        token,
        siteKey: process.env.RECAPTCHA_SITE_KEY_SECRET, // frontend Site Key
        expectedAction: action,
      },
    },
  };

  try {
    const [response] = await client.createAssessment(request);

    // Check if token is valid
    if (!response.tokenProperties || !response.tokenProperties.valid) {
      return false;
    }

    // Optional: check action matches
    if (response.tokenProperties.action !== action) return false;

    // Optional: check risk score (0.0 = likely bot, 1.0 = likely human)
    const score = response.riskAnalysis?.score || 0;
    // Treat >=0.5 as human, <0.5 as suspicious
    return score >= 0.5;
  } catch (err) {
    console.error("reCAPTCHA verification error:", err);
    return false;
  }
};
