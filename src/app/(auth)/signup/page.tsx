import Link from "next/link";
import { signup } from "@/app/auth/actions";
import { AuthForm } from "../AuthForm";

export default function Signup() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Create your account</h1>
      <AuthForm action={signup} submit="Create account" fields={["name", "email", "password"]} />
      <p className="mt-4 text-sm text-muted">Already have an account? <Link href="/login" className="text-ink underline">Sign in</Link></p>
    </>
  );
}
