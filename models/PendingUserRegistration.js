import { supabase } from "../config/db.js";

class PendingUserRegistration {
  static async create(payload) {
    const normalizedEmail = payload.email?.trim().toLowerCase();

    const insertPayload = {
      ...payload,
      email: normalizedEmail,
      role: payload.role || "customer",
      is_deleted: false,
      used_at: null,
      verified_at: null,
    };

    const { data, error } = await supabase()
      .from("pending_user_registrations")
      .insert([insertPayload])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async findByUUID(uuid) {
    const { data, error } = await supabase()
      .from("pending_user_registrations")
      .select("*")
      .eq("uuid", uuid)
      .eq("is_deleted", false)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  static async findByTokenHash(tokenHash) {
    const now = new Date().toISOString();

    const { data, error } = await supabase()
      .from("pending_user_registrations")
      .select("*")
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .eq("is_deleted", false)
      .gt("expires_at", now)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  static async findActiveByEmail(email) {
    const normalizedEmail = email?.trim().toLowerCase();
    const now = new Date().toISOString();

    const { data, error } = await supabase()
      .from("pending_user_registrations")
      .select("*")
      .eq("email", normalizedEmail)
      .is("used_at", null)
      .eq("is_deleted", false)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  static async markUsed(uuid) {
    const now = new Date().toISOString();

    const { data, error } = await supabase()
      .from("pending_user_registrations")
      .update({
        verified_at: now,
        used_at: now,
      })
      .eq("uuid", uuid)
      .is("used_at", null)
      .eq("is_deleted", false)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async softDeleteByUUID(uuid) {
    const { data, error } = await supabase()
      .from("pending_user_registrations")
      .update({
        is_deleted: true,
      })
      .eq("uuid", uuid)
      .eq("is_deleted", false)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async deleteExpiredUnused() {
    const now = new Date().toISOString();

    const { data, error } = await supabase()
      .from("pending_user_registrations")
      .update({
        is_deleted: true,
      })
      .lt("expires_at", now)
      .is("used_at", null)
      .eq("is_deleted", false)
      .select();

    if (error) throw new Error(error.message);
    return data || [];
  }
}

export default PendingUserRegistration;
