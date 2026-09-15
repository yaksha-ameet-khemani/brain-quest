import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// SERVICE ROLE client - bypasses Row Level Security entirely. This file is
// guarded by the `server-only` package: importing it from a Client Component
// is a build error, not just a bad idea. Every question/answer/points
// operation goes through our own route handlers using this client, so the
// browser never talks to Supabase directly for game data and the anon key
// never needs read access to anything sensitive (questions.correct_option_index
// included).

let client: ReturnType<typeof createClient<Database>> | null = null;

export function supabaseAdmin() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
    );
  }

  client = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
