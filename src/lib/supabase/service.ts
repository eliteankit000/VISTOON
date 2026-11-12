import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * SERVICE-ROLE client. BYPASSES row-level security. Use only in server code AFTER you have authenticated the
 * caller and checked ownership/role yourself (render jobs, usage events, audit log). `server-only` makes the
 * build fail if this file is ever imported into client code.
 */
export function createServiceClient() {
  const env = publicEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !key) throw new Error("Service role is not configured");
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
