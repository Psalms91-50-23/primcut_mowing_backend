import { PasswordResetToken } from "../models/PasswordResetToken.js";
import User from "../models/User.js";
import ChangeLog from "../models/ChangeLog.js";
import supabase from "../config/db.js";
import { resetPasswordLink } from "../lib/email/index.js";
import { generatePrefixedId, verifyEmailToken, generateEmailToken, formatFullName, verifyRecaptcha } from '../util/util.js';
import { createHash } from "crypto";

// 1️⃣ Request password reset
export const requestPasswordReset = async (req, res) => {
   const { email, recaptchaToken, recaptchaVersion } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
    if (!recaptchaToken || !recaptchaVersion)
    return res.status(400).json({ error: "reCAPTCHA token and version required" });

  try {
    // Verify reCAPTCHA
    const isHuman = await verifyRecaptcha(recaptchaToken, recaptchaVersion);
    console.log({isHuman})
    if (!isHuman) return res.status(400).json({ error: "Failed reCAPTCHA verification" });
    console.log("passed is human check")
    // 1. Find user by email using User model
    const userData = await User.findByEmail(email);

    // If user doesn't exist, respond success anyway (security best practice)
    if (!userData) return res.json({ success: true });

    // 2. Create a reset token
    const { token, data } = await PasswordResetToken.create({
      authUserId: userData.auth_user_id,
      userUuid: userData.uuid,
      expiresInMinutes: 10, // default 30 min expiry
    });

    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

    // 3. Send password reset email
    await resetPasswordLink({
      to: userData.email,
      name: formatFullName(userData.first_name, undefined, true) || "There",
      resetLink,
      expiryMinutes: 10,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Error requesting password reset:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// 2️⃣ Reset password using token
export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ error: "Token and new password are required" });

  try {
    // 1. Find the token
    const tokenData = await PasswordResetToken.findOneByToken(token);

    if (!tokenData) return res.status(400).json({ error: "Invalid or expired token" });
    if (tokenData.message === "Token expired")
      return res.status(400).json({ error: "Token expired" });

    // 2. Update Supabase auth password for auth_user_id
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      tokenData.auth_user_id,
      { password: newPassword }
    );

    if (updateError) throw updateError;
    console.log({updatedUser})
    // 3. Mark token as used
    await PasswordResetToken.markUsed(tokenData.id);

    return res.json({ success: true });
  } catch (err) {
    console.error("Error resetting password:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const checkResetToken = async (req, res) => {
  const { token } = req.body;

  if (!token) return res.status(400).json({ error: "Token is required" });

  try {
    // pass raw token (do NOT hash here)
    const tokenData = await PasswordResetToken.findOneByToken(token);

    if (!tokenData) return res.status(400).json({ error: "Invalid token" });

    if (new Date() > new Date(tokenData.expires_at)) {
      return res.status(400).json({ error: "Token expired" });
    }

    if (tokenData.used_at) return res.status(400).json({ error: "Token already used" });

    return res.json({ success: true, tokenData });
  } catch (err) {
    console.error("Error checking reset token:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
