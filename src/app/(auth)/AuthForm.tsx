"use client";
import { useActionState } from "react";
import { Button, Field, Input } from "@/components/ui";
import type { FormState } from "@/app/auth/actions";

type Props = {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  submit: string; next?: string;
  fields: ("name" | "email" | "password")[];
};
export function AuthForm({ action, submit, fields, next }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {fields.includes("name") && <Field label="Name"><Input name="name" autoComplete="name" maxLength={80} /></Field>}
      {fields.includes("email") && <Field label="Email"><Input name="email" type="email" autoComplete="email" required /></Field>}
      {fields.includes("password") && (
        <Field label="Password" hint={submit === "Create account" ? "At least 12 characters." : undefined}>
          <Input name="password" type="password" autoComplete={submit === "Create account" ? "new-password" : "current-password"} required />
        </Field>
      )}
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.message && <p role="status" className="text-sm text-success">{state.message}</p>}
      <Button type="submit" className="w-full" loading={pending}>{submit}</Button>
    </form>
  );
}
