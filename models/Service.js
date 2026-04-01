import { supabase } from "../config/db.js";

class Service {
  static tableName = "services";

  static async getAllActive() {
    const { data, error } = await supabase()
      .from(this.tableName)
      .select(
        "uuid, code, label, description, category, requires_images, urgent_allowed"
      )
      .eq("is_active", true)
      .eq("is_deleted", false)
      .order("category", { ascending: true })
      .order("label", { ascending: true });

    if (error) {
      throw new Error(`Error fetching services: ${error.message}`);
    }

    return data || [];
  }

  static async getAllCategory() {
    const { data, error } = await supabase()
      .from(this.tableName)
      .select("category")
      .eq("is_active", true)
      .eq("is_deleted", false)
      .order("category", { ascending: true })
      .order("label", { ascending: true });

    if (error) {
      throw new Error(`Error fetching services: ${error.message}`);
    }

    return data || [];
  }

  static async getByUUID(uuid) {
    if (!uuid) throw new Error("uuid is required");

    const { data, error } = await supabase()
      .from(this.tableName)
      .select(
        "uuid, code, label, description, category, requires_images, urgent_allowed, is_active, is_deleted, created_at, updated_at"
      )
      .eq("uuid", uuid)
      .single();

    if (error) {
      throw new Error(`Error fetching service: ${error.message}`);
    }

    return data;
  }

  static async getByCode(code) {
    if (!code) throw new Error("code is required");

    const { data, error } = await supabase()
      .from(this.tableName)
      .select(
        "uuid, code, label, description, category, requires_images, urgent_allowed, is_active, is_deleted, created_at, updated_at"
      )
      .eq("code", code)
      .single();

    if (error) {
      throw new Error(`Error fetching service by code: ${error.message}`);
    }

    return data;
  }
}

export default Service;