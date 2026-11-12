import { Card, CardHeader, PageHeader, MockBanner, Field, Input, Button } from "@/components/ui";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" desc="Profile and account security." />
      <MockBanner />
      <Card className="max-w-xl">
        <CardHeader title="Profile" />
        <div className="space-y-3 p-5"><Field label="Display name"><Input disabled placeholder="Sign in to edit" /></Field><Button disabled>Save</Button></div>
      </Card>
    </>
  );
}
