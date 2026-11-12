import { PageHeader } from "@/components/ui";
import { MfaPanel } from "./MfaPanel";

export default async function Security({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Security" desc="Two-factor authentication (authenticator app)." />
      {sp.reason === "admin" && <p className="mb-4 rounded border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn">Admin access requires two-factor authentication. Set it up or verify below, then return to the Admin Console.</p>}
      <MfaPanel />
    </>
  );
}
