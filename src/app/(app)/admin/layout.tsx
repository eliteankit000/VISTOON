import { requireAdminPage } from "@/lib/auth/guards";

// Every admin page passes through this check on the server: signed in + admin role + MFA-verified session.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return <>{children}</>;
}
