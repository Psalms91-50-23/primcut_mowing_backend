
import { supabase } from "../config/db.js";

export default class QuoteTermsAcceptance {

  static async create(payload) {
    if (!payload) {
      throw new Error("Acceptance payload is required");
    }

    const acceptance = {
      uuid: payload.uuid,
      quote_uuid: payload.quote_uuid,
      terms_uuid: payload.terms_uuid,
      version: payload.version,
      accepted_at: payload.accepted_at || new Date().toISOString(),
      ip_address: payload.ip_address || null,
      user_agent: payload.user_agent || null,
      created_at: payload.created_at || new Date().toISOString(),
    };

    if (!acceptance.uuid) {
      throw new Error("uuid is required");
    }

    if (!acceptance.quote_uuid) {
      throw new Error("quote_uuid is required");
    }

    if (!acceptance.terms_uuid) {
      throw new Error("terms_uuid is required");
    }

    if (!acceptance.version) {
      throw new Error("version is required");
    }

    const { data, error } = await supabase()
      .from("quote_terms_acceptances")
      .insert([acceptance])
      .select("*")
      .single();

    if (error) {
      throw new Error(
        `Error creating quote terms acceptance: ${error.message}`
      );
    }

    return data;
  }

  static async findByUUID(uuid) {
    if (!uuid) {
      throw new Error("Acceptance uuid is required");
    }

    const { data, error } = await supabase()
      .from("quote_terms_acceptances")
      .select("*")
      .eq("uuid", uuid)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Error fetching quote terms acceptance by uuid: ${error.message}`
      );
    }

    return data;
  }

  static async findByQuoteUUID(quoteUUID) {
    if (!quoteUUID) {
      throw new Error("Quote uuid is required");
    }

    const { data, error } = await supabase()
      .from("quote_terms_acceptances")
      .select("*")
      .eq("quote_uuid", quoteUUID)
      .order("accepted_at", { ascending: false });

    if (error) {
      throw new Error(
        `Error fetching quote terms acceptances by quote uuid: ${error.message}`
      );
    }

    return data || [];
  }

  static async findLatestByQuoteUUID(quoteUUID) {
    if (!quoteUUID) {
      throw new Error("Quote uuid is required");
    }

    const { data, error } = await supabase()
      .from("quote_terms_acceptances")
      .select("*")
      .eq("quote_uuid", quoteUUID)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Error fetching latest quote terms acceptance: ${error.message}`
      );
    }

    return data;
  }

  static async existsForQuoteAndVersion(quoteUUID, version) {
    if (!quoteUUID) {
      throw new Error("Quote uuid is required");
    }

    if (!version) {
      throw new Error("Version is required");
    }

    const { data, error } = await supabase()
      .from("quote_terms_acceptances")
      .select("uuid")
      .eq("quote_uuid", quoteUUID)
      .eq("version", version)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Error checking quote terms acceptance existence: ${error.message}`
      );
    }

    return !!data;
  }

  static async findByQuoteAndVersion(quoteUUID, version) {
    if (!quoteUUID) {
      throw new Error("Quote uuid is required");
    }

    if (!version) {
      throw new Error("Version is required");
    }

    const { data, error } = await supabase()
      .from("quote_terms_acceptances")
      .select("*")
      .eq("quote_uuid", quoteUUID)
      .eq("version", version)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Error finding quote terms acceptance by quote and version: ${error.message}`
      );
    }

    return data || null;
  }

}
