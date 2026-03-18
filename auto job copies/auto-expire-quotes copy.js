import supabase from "../config/db.js";
import dotenv from "dotenv";
dotenv.config();

console.info("Auto-expire quotes job started");

(async () => {
  const nowISO = new Date().toISOString();

  try {
    // 1) Expire sent quotes (client-facing)
    const { data: expiredQuotes, error: expireError } = await supabase
      .from("quotes")
      .update({
        status: "expired",
        is_active: false,
        is_expired: true,
        updated_at: nowISO,
      })
      .lte("expiry_end", nowISO)
      .eq("status", "sent")
      .eq("is_expired", false)
      .select("uuid");

    if (expireError) {
      await supabase.from("function_logs").insert([
        {
          function_name: "auto-expire-quotes",
          message: `Expire error: ${expireError.message}`,
          created_at: nowISO,
        },
      ]);
      console.error("Error expiring sent quotes:", expireError.message);
      process.exit(1);
    }

    // 2) Mark stale drafts (internal) - 14 days since last update
    const staleCutoffISO = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: staleDrafts, error: staleError } = await supabase
      .from("quotes")
      .update({
        is_active: false,
        stale_at: nowISO,
        updated_at: nowISO,
      })
      .lte("updated_at", staleCutoffISO)
      .eq("status", "draft")
      .is("stale_at", null)
      .select("uuid");

    if (staleError) {
      await supabase.from("function_logs").insert([
        {
          function_name: "auto-expire-quotes",
          message: `Stale error: ${staleError.message}`,
          created_at: nowISO,
        },
      ]);
      console.error("Error marking stale drafts:", staleError.message);
      process.exit(1);
    }

    console.info(`Expired quotes: ${(expiredQuotes || []).length}`);
    console.info(`Stale drafts: ${(staleDrafts || []).length}`);

    await supabase.from("function_logs").insert([
      {
        function_name: "auto-expire-quotes",
        message: `Expired ${(expiredQuotes || []).length} quotes; Staled ${(staleDrafts || []).length} drafts`,
        created_at: nowISO,
      },
    ]);

    process.exit(0);
  } catch (err) {
    const msg = err?.message || String(err);
    console.error("Unexpected error:", msg);

    try {
      await supabase.from("function_logs").insert([
        {
          function_name: "auto-expire-quotes",
          message: `Unexpected error: ${msg}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (_) {}

    process.exit(1);
  }
})();