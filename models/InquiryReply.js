import supabase from "../config/db.js";

export default class InquiryReply {

  static async create(data) {
    
    const {
      uuid,
      inquiry_uuid,
      sender_user_uuid = null,
      recipient_email,
      subject = null,
      message,
      sent_at = new Date().toISOString(),
    } = data;

    const { data: reply, error } = await supabase
      .from("inquiry_replies")
      .insert([
        {
          uuid,
          inquiry_uuid,
          sender_user_uuid,
          recipient_email,
          subject,
          message,
          sent_at,
        },
      ])
      .select("*")
      .single();

    if (error) throw error;
    return reply;
  }

  static async findByUUID(uuid) {
    const { data, error } = await supabase
      .from("inquiry_replies")
      .select("*")
      .eq("uuid", uuid)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  static async findByInquiryUUID(inquiry_uuid) {
    const { data, error } = await supabase
      .from("inquiry_replies")
      .select("*")
      .eq("inquiry_uuid", inquiry_uuid)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data;
  }

  static async deleteByUUID(uuid) {
    const { data, error } = await supabase
      .from("inquiry_replies")
      .delete()
      .eq("uuid", uuid)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

}