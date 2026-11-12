import Link from "next/link";
import { login } from "@/app/auth/actions";
import { AuthForm } from "../AuthForm";
import { safeRedirect } from "@/lib/auth/rules";

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Sign in</h1>
      {sp.error && <p role="alert" className="mb-3 text-sm text-danger">That link is invalid or expired.</p>}
      <AuthForm action={login} submit="Sign in" fields={["email", "password"]} next={safeRedirect(sp.next)} />
      <div className="mt-4 flex justify-between text-sm text-muted">
        <Link href="/reset" className="hover:text-ink">Forgot password?</Link>
        <Link href="/signup" className="hover:text-ink">Create account</Link>
      </div>
    </>
  );
}
