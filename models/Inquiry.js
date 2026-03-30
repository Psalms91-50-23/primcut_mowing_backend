import supabase from "../config/db.js";

export default class Inquiry {

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

    const { data: inquiry, error } = await supabase
      .from("inquiries")
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

    const { data, error } = await supabase
      .from("inquiries")
      .select("*")
      .eq("uuid", uuid)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  // static async findByUUID(uuid) {
  //   const { data, error } = await supabase
  //     .from("inquiries")
  //     .select("*")
  //     .eq("uuid", uuid)
  //     .single();

  //   if (error) {
  //     if (error.code === "PGRST116") return null;
  //     throw error;
  //   }

  //   return data;
  // }

  static async getAll() {
    const { data, error } = await supabase
      .from("inquiries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  static async getAllByCustomerUUID(customer_uuid) {
    const { data, error } = await supabase
      .from("inquiries")
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
    return data;
  }

  static async findCustomerInquiryByUUID(customer_uuid, inquiry_uuid) {
    const { data, error } = await supabase
      .from("inquiries")
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

  // static async updateByUUID(uuid, updates) {
  //   const { data, error } = await supabase
  //     .from("inquiries")
  //     .update(updates)
  //     .eq("uuid", uuid)
  //     .select("*")
  //     .single();

  //   if (error) throw error;
  //   return data;
  // }

  static async updateByUUID(uuid, updates) {
    const { data, error } = await supabase
      .from("inquiries")
      .update(updates)
      .eq("uuid", uuid)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  static async deleteByUUID(uuid) {
    const { error } = await supabase
      .from("inquiries")
      .delete()
      .eq("uuid", uuid);

    if (error) throw error;

    return true;
  }
}
