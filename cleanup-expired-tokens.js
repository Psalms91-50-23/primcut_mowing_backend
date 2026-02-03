import supabase from "./config/db.js";
import dotenv from "dotenv";
dotenv.config();

console.info("Cleanup expired tokens function started");

(async () => {
  const nowISO = new Date().toISOString();

  const { error } = await supabase
    .from("quote_access_tokens")
    .delete()
    .lt("expires_at", nowISO);

  if (error) {
    console.error("Error cleaning tokens:", error.message);
    process.exit(1);
  }

  console.info("Expired tokens cleaned.");
  process.exit(0);
})();
