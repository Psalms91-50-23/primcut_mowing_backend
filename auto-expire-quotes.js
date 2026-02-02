import supabase from "./config/db.js";
import dotenv from 'dotenv';
dotenv.config();

console.info("Expire quotes function started");

(async () => {
  const nowISO = new Date().toISOString();

  try {
    // Expire pending quotes
    const { data, error } = await supabase
      .from('quotes')
      .update({
        status: 'expired',
        is_active: false,
        is_expired: true,
        updated_at: nowISO,
      })
      .lte('expiry_end', nowISO)   // expiry_end <= now
      .in('status', ['draft', 'sent'])
      .eq('is_expired', false)    // skip already expired
      .select('*');

    if (error) {
      console.error('Error expiring quotes:', error.message);
      await supabase.from('function_logs').insert([
        {
          function_name: 'auto-expire-quotes',
          message: `Error: ${error.message}`,
          created_at: nowISO,
        },
      ]);
      process.exit(1);
    }

    console.info(
    `Quotes expired: ${data.map(q => q.uuid).join(', ') || 'none'}`
  );

    // Log success
    await supabase.from('function_logs').insert([
      {
        function_name: 'auto-expire-quotes',
        message: `Expired ${data?.length || 0} quotes`,
        created_at: nowISO,
      },
    ]);

    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();
