import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

// Cookie-aware Supabase client for reading the PARENT's session inside route
// handlers / server components. Identifies the signed-in parent; it does not
// bypass RLS the way lib/supabaseServer.ts does.
export async function supabaseServerAuth() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet: CookieToSet[]) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render - middleware/route
            // handlers refresh the session instead, so this is safe to ignore.
          }
        },
      },
    }
  );
}

/** Returns the signed-in parent's Supabase user, or null. */
export async function requireParent() {
  const supabase = await supabaseServerAuth();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
