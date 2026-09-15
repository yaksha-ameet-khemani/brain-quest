"use client";
import { createBrowserClient } from "@supabase/ssr";

// Anon-key client used ONLY for parent sign-in/sign-up in the browser. This
// is the standard, safe use of the anon key - it identifies *who* is signing
// in, it never reads game data directly. All game data still goes through
// our server route handlers (see lib/supabaseServer.ts).
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
