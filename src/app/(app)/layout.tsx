import { AppShell } from "@/components/shell/AppShell";
import { requireUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic"; // signed-in pages are never prerendered or cached

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, role, displayName } = await requireUser();
  return <AppShell role={role} label={displayName ?? user.email ?? "Account"}>{children}</AppShell>;
}
