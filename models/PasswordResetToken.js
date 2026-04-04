import { supabase } from "../config/db.js";
import crypto from "crypto";

export class PasswordResetToken {
  static table = "password_resets_tokens";

  /**
   * Create a new password reset token
   */
  static async create({ authUserId, userUuid, expiresInMinutes = 30 }) {
    try {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const expiresAt = new Date(
        Date.now() + expiresInMinutes * 60 * 1000
      ).toISOString();

      const { data, error } = await supabase()
        .from(this.table)
        .insert({
          auth_user_id: authUserId,
          user_uuid: userUuid,
          token_hash: tokenHash,
          expires_at: expiresAt,
        })
        .select("*")
        .maybeSingle();

      if (error) {
        console.error("Create reset token error:", error.message);
        throw new Error("Failed to create password reset token");
      }

      return {
        ...data,
        token, // plaintext token (ONLY returned here for email)
      };
    } catch (err) {
      console.error("PasswordResetToken.create failed:", err.message);
      throw err;
    }
  }

  /**
   * Verify token (without consuming it yet)
   */
  static async verify({ token }) {
    try {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const { data, error } = await supabase()
        .from(this.table)
        .select("*")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (error) {
        console.error("Verify token error:", error.message);
        return {
          ok: false,
          code: "TOKEN_LOOKUP_FAILED",
          error: "Could not verify token",
          data: null,
        };
      }

      if (!data) {
        return {
          ok: false,
          code: "TOKEN_INVALID",
          error: "Invalid token",
          data: null,
        };
      }

      if (data.used_at) {
        return {
          ok: false,
          code: "TOKEN_USED",
          error: "Token already used",
          data: null,
        };
      }

      if (new Date(data.expires_at) < new Date()) {
        return {
          ok: false,
          code: "TOKEN_EXPIRED",
          error: "Token expired",
          data: null,
        };
      }

      return {
        ok: true,
        code: "TOKEN_VALID",
        error: null,
        data,
      };
    } catch (err) {
      console.error("PasswordResetToken.verify failed:", err.message);
      return {
        ok: false,
        code: "TOKEN_VERIFY_FAILED",
        error: "Could not verify token",
        data: null,
      };
    }
  }

  /**
   * Consume token (mark as used)
   */
  static async consume({ token }) {
    try {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const existing = await this.verify({ token });

      if (!existing?.ok || !existing.data) {
        return null;
      }

      const { data, error } = await supabase()
        .from(this.table)
        .update({
          used_at: new Date().toISOString(),
        })
        .eq("token_hash", tokenHash)
        .is("used_at", null) // prevent double-use race condition
        .select("*")
        .maybeSingle();

      if (error) {
        console.error("Consume token error:", error.message);
        return null;
      }

      return data;
    } catch (err) {
      console.error("PasswordResetToken.consume failed:", err.message);
      return null;
    }
  }

  /**
   * Delete token manually (optional cleanup)
   */
  static async deleteByToken({ token }) {
    try {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const { error } = await supabase()
        .from(this.table)
        .delete()
        .eq("token_hash", tokenHash);

      if (error) {
        console.error("Delete token error:", error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error("PasswordResetToken.delete failed:", err.message);
      return false;
    }
  }

  /**
   * Cleanup expired tokens (can run via cron)
   */
  static async cleanupExpired() {
    try {
      const now = new Date().toISOString();

      const { error } = await supabase()
        .from(this.table)
        .delete()
        .lt("expires_at", now);

      if (error) {
        console.error("Cleanup expired tokens error:", error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error("PasswordResetToken.cleanupExpired failed:", err.message);
      return false;
    }
  }
}