import { supabase } from '../config/db.js';

class TermsAndConditions {
  static tableName = "terms_and_conditions";

  static async create({
    uuid,
    version,
    title,
    content,
    short_summary = null,
    effective_date = null,
    pdf_url = null,
    pdf_storage_path = null,
    is_active = false,
  }) {
    const now = new Date().toISOString();

    if (!uuid) {
      throw new Error("Terms and conditions UUID is required");
    }

    if (!version) {
      throw new Error("Version is required");
    }

    if (!title) {
      throw new Error("Title is required");
    }

    if (!content) {
      throw new Error("Content is required");
    }

    const payload = {
      uuid,
      version,
      title,
      content,
      short_summary,
      pdf_url,
      pdf_storage_path,
      is_active,
      created_at: now,
    };

    if (effective_date) {
      payload.effective_date = effective_date;
    }

    const { data, error } = await supabase()
      .from(this.tableName)
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      throw new Error(`Error creating terms and conditions: ${error.message}`);
    }

    return data;
  }
  
  static async findActive() {

    const { data, error } = await supabase()
      .from(this.tableName)
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(`Error fetching active terms and conditions: ${error.message}`);
    }

    return data?.[0] || null;
  }

  static async findAll() {
    const { data, error } = await supabase()
      .from(this.tableName)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Error fetching terms and conditions: ${error.message}`);
    }

    return data || [];
  }

  static async findByUUID(uuid) {
    if (!uuid) {
      throw new Error("Terms and conditions UUID is required");
    }

    const { data, error } = await supabase()
      .from(this.tableName)
      .select("*")
      .eq("uuid", uuid)
      .maybeSingle();

    if (error) {
      throw new Error(`Error fetching terms and conditions by UUID: ${error.message}`);
    }

    return data || null;
  }

  static async findByVersion(version) {
    if (!version) {
      throw new Error("Version is required");
    }

    const { data, error } = await supabase()
      .from(this.tableName)
      .select("*")
      .eq("version", version)
      .maybeSingle();

    if (error) {
      throw new Error(`Error fetching terms and conditions by version: ${error.message}`);
    }

    return data || null;
  }

  static async updateByUUID(uuid, updates = {}) {
    if (!uuid) {
      throw new Error("Terms and conditions UUID is required");
    }

    const updatePayload = {};

    if (updates.version !== undefined) {
      updatePayload.version = updates.version;
    }

    if (updates.title !== undefined) {
      updatePayload.title = updates.title;
    }

    if (updates.content !== undefined) {
      updatePayload.content = updates.content;
    }

    if (updates.short_summary !== undefined) {
      updatePayload.short_summary = updates.short_summary;
    }

    if (updates.pdf_url !== undefined) {
      updatePayload.pdf_url = updates.pdf_url;
    }

    if (updates.pdf_storage_path !== undefined) {
      updatePayload.pdf_storage_path = updates.pdf_storage_path;
    }

    if (updates.is_active !== undefined) {
      updatePayload.is_active = updates.is_active;
    }

    if (Object.keys(updatePayload).length === 0) {
      throw new Error("No valid fields provided for update");
    }

    const { data, error } = await supabase()
      .from(this.tableName)
      .update(updatePayload)
      .eq("uuid", uuid)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Error updating terms and conditions: ${error.message}`);
    }

    return data;
  }

  static async setActiveByUUID(uuid) {
    if (!uuid) {
      throw new Error("Terms and conditions UUID is required");
    }

    const existing = await this.findByUUID(uuid);
    if (!existing) {
      throw new Error("Terms and conditions not found");
    }

    const { error: clearError } = await supabase()
      .from(this.tableName)
      .update({
        is_active: false,
      })
      .eq("is_active", true);

    if (clearError) {
      throw new Error(`Error clearing previous active terms: ${clearError.message}`);
    }

    const { data, error } = await supabase()
      .from(this.tableName)
      .update({
        is_active: true,
      })
      .eq("uuid", uuid)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Error setting active terms and conditions: ${error.message}`);
    }

    return data;
  }

  static async deleteByUUID(uuid) {
    if (!uuid) {
      throw new Error("Terms and conditions UUID is required");
    }

    const existing = await this.findByUUID(uuid);
    if (!existing) {
      return null;
    }

    const { data, error } = await supabase()
      .from(this.tableName)
      .delete()
      .eq("uuid", uuid)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(`Error deleting terms and conditions: ${error.message}`);
    }

    return data || existing;
  }
}

export default TermsAndConditions;