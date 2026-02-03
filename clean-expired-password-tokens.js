import supabase from "./config/db.js";
import dotenv from 'dotenv';
dotenv.config();

console.info("Delete expired password tokens function started");

(async () => {
  const nowISO = new Date().toISOString();

  try {
    // Delete expired password tokens
    const { data, error } = await supabase
      .from('password_reset_tokens')
      .delete()
      .lte('expires_at', nowISO); // only tokens where expires_at <= now

    if (error) {
      console.error('Error deleting expired password tokens:', error.message);
      await supabase.from('function_logs').insert([
        {
          function_name: 'delete-expired-password-tokens',
          message: `Error: ${error.message}`,
          created_at: nowISO,
        },
      ]);
      process.exit(1);
    }

    console.info(
      `Expired password tokens deleted: ${data?.length || 0}`
    );

    // Log success
    await supabase.from('function_logs').insert([
      {
        function_name: 'delete-expired-password-tokens',
        message: `Deleted ${data?.length || 0} expired password tokens`,
        created_at: nowISO,
      },
    ]);

    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();
