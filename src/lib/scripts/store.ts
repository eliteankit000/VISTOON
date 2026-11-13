import type { SupabaseClient } from "@supabase/supabase-js";

/** One script per project for now. Uses the caller's own client, so row-level security applies. */
export async function getOrCreateScript(supabase: SupabaseClient, userId: string, projectId: string): Promise<string | null> {
  const { data } = await supabase.from("scripts").select("id").eq("project_id", projectId).order("created_at").limit(1).maybeSingle();
  if (data) return data.id;
  const ins = await supabase.from("scripts").insert({ user_id: userId, project_id: projectId }).select("id").single();
  return ins.data?.id ?? null;
}
export const VERSION_COLUMNS = "id, script_id, body, kind, revision_round, parent_id, count_type, target_count, actual_count, counter_policy, scores, created_at, updated_at";
