import supabase from "./config/db.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Cleanup expired quote access tokens
 */
const cleanupExpiredTokens = async () => {
  console.info("[CRON] Cleanup expired tokens started...");

  try {
    const nowISO = new Date().toISOString();

    const { error, count } = await supabase
      .from("quote_access_tokens")
      .delete({ count: "exact" })
      .lt("expires_at", nowISO);

    if (error) {
      console.error("[CRON] Error cleaning tokens:", error.message);
      process.exit(1);
    }

    console.info(
      `[CRON] Cleanup complete. Deleted ${count ?? 0} expired tokens.`
    );

    process.exit(0);
  } catch (err) {
    console.error("[CRON] Unexpected error:", err.message);
    process.exit(1);
  }
};

// Run immediately
cleanupExpiredTokens();