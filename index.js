import { createClient } from "jsr:@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Supabase URL or Service Role Key missing!");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.info("Expire quotes function started");

Deno.serve(async () => {
  const nowISO = new Date().toISOString();
  const { error } = await supabase
    .from("quotes")
    .update({
      status: "expired",
      is_active: false,
      is_expired: true,
      updated_at: nowISO,
    })
    .lte("expiry_end", nowISO)  // expiry_end <= now
    .eq("status", "pending")        // only pending quotes
    .eq("is_expired", false);       // skip already expired quotes

  if (error) {
    console.error("Error expiring quotes:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  console.info("Quotes expired successfully at", nowISO);

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { "Content-Type": "application/json" } }
  );
});
