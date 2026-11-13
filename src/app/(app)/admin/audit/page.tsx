"use client";
import * as React from "react";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton } from "@/components/ui";

type E = { id: number; actor: string | null; action: string; target: string | null; meta: Record<string, unknown> | null; at: string };

export default function AuditPage() {
  const [rows, setRows] = React.useState<E[] | null>(null);
  const [next, setNext] = React.useState<number | null>(null);
  const [err, setErr] = React.useState(false);
  const [filter, setFilter] = React.useState("");
  const [more, setMore] = React.useState(false);

  const load = React.useCallback(async (before?: number, replace = true) => {
    const qs = new URLSearchParams({ limit: "50" });
    if (before) qs.set("before", String(before));
    if (filter) qs.set("action", filter);
    const r = await fetch(`/api/admin/audit?${qs}`);
    if (!r.ok) { setErr(true); return; }
    const j = await r.json();
    setErr(false); setNext(j.next); setRows((cur) => (replace || !cur ? j.entries : [...cur, ...j.entries]));
  }, [filter]);
  React.useEffect(() => { setRows(null); void load(); }, [load]);

  return (
    <>
      <PageHeader crumbs={["Admin", "Audit log"]} title="Audit log" desc="Append-only. Entries cannot be edited or deleted, even by the server." />
      <div className="mb-3 flex flex-wrap gap-2">
        {[["", "All"], ["user.", "Roles"], ["killswitch.", "Kill switches"], ["flag.", "Flags"], ["style.", "Styles"], ["job.", "Jobs"]].map(([v, l]) => (
          <Button key={l} size="sm" variant={filter === v ? "primary" : "secondary"} onClick={() => setFilter(v!)}>{l}</Button>))}
      </div>
      <Card>
        <CardHeader title="Events" />
        {err ? <EmptyState title="Could not load the audit log" action={<Button variant="secondary" onClick={() => load()}>Retry</Button>} /> :
          !rows ? <div className="space-y-2 p-5"><Skeleton className="h-8" /><Skeleton className="h-8" /></div> :
          rows.length === 0 ? <EmptyState title="No events" desc="Nothing matches this filter yet." /> :
          <ul className="divide-y divide-line">
            {rows.map((e) => (
              <li key={e.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2"><Badge>{e.action}</Badge><span className="text-muted">{e.target}</span></span>
                  <time className="text-xs text-muted" dateTime={e.at}>{new Date(e.at).toLocaleString()}</time></div>
                <p className="mt-1 truncate text-xs text-muted">actor {e.actor ?? "system"}{e.meta ? ` · ${JSON.stringify(e.meta)}` : ""}</p>
              </li>))}
          </ul>}
        {next && <div className="border-t border-line p-3 text-center"><Button variant="secondary" loading={more} onClick={async () => { setMore(true); await load(next, false); setMore(false); }}>Load more</Button></div>}
      </Card>
    </>
  );
}
