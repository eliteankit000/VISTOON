import Link from "next/link";
import { requestReset } from "@/app/auth/actions";
import { AuthForm } from "../AuthForm";

export default function Reset() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Reset your password</h1>
      <AuthForm action={requestReset} submit="Send reset link" fields={["email"]} />
      <p className="mt-4 text-sm text-muted"><Link href="/login" className="text-ink underline">Back to sign in</Link></p>
    </>
  );
}
