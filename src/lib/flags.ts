import type { SupabaseClient } from "@supabase/supabase-js";
/** Feature flags are readable by signed-in users; a missing row counts as enabled so a typo cannot lock everyone out. */
export async function flagEnabled(supabase: SupabaseClient, key: string): Promise<boolean> {
  const { data } = await supabase.from("feature_flags").select("enabled").eq("key", key).maybeSingle();
  return data ? data.enabled === true : true;
}
