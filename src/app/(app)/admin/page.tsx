import Link from "next/link";
import { Card, CardHeader, Badge, PageHeader, MockBanner, Button } from "@/components/ui";
import { styles } from "@/lib/mock";

export default function Admin() {
  return (
    <>
      <PageHeader title="Admin Console" desc="Packages, styles and audit. Access will require admin role and MFA." actions={<Button variant="secondary" disabled>Import package</Button>} />
      <MockBanner />
      <Card>
        <CardHeader title="Animation styles" desc="Lifecycle: Draft → Needs Review → Testing → Verified → Published." />
        <ul className="divide-y divide-line">
          {styles.map((s) => (
            <li key={s.id}><Link href="/admin/styles" className="flex items-center justify-between px-5 py-3 hover:bg-hover">
              <span className="text-sm font-medium">{s.name}</span>
              <span className="flex gap-2"><Badge tone={s.verified ? "success" : "warn"}>{s.verified ? "Verified" : "Not verified"}</Badge><Badge>{s.status}</Badge></span>
            </Link></li>
          ))}
        </ul>
      </Card>
    </>
  );
}
