"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { passwordProblem, safeRedirect } from "@/lib/auth/rules";

export type FormState = { error?: string; message?: string };
const email = z.string().trim().toLowerCase().email().max(254);

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const e = email.safeParse(form.get("email"));
  const pw = String(form.get("password") ?? "");
  // One generic message for every failure: never reveal whether an account exists.
  if (!e.success || !pw) return { error: "Invalid email or password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: e.data, password: pw });
  if (error) return { error: "Invalid email or password." };
  redirect(safeRedirect(String(form.get("next") ?? "")));
}

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const e = email.safeParse(form.get("email"));
  const pw = String(form.get("password") ?? "");
  if (!e.success) return { error: "Enter a valid email address." };
  const problem = passwordProblem(pw);
  if (problem) return { error: problem };
  const supabase = await createClient();
  await supabase.auth.signUp({
    email: e.data, password: pw,
    options: { emailRedirectTo: `${await origin()}/auth/callback`, data: { display_name: String(form.get("name") ?? "").slice(0, 80) } },
  });
  // Same response whether or not the email is already registered (prevents account enumeration).
  return { message: "If this email can be registered, a confirmation link has been sent. Check your inbox." };
}

export async function requestReset(_: FormState, form: FormData): Promise<FormState> {
  const e = email.safeParse(form.get("email"));
  if (e.success) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(e.data, { redirectTo: `${await origin()}/auth/callback?next=/settings` });
  }
  return { message: "If an account exists for that email, a reset link has been sent." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
