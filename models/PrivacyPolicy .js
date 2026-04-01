import supabase from "../config/db.js";
import { generatePrefixedId } from "../util/util.js";

export default class PrivacyPolicy {

  static async create({
    version,
    title,
    content,
    short_summary = null,
    pdf_url = null,
    pdf_storage_path = null,
    effective_date = null,
    is_active = false,
  }) {
    const safeVersion = version?.trim();
    const safeTitle = title?.trim();
    const safeContent = content?.trim();

    if (!safeVersion) {
      throw new Error("Version is required");
    }

    if (!safeTitle) {
      throw new Error("Title is required");
    }

    if (!safeContent) {
      throw new Error("Content is required");
    }

    const uuid = generatePrefixedId("PRIV");

    if (is_active) {
      const { error: deactivateError } = await supabase
        .from("privacy_policies")
        .update({ is_active: false })
        .eq("is_active", true);

      if (deactivateError) {
        throw new Error(deactivateError.message || "Failed to deactivate existing active privacy policy");
      }
    }

    const payload = {
      uuid,
      version: safeVersion,
      title: safeTitle,
      content: safeContent,
      short_summary: short_summary?.trim() || null,
      pdf_url: pdf_url?.trim() || null,
      pdf_storage_path: pdf_storage_path?.trim() || null,
      effective_date: effective_date || null,
      is_active: Boolean(is_active),
    };

    const { data, error } = await supabase
      .from("privacy_policies")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message || "Failed to create privacy policy");
    }

    return data;
  }

  static async findActive() {
    const { data, error } = await supabase
        .from("privacy_policies")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || "Failed to fetch active privacy policy");
    }

    return data;
    }

  static async findLatest() {
    const { data, error } = await supabase
      .from("privacy_policies")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to fetch latest privacy policy");
    }

    return data;
  }

  static async findByUUID(uuid) {
    if (!uuid) return null;

    const { data, error } = await supabase
      .from("privacy_policies")
      .select("*")
      .eq("uuid", uuid)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to fetch privacy policy");
    }

    return data;
  }

  static async findByVersion(version) {
    if (!version) return null;

    const { data, error } = await supabase
      .from("privacy_policies")
      .select("*")
      .eq("version", version)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to fetch privacy policy by version");
    }

    return data;
  }

  static async getAllVersions() {
    const { data, error } = await supabase
      .from("privacy_policies")
      .select("version, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message || "Failed to fetch privacy policy versions");
    }

    return Array.isArray(data) ? data.map((row) => row.version) : [];
  }

  static async listAll() {
    const { data, error } = await supabase
      .from("privacy_policies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message || "Failed to fetch privacy policies");
    }

    return data || [];
  }

  static async setActive(uuid) {
    if (!uuid) {
      throw new Error("Privacy policy UUID is required");
    }

    const existing = await this.findByUUID(uuid);

    if (!existing) {
      throw new Error("Privacy policy not found");
    }

    const { error: deactivateError } = await supabase
      .from("privacy_policies")
      .update({ is_active: false })
      .eq("is_active", true);

    if (deactivateError) {
      throw new Error(deactivateError.message || "Failed to deactivate current active privacy policy");
    }

    const { data, error } = await supabase
      .from("privacy_policies")
      .update({ is_active: true })
      .eq("uuid", uuid)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message || "Failed to activate privacy policy");
    }

    return data;
  }
}
