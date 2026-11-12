import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminAccess, type Role } from "./rules";

/** getUser() re-validates the token with Supabase Auth. Never trust getSession() for authorization. */
export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

export async function requireUser() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("display_name, role").eq("user_id", user.id).single();
  return { supabase, user, role: (profile?.role ?? "user") as Role, displayName: profile?.display_name ?? null };
}

async function adminState() {
  const { supabase, user } = await getUser();
  if (!user) return { supabase, user: null, access: adminAccess(null, null, null) };
  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).single();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return { supabase, user, access: adminAccess(user, (profile?.role ?? "user") as Role, aal?.currentLevel ?? null) };
}

/** For admin PAGES: redirects. */
export async function requireAdminPage() {
  const s = await adminState();
  if (s.access.ok) return s as typeof s & { user: NonNullable<typeof s.user> };
  if (s.access.status === 401) redirect("/login");
  redirect(s.access.reason === "MFA required" ? "/security?reason=admin" : "/dashboard");
}

/** For admin API routes: returns a Response on failure, or the context on success. */
export async function requireAdminApi() {
  const s = await adminState();
  if (!s.access.ok) return { error: Response.json({ error: s.access.reason }, { status: s.access.status }) };
  return { ctx: s as typeof s & { user: NonNullable<typeof s.user> } };
}
