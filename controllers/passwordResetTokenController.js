import { PasswordResetToken } from "../models/PasswordResetToken.js";
import User from "../models/User.js";
import ChangeLog from "../models/ChangeLog.js";
import { createChangeLogSafe } from "../util/createChangeLogSafe.js";
import { supabase } from "../config/db.js";
import { resetPasswordLink } from "../lib/email/index.js";
import {
  formatFullName,
  verifyRecaptcha,
  generatePrefixedId,
} from "../util/util.js";

/**
 * Safe change log writer
 * Will never break the main request flow if logging fails
 */
export const generateUniqueChangeLogUUID = async () => {
  let uuid;
  let exists;

  do {
    uuid = generatePrefixedId("CL", 7);
    exists = await ChangeLog.findByUUID(uuid);
  } while (exists);

  return uuid;
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
    const isHuman = await verifyRecaptcha(recaptchaToken, recaptchaVersion);

    if (!isHuman) {
      return res.status(400).json({
        error: "Low reCAPTCHA score",
        code: "RECAPTCHA_LOW_SCORE",
      });
    }

    const userData = await User.findByEmail(email);

    // Security best practice: do not reveal whether email exists
    if (!userData) {
      return res.json({ success: true });
    }

    const resetToken = await PasswordResetToken.create({
      authUserId: userData.auth_user_id,
      userUuid: userData.uuid,
      expiresInMinutes: 10,
    });

    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken.token}`;
    console.log({userData});
    await resetPasswordLink({
      to: userData.email,
      name: formatFullName(userData.first_name, undefined, true) || "There",
      resetLink,
      expiryMinutes: 10,
    });

    const changeLogUuid = await generateUniqueChangeLogUUID();

    await createChangeLogSafe({
      uuid: changeLogUuid,
      table_name: "password_resets_tokens",
      record_uuid: resetToken.id,
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
    return res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
};

// 2️⃣ Reset password using token
export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({
      error: "Token and new password are required",
      code: "MISSING_FIELDS",
    });
  }

  try {
    const result = await PasswordResetToken.verify({ token });

    if (!result.ok) {
      const status =
        result.code === "TOKEN_LOOKUP_FAILED" ||
        result.code === "TOKEN_VERIFY_FAILED"
          ? 500
          : 400;

      return res.status(status).json({
        error: result.error,
        code: result.code,
      });
    }

    const tokenData = result.data;

    const { error: updateError } = await supabase().auth.admin.updateUserById(
      tokenData.auth_user_id,
      { password: newPassword }
    );

    if (updateError) throw updateError;

    const usedToken = await PasswordResetToken.consume({ token });

    const changeLogUuid = await generateUniqueChangeLogUUID();

    await createChangeLogSafe({
      uuid: changeLogUuid,
      table_name: "users",
      record_uuid: tokenData.user_uuid,
      user_uuid: tokenData.user_uuid,
      action: "update",
      summary: "User password reset via token.",
      changed_fields: {
        password: {
          old: "[REDACTED]",
          new: "[REDACTED]",
        },
        reset_method: "password_reset_token",
      },
      source: "public_form",
    });

    const tokenLogUuid = await generateUniqueChangeLogUUID();

    await createChangeLogSafe({
      uuid: tokenLogUuid,
      table_name: "password_resets_tokens",
      record_uuid: tokenData.id,
      user_uuid: tokenData.user_uuid,
      action: "update",
      summary: "Password reset token consumed.",
      changed_fields: {
        used_at: {
          old: tokenData.used_at || null,
          new: usedToken?.used_at || null,
        },
        status: "used",
      },
      source: "public_form",
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Error resetting password:", err.message);
    return res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
};

// 3️⃣ Check reset token validity
export const checkResetToken = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      error: "Token is required",
      code: "TOKEN_REQUIRED",
    });
  }

  try {
    const result = await PasswordResetToken.verify({ token });

    if (!result.ok) {
      const status =
        result.code === "TOKEN_LOOKUP_FAILED" ||
        result.code === "TOKEN_VERIFY_FAILED"
          ? 500
          : 400;

      return res.status(status).json({
        error: result.error,
        code: result.code,
      });
    }

    const tokenData = result.data;

    const changeLogUuid = await generateUniqueChangeLogUUID();

    await createChangeLogSafe({
      uuid: changeLogUuid,
      table_name: "password_resets_tokens",
      record_uuid: tokenData.id,
      user_uuid: tokenData.user_uuid || null,
      action: "system_event",
      summary: "Password reset token validated.",
      changed_fields: {
        validation_checked: true,
      },
      source: "public_form",
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Error checking reset token:", err.message);
    return res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
};