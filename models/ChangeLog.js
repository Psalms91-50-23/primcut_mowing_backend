import { supabase } from "../config/db.js";

export default class ChangeLog {
  
  static tableName = "change_logs";

  static async create({
    uuid,
    table_name,
    record_uuid,
    user_uuid = null,
    oldData = null,
    newData = null,
    changed_fields = null,
    action,
    summary = null,
    source = "dashboard",
  }) {
    if (!uuid) throw new Error("uuid is required");
    if (!table_name) throw new Error("table_name is required");
    if (!record_uuid) throw new Error("record_uuid is required");
    if (!action) throw new Error("action is required");

    let computedChangedFields = null;

    if (changed_fields && typeof changed_fields === "object") {
      computedChangedFields = changed_fields;
    } else {
      const changedFields = {};
      const oldObj = oldData || {};
      const newObj = newData || {};

      const allKeys = new Set([
        ...Object.keys(oldObj),
        ...Object.keys(newObj),
      ]);

      for (const key of allKeys) {
        const oldValue = oldObj[key] ?? null;
        const newValue = newObj[key] ?? null;

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changedFields[key] = {
            old: oldValue,
            new: newValue,
          };
        }
      }

      computedChangedFields =
        Object.keys(changedFields).length > 0 ? changedFields : null;
    }

    const payload = {
      uuid,
      table_name,
      record_uuid,
      user_uuid,
      action,
      summary,
      source,
      changed_fields: computedChangedFields,
    };

    const { data, error } = await supabase()
      .from(this.tableName)
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      throw new Error(`Error logging change: ${error.message}`);
    }

    return data;
  }

  static async findByUUID(uuid) {
    if (!uuid) {
      throw new Error("Change log uuid is required");
    }

    const { data, error } = await supabase()
      .from(this.tableName)
      .select("*")
      .eq("uuid", uuid)
      .maybeSingle();

    if (error) {
      throw new Error(`Error fetching change log by uuid: ${error.message}`);
    }

    return data || null;
  }

  static async findAll() {
    const { data, error } = await supabase()
      .from(this.tableName)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  static async findByRecord(table, record_uuid) {
    const { data, error } = await supabase()
      .from(this.tableName)
      .select("*")
      .eq("table_name", table)
      .eq("record_uuid", record_uuid)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  static async findByUser(user_uuid) {
    const { data, error } = await supabase()
      .from(this.tableName)
      .select("*")
      .eq("user_uuid", user_uuid)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  static async findByTable(table_name) {
    const { data, error } = await supabase()
      .from(this.tableName)
      .select("*")
      .eq("table_name", table_name)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  static async deleteOlderThan(date) {
    const { data, error } = await supabase()
      .from(this.tableName)
      .delete()
      .lt("created_at", date)
      .select();

    if (error) throw new Error(error.message);
    return data;
  }

  static async hardDeleteByUUID(uuid) {
    if (!uuid) {
      throw new Error("Change log uuid is required");
    }

    const { error } = await supabase()
      .from(this.tableName)
      .delete()
      .eq("uuid", uuid);

    if (error) {
      throw new Error(`Error deleting change log by uuid: ${error.message}`);
    }

    return true;
  }
}