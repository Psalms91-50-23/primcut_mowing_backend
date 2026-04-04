// import { createClient } from "@supabase/supabase-js";
// import dotenv from "dotenv";

// dotenv.config();

// const SUPABASE_URL = process.env.SUPABASE_URL;
// const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
// const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// if (!SUPABASE_URL) {
//   throw new Error("SUPABASE_URL is missing");
// }

// if (!SUPABASE_SERVICE_ROLE_KEY) {
//   throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
// }

// // export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
// export const supabase = createClient(
//   process.env.SUPABASE_URL,
//   process.env.SUPABASE_SERVICE_ROLE_KEY,
//   {
//     auth: {
//       persistSession: false,
//       autoRefreshToken: false,
//       detectSessionInUrl: false,
//     },
//   }
// );

// export const supabaseNonAdmin = SUPABASE_ANON_KEY
//   ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
//   : null;

// export default supabase;
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) throw new Error("SUPABASE_URL is missing");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");

export function supabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function supabaseNonAdmin() {
  if (!SUPABASE_ANON_KEY) return null;

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export default supabase;