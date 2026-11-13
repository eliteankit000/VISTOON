"use client";
import * as React from "react";
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, Field, Input, PageHeader, Skeleton, useToast } from "@/components/ui";

type Sw = { key: string; engaged: boolean; reason: string | null; description: string };
type Fl = { key: string; enabled: boolean; description: string };

export default function ControlsPage() {
  const toast = useToast();
  const [data, setData] = React.useState<{ switches: Sw[]; flags: Fl[] } | null>(null);
  const [err, setErr] = React.useState(false);
  const [engage, setEngage] = React.useState<Sw | null>(null);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const r = await fetch("/api/admin/controls");
    if (!r.ok) { setErr(true); return; }
    setData(await r.json()); setErr(false);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function patch(body: object, ok: string) {
    setBusy(true);
    const r = await fetch("/api/admin/controls", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (r.ok) { toast(ok, "success"); setEngage(null); setReason(""); await load(); } else toast(j.error ?? "Failed", "danger");
  }

  if (err) return <EmptyState title="Could not load controls" action={<Button variant="secondary" onClick={load}>Retry</Button>} />;
  return (
    <>
      <PageHeader crumbs={["Admin", "Controls"]} title="Kill switches and feature flags" desc="Kill switches are enforced inside the database: while engaged, new uploads or render jobs are rejected no matter which code path tries." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Kill switches" />
          {!data ? <div className="p-5"><Skeleton className="h-16" /></div> : <ul className="divide-y divide-line">
            {data.switches.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-3 px-5 py-3">
                <div><p className="text-sm font-medium">{s.description}</p><p className="text-xs text-muted">{s.engaged ? `Engaged: ${s.reason}` : "Normal operation"}</p></div>
                <div className="flex items-center gap-2"><Badge tone={s.engaged ? "danger" : "success"}>{s.engaged ? "Engaged" : "Off"}</Badge>
                  {s.engaged ? <Button size="sm" variant="secondary" loading={busy} onClick={() => patch({ type: "switch", key: s.key, engaged: false }, "Released")}>Release</Button>
                    : <Button size="sm" variant="danger" onClick={() => setEngage(s)}>Engage</Button>}</div>
              </li>))}
          </ul>}
        </Card>
        <Card>
          <CardHeader title="Feature flags" />
          {!data ? <div className="p-5"><Skeleton className="h-16" /></div> : <ul className="divide-y divide-line">
            {data.flags.map((f) => (
              <li key={f.key} className="flex items-center justify-between gap-3 px-5 py-3">
                <p className="text-sm font-medium">{f.description}</p>
                <div className="flex items-center gap-2"><Badge tone={f.enabled ? "success" : "neutral"}>{f.enabled ? "On" : "Off"}</Badge>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => patch({ type: "flag", key: f.key, enabled: !f.enabled }, "Flag updated")}>{f.enabled ? "Turn off" : "Turn on"}</Button></div>
              </li>))}
          </ul>}
        </Card>
      </div>
      <Dialog open={!!engage} onClose={() => setEngage(null)} title={`Engage: ${engage?.description ?? ""}`}>
        <Field label="Reason (recorded in the audit log)"><Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} /></Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEngage(null)}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={() => engage && patch({ type: "switch", key: engage.key, engaged: true, reason }, "Kill switch engaged")}>Engage</Button>
        </div>
      </Dialog>
    </>
  );
}
