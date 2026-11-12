import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

/** Per-request client acting AS THE SIGNED-IN USER. Row-level security applies. */
export async function createClient() {
  const store = await cookies(); // first: marks the page as per-request (never prerendered)
  const env = publicEnv();
  if (!env) throw new Error("Supabase is not configured (see .env.example)");
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* called from a Server Component; middleware refreshes the session */ }
      },
    },
  });
}
