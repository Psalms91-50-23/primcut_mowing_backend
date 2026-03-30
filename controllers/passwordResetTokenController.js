import { PasswordResetToken } from "../models/PasswordResetToken.js";
import User from "../models/User.js";
import ChangeLog from "../models/ChangeLog.js";
import supabase from "../config/db.js";
import { resetPasswordLink } from "../lib/email/index.js";
import {
  generateShortId,
  verifyEmailToken,
  generateEmailToken,
  formatFullName,
  verifyRecaptcha,
} from "../util/util.js";
import { createHash } from "crypto";

/**
 * Safe change log writer
 * Will never break the main request flow if logging fails
 */
const createChangeLogSafe = async ({
  table_name,
  record_uuid,
  user_uuid = null,
  action,
  summary = null,
  changed_fields = null,
  source = "public_form",
}) => {
  try {
    await ChangeLog.create({
      table_name,
      record_uuid,
      user_uuid,
      action,
      summary,
      changed_fields,
      source,
    });
  } catch (logErr) {
    console.error("Change log error:", logErr.message);
  }
};

// 1️⃣ Request password reset
export const requestPasswordReset = async (req, res) => {
  const { email, recaptchaToken, recaptchaVersion } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (!recaptchaToken || !recaptchaVersion) {
    return res
      .status(400)
      .json({ error: "reCAPTCHA token and version required" });
  }

  try {
    // Verify reCAPTCHA
    const isHuman = await verifyRecaptcha(recaptchaToken, recaptchaVersion);

    if (!isHuman) {
      return res.status(400).json({ error: "Failed reCAPTCHA verification" });
    }

    // 1. Find user by email using User model
    const userData = await User.findByEmail(email);

    // If user doesn't exist, respond success anyway (security best practice)
    if (!userData) {
      return res.json({ success: true });
    }

    // 2. Create a reset token
    const { token, data } = await PasswordResetToken.create({
      authUserId: userData.auth_user_id,
      userUuid: userData.uuid,
      expiresInMinutes: 10,
    });

    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

    // 3. Send password reset email
    await resetPasswordLink({
      to: userData.email,
      name: formatFullName(userData.first_name, undefined, true) || "There",
      resetLink,
      expiryMinutes: 10,
    });

    // 4. Change log
    await createChangeLogSafe({
      table_name: "password_reset_tokens",
      record_uuid: data?.uuid || String(data?.id || userData.uuid),
      user_uuid: userData.uuid,
      action: "create",
      summary: "Password reset token requested and email sent.",
      changed_fields: {
        user_uuid: userData.uuid,
        auth_user_id: userData.auth_user_id,
        email: userData.email,
        expires_in_minutes: 10,
        token_created: true,
        email_sent: true,
      },
      source: "public_form",
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

  if (!token || !newPassword) {
    return res
      .status(400)
      .json({ error: "Token and new password are required" });
  }

  try {
    // 1. Find the token
    const tokenData = await PasswordResetToken.findOneByToken(token);

    if (!tokenData) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    if (tokenData.message === "Token expired") {
      return res.status(400).json({ error: "Token expired" });
    }

    // 2. Update Supabase auth password for auth_user_id
    const { data: updatedUser, error: updateError } =
      await supabase.auth.admin.updateUserById(tokenData.auth_user_id, {
        password: newPassword,
      });

    if (updateError) throw updateError;

    // 3. Mark token as used
    await PasswordResetToken.markUsed(tokenData.id);

    // 4a. Change log for user password update
    await createChangeLogSafe({
      table_name: "users",
      record_uuid: tokenData.user_uuid,
      user_uuid: tokenData.user_uuid,
      action: "update",
      summary: "User password was reset via password reset token.",
      changed_fields: {
        password: {
          old: "[REDACTED]",
          new: "[REDACTED]",
        },
        reset_method: "password_reset_token",
        auth_user_id: tokenData.auth_user_id,
      },
      source: "public_form",
    });

    // 4b. Change log for token being used
    await createChangeLogSafe({
      table_name: "password_reset_tokens",
      record_uuid: tokenData.uuid || String(tokenData.id),
      user_uuid: tokenData.user_uuid,
      action: "update",
      summary: "Password reset token marked as used.",
      changed_fields: {
        used_at: {
          old: null,
          new: new Date().toISOString(),
        },
        token_status: {
          old: "active",
          new: "used",
        },
      },
      source: "public_form",
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Error resetting password:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const checkResetToken = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    // pass raw token (do NOT hash here)
    const tokenData = await PasswordResetToken.findOneByToken(token);

    if (!tokenData) {
      return res.status(400).json({ error: "Invalid token" });
    }

    if (new Date() > new Date(tokenData.expires_at)) {
      return res.status(400).json({ error: "Token expired" });
    }

    if (tokenData.used_at) {
      return res.status(400).json({ error: "Token already used" });
    }

    // Optional change log:
    // Only keep this if your action enum supports something like "read" or "verify".
    // Otherwise leave it out.
    await createChangeLogSafe({
      table_name: "password_reset_tokens",
      record_uuid: tokenData.uuid || String(tokenData.id),
      user_uuid: tokenData.user_uuid || null,
      action: "update",
      summary: "Password reset token was validated before password reset.",
      changed_fields: {
        token_validation_checked: true,
      },
      source: "public_form",
    });

    return res.json({ success: true, tokenData });
  } catch (err) {
    console.error("Error checking reset token:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};