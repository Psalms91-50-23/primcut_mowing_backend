import { supabase } from "../config/db.js"; // your Supabase() client
import crypto from "crypto";

export class PasswordResetToken {
  static table = "password_resets";

  // Create a new reset token
  static async create({ authUserId, userUuid, expiresInMinutes = 30 }) {
    const token = crypto.randomBytes(32).toString("hex"); // plaintext token to send via email
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    const { data, error } = await supabase()
      .from("password_resets_tokens")
      .insert({
        auth_user_id: authUserId,
        user_uuid: userUuid,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .select("*")
      .maybeSingle();

    if (error) throw new Error(`Error creating password reset: ${error.message}`);

    return { ...data, token }; // return plaintext token for sending via email
  }

  // Find an active reset token by the plaintext token
  static async findOneByToken(token) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const { data, error } = await supabase()
      .from("password_resets_tokens")
      .select("*")
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .maybeSingle();

    if (error) throw new Error(`Error fetching password reset token: ${error.message}`);

    if (!data) return null;

    if (new Date(data.expires_at) < new Date()) return { message: "Token expired"}; // expired

    return data;
  }

  // Mark a token as used
  static async markUsed(id) {
    const { data, error } = await supabase()
      .from("password_resets_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(`Error marking password reset used: ${error.message}`);
    return data;
  }

  // Optional helper: find resets by user UUID
  static async findAllByUserUuid(userUuid) {
    const { data, error } = await supabase()
      .from("password_resets_tokens")
      .select("*")
      .eq("user_uuid", userUuid);

    if (error) throw new Error(`Error fetching password resets for user ${userUuid}: ${error.message}`);
    return data;
  }
}
