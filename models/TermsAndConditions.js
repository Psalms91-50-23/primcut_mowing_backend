import supabase from "../config/db.js";

/**
 * TermsAndConditions Model
 *
 * Notes:
 * - uuid is a prefixed public ID (e.g. TCxxxxxxx)
 * - updated_at is NOT set in the model
 * - updated_at is automatically handled by a Postgres trigger
 *
 * Trigger reference:
 * create trigger update_terms_updated_at
 * before update on terms_and_conditions
 * for each row
 * execute function update_updated_at_column();
 * 
 * code below
 * 
 * create or replace function update_updated_at_column()
  returns trigger as $$
  begin
    new.updated_at = now();
    return new;
  end;
  $$ language plpgsql;

  create trigger update_terms_updated_at
  before update on terms_and_conditions
  for each row
  execute function update_updated_at_column();

  used saver version

  drop trigger if exists update_terms_updated_at on public.terms_and_conditions;

  create trigger update_terms_updated_at
  before update on public.terms_and_conditions
  for each row
  execute function update_updated_at_column();

  create or replace function update_updated_at_column()
  returns trigger as $$
  begin
    if row(new.*) is distinct from row(old.*) then
      new.updated_at = now();
    end if;
    return new;
  end;
  $$ language plpgsql;
 */

class TermsAndConditions {
  static tableName = "terms_and_conditions";

  static async create({
    uuid,
    version,
    title,
    content,
    short_summary = null,
    pdf_url = null,
    is_active = false,
  }) {
    const now = new Date().toISOString();

    if (!uuid) {
      throw new Error("Terms and conditions UUID is required");
    }

    const payload = {
      uuid,
      version,
      title,
      content,
      short_summary,
      pdf_url,
      is_active,
      created_at: now,
    };

    const { data, error } = await supabase
      .from(this.tableName)
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      throw new Error(`Error creating terms and conditions: ${error.message}`);
    }

    return data;
  }

  static async findAll() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Error fetching terms and conditions: ${error.message}`);
    }

    return data || [];
  }

  static async findActive() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Error fetching active terms and conditions: ${error.message}`);
    }

    return data || null;
  }

  static async findByUUID(uuid) {
    if (!uuid) {
      throw new Error("Terms and conditions UUID is required");
    }

    const { data, error } = await supabase
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

    const { data, error } = await supabase
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

    if (updates.is_active !== undefined) {
      updatePayload.is_active = updates.is_active;
    }

    // 🔥 Prevent empty updates
    if (Object.keys(updatePayload).length === 0) {
      throw new Error("No valid fields provided for update");
    }

    const { data, error } = await supabase
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

    const { error: clearError } = await supabase
      .from(this.tableName)
      .update({
        is_active: false,
      })
      .eq("is_active", true);

    if (clearError) {
      throw new Error(`Error clearing previous active terms: ${clearError.message}`);
    }

    const { data, error } = await supabase
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

    const { data, error } = await supabase
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