import { supabase } from "../config/db.js";

export default class PrivacyPolicyAcceptance {

  static async create(payload) {
    if (!payload) {
      throw new Error("Acceptance payload is required");
    }

    const acceptance = {
      uuid: payload.uuid,
      privacy_policy_uuid: payload.privacy_policy_uuid,
      version: payload.version,
      inquiry_uuid: payload.inquiry_uuid || null,
      quote_uuid: payload.quote_uuid || null,
      acceptance_source: payload.acceptance_source,
      accepted_at: payload.accepted_at || new Date().toISOString(),
      ip_address: payload.ip_address || null,
      user_agent: payload.user_agent || null,
      created_at: payload.created_at || new Date().toISOString(),
    };

    if (!acceptance.uuid) {
      throw new Error("uuid is required");
    }

    if (!acceptance.privacy_policy_uuid) {
      throw new Error("privacy_policy_uuid is required");
    }

    if (!acceptance.version) {
      throw new Error("version is required");
    }

    if (!acceptance.acceptance_source) {
      throw new Error("acceptance_source is required");
    }

    const hasInquiry = !!acceptance.inquiry_uuid;
    const hasQuote = !!acceptance.quote_uuid;

    if ((hasInquiry && hasQuote) || (!hasInquiry && !hasQuote)) {
      throw new Error(
        "Exactly one of inquiry_uuid or quote_uuid must be provided"
      );
    }

    if (!["inquiry_form", "quote_form"].includes(acceptance.acceptance_source)) {
      throw new Error(
        "acceptance_source must be either 'inquiry_form' or 'quote_form'"
      );
    }

    const { data, error } = await supabase()
      .from("privacy_policy_acceptances")
      .insert([acceptance])
      .select("*")
      .single();

    if (error) {
      throw new Error(
        `Error creating privacy policy acceptance: ${error.message}`
      );
    }

    return data;
  }

  static async findByUUID(uuid) {
    if (!uuid) {
      throw new Error("Acceptance uuid is required");
    }

    const { data, error } = await supabase()
      .from("privacy_policy_acceptances")
      .select("*")
      .eq("uuid", uuid)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Error fetching privacy policy acceptance by uuid: ${error.message}`
      );
    }

    return data;
  }

  static async findByInquiryUUID(inquiryUUID) {
    if (!inquiryUUID) {
      throw new Error("Inquiry uuid is required");
    }

    const { data, error } = await supabase()
      .from("privacy_policy_acceptances")
      .select("*")
      .eq("inquiry_uuid", inquiryUUID)
      .order("accepted_at", { ascending: false });

    if (error) {
      throw new Error(
        `Error fetching privacy policy acceptances by inquiry uuid: ${error.message}`
      );
    }

    return data || [];
  }

  static async findLatestByInquiryUUID(inquiryUUID) {
    if (!inquiryUUID) {
      throw new Error("Inquiry uuid is required");
    }

    const { data, error } = await supabase()
      .from("privacy_policy_acceptances")
      .select("*")
      .eq("inquiry_uuid", inquiryUUID)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Error fetching latest privacy policy acceptance by inquiry uuid: ${error.message}`
      );
    }

    return data;
  }

  static async findByQuoteUUID(quoteUUID) {
    if (!quoteUUID) {
      throw new Error("Quote uuid is required");
    }

    const { data, error } = await supabase()
      .from("privacy_policy_acceptances")
      .select("*")
      .eq("quote_uuid", quoteUUID)
      .order("accepted_at", { ascending: false });

    if (error) {
      throw new Error(
        `Error fetching privacy policy acceptances by quote uuid: ${error.message}`
      );
    }

    return data || [];
  }

  static async findLatestByQuoteUUID(quoteUUID) {
    if (!quoteUUID) {
      throw new Error("Quote uuid is required");
    }

    const { data, error } = await supabase()
      .from("privacy_policy_acceptances")
      .select("*")
      .eq("quote_uuid", quoteUUID)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Error fetching latest privacy policy acceptance by quote uuid: ${error.message}`
      );
    }

    return data;
  }

  static async existsForInquiryAndVersion(inquiryUUID, version) {
    if (!inquiryUUID) {
      throw new Error("Inquiry uuid is required");
    }

    if (!version) {
      throw new Error("Version is required");
    }

    const { data, error } = await supabase()
      .from("privacy_policy_acceptances")
      .select("uuid")
      .eq("inquiry_uuid", inquiryUUID)
      .eq("version", version)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Error checking privacy policy acceptance existence for inquiry and version: ${error.message}`
      );
    }

    return !!data;
  }

  static async existsForQuoteAndVersion(quoteUUID, version) {
    if (!quoteUUID) {
      throw new Error("Quote uuid is required");
    }

    if (!version) {
      throw new Error("Version is required");
    }

    const { data, error } = await supabase()
      .from("privacy_policy_acceptances")
      .select("uuid")
      .eq("quote_uuid", quoteUUID)
      .eq("version", version)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Error checking privacy policy acceptance existence for quote and version: ${error.message}`
      );
    }

    return !!data;
  }

  static async findByInquiryAndVersion(inquiryUUID, version) {
    if (!inquiryUUID) {
      throw new Error("Inquiry uuid is required");
    }

    if (!version) {
      throw new Error("Version is required");
    }

    const { data, error } = await supabase()
      .from("privacy_policy_acceptances")
      .select("*")
      .eq("inquiry_uuid", inquiryUUID)
      .eq("version", version)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Error finding privacy policy acceptance by inquiry and version: ${error.message}`
      );
    }

    return data || null;
  }

  static async findByQuoteAndVersion(quoteUUID, version) {
    if (!quoteUUID) {
      throw new Error("Quote uuid is required");
    }

    if (!version) {
      throw new Error("Version is required");
    }

    const { data, error } = await supabase()
      .from("privacy_policy_acceptances")
      .select("*")
      .eq("quote_uuid", quoteUUID)
      .eq("version", version)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Error finding privacy policy acceptance by quote and version: ${error.message}`
      );
    }

    return data || null;
  }

  static async hardDeleteByUUID(uuid) {
    if (!uuid) {
        throw new Error("Acceptance uuid is required");
    }

    const { error } = await supabase()
        .from("privacy_policy_acceptances")
        .delete()
        .eq("uuid", uuid);

    if (error) {
        throw new Error(
        `Error deleting privacy policy acceptance by uuid: ${error.message}`
        );
    }

    return true;
    }

}