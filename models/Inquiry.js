import { supabase } from "../config/db.js";

export default class Inquiry {
  static tableName = "inquiries";

  static async create(data) {
    const {
      uuid,
      customer_uuid = null,
      first_name,
      last_name = null,
      email,
      phone = null,
      message,
      services = null,
      status = "new",
    } = data;

    const { data: inquiry, error } = await supabase()
      .from(this.tableName)
      .insert([
        {
          uuid,
          customer_uuid,
          first_name,
          last_name,
          email,
          phone,
          message,
          services,
          status,
        },
      ])
      .select("*")
      .single();

    if (error) throw error;
    return inquiry;
  }

  static async findByUUID(uuid) {
    const { data, error } = await supabase()
      .from(this.tableName)
      .select("*")
      .eq("uuid", uuid)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  static async getAll() {
    const { data, error } = await supabase()
      .from(this.tableName)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getPaginated({
    page = 1,
    limit = 10,
    status = null,
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const from = (safePage - 1) * safeLimit;
    const to = from + safeLimit - 1;

    let query = supabase()
      .from(this.tableName)
      .select("*", { count: "exact" });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    return {
      inquiries: data || [],
      total: count || 0,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil((count || 0) / safeLimit),
    };
  }

  static async getAllByCustomerUUID(customer_uuid) {
    const { data, error } = await supabase()
      .from(this.tableName)
      .select(`
        uuid,
        first_name,
        last_name,
        email,
        phone,
        message,
        status,
        created_at,
        updated_at
      `)
      .eq("customer_uuid", customer_uuid)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async findCustomerInquiryByUUID(customer_uuid, inquiry_uuid) {
    const { data, error } = await supabase()
      .from(this.tableName)
      .select(`
        uuid,
        first_name,
        last_name,
        email,
        phone,
        message,
        status,
        created_at,
        updated_at
      `)
      .eq("customer_uuid", customer_uuid)
      .eq("uuid", inquiry_uuid)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return data;
  }

  static async updateByUUID(uuid, updates) {
    const { data, error } = await supabase()
      .from(this.tableName)
      .update(updates)
      .eq("uuid", uuid)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  static async deleteByUUID(uuid) {
    const { data, error } = await supabase()
      .from(this.tableName)
      .delete()
      .eq("uuid", uuid)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }
}