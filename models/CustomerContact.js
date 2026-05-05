import { supabase } from "../config/db.js";

export default class CustomerContact {
  static tableName = "customer_contacts";

  static async create({
    uuid,
    customer_uuid,
    first_name,
    last_name = null,
    email = null,
    mobile_phone = null,
    landline_phone = null,
    role = null,
    notes = null,
    is_primary = false,
    is_billing_contact = false,
    is_site_contact = false,
    created_by_uuid = null,
  }) {
    const now = new Date().toISOString();

    const payload = {
      uuid,
      customer_uuid,
      first_name,
      last_name,
      email,
      mobile_phone,
      landline_phone,
      role,
      notes,
      is_primary,
      is_billing_contact,
      is_site_contact,
      created_by_uuid,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase()
      .from(this.tableName)
      .insert([payload])
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  static async findContactsByCustomerUUID(customer_uuid) {
    if (!customer_uuid) {
        throw new Error("Customer UUID is required");
      }

    const { data, error } = await supabase()
      .from("customer_contacts")
      .select("*")
      .eq("customer_uuid", customer_uuid)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch customer contacts: ${error.message}`);
    }

    return data || [];
  };

  static async findByUUID(uuid) {
    const { data, error } = await supabase()
      .from(this.tableName)
      .select("*")
      .eq("uuid", uuid)
      .eq("is_deleted", false)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  static async findAllByCustomerUUID(customer_uuid) {
    const { data, error } = await supabase()
      .from(this.tableName)
      .select("*")
      .eq("customer_uuid", customer_uuid)
      .eq("is_deleted", false)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  static async findAllByCustomerUUIDIncDelete(customer_uuid) {
    const { data, error } = await supabase()
      .from(this.tableName)
      .select("*")
      .eq("customer_uuid", customer_uuid)
      // .eq("is_deleted", true)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  static async updateByUUID(uuid, updates = {}) {
    const now = new Date().toISOString();

    const payload = {
      ...updates,
      updated_at: now,
    };

    const { data, error } = await supabase()
      .from(this.tableName)
      .update(payload)
      .eq("uuid", uuid)
      .eq("is_deleted", false)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  static async softDeleteByUUID(uuid) {
    const now = new Date().toISOString();

    const { data, error, count } = await supabase()
      .from(this.tableName)
      .update({
        is_deleted: true,
        deleted_at: now,
        updated_at: now,
      }, { count: "exact" })
      .eq("uuid", uuid)
      .eq("is_deleted", false)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!count || count < 1 || !data) {
      return {
        success: false,
        contact: null,
        count: count || 0,
        error: "No non-deleted customer contact was updated",
      };
    }

    return {
      success: true,
      contact: data,
      count,
      error: null,
    };
  }

  static async clearPrimaryForCustomer(customer_uuid, exclude_uuid = null) {
    let query = supabase()
      .from(this.tableName)
      .update({
        is_primary: false,
        updated_at: new Date().toISOString(),
      })
      .eq("customer_uuid", customer_uuid)
      .eq("is_deleted", false);

    if (exclude_uuid) {
      query = query.neq("uuid", exclude_uuid);
    }

    const { error } = await query;

    if (error) throw new Error(error.message);
    return true;
  }
}