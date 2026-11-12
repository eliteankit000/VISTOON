import Link from "next/link";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-accent text-sm font-bold text-white">V</div>
        <span className="font-semibold tracking-tight">VISTOON</span>
      </Link>
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-6 shadow-soft">{children}</div>
    </div>
  );
}
