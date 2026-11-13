"use client";
import * as React from "react";
import { Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, PageHeader, Skeleton, useToast } from "@/components/ui";

type U = { user_id: string; display_name: string | null; role: "user" | "admin"; created_at: string };

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = React.useState<U[] | null>(null);
  const [me, setMe] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<{ u: U; role: "user" | "admin" } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const r = await fetch("/api/admin/users");
    if (!r.ok) { setErr("Could not load users."); return; }
    const j = await r.json(); setUsers(j.users); setMe(j.me); setErr(null);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function apply() {
    if (!pending) return;
    setBusy(true);
    const r = await fetch("/api/admin/users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: pending.u.user_id, role: pending.role }) });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (r.ok) { toast("Role updated", "success"); setPending(null); await load(); } else { toast(j.error ?? "Failed", "danger"); setPending(null); }
  }

  return (
    <>
      <PageHeader crumbs={["Admin", "Users"]} title="Users and roles" desc="Role changes are written to the audit log. You cannot change your own role." />
      <Card>
        <CardHeader title="Accounts" />
        {err ? <EmptyState title={err} action={<Button variant="secondary" onClick={load}>Retry</Button>} /> :
          !users ? <div className="space-y-2 p-5"><Skeleton className="h-8" /><Skeleton className="h-8" /></div> :
          users.length === 0 ? <EmptyState title="No users yet" /> :
          <ul className="divide-y divide-line">
            {users.map((u) => (
              <li key={u.user_id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{u.display_name ?? "Unnamed"}{u.user_id === me && " (you)"}</p><p className="truncate text-xs text-muted">{u.user_id}</p></div>
                <div className="flex items-center gap-3">
                  <Badge tone={u.role === "admin" ? "warn" : "neutral"}>{u.role}</Badge>
                  <Button size="sm" variant="secondary" disabled={u.user_id === me} onClick={() => setPending({ u, role: u.role === "admin" ? "user" : "admin" })}>
                    {u.role === "admin" ? "Make user" : "Make admin"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>}
      </Card>
      <ConfirmDialog open={!!pending} onClose={() => setPending(null)} onConfirm={apply} loading={busy} confirmLabel="Change role"
        title="Change role?" body={pending ? `${pending.u.display_name ?? pending.u.user_id} will become ${pending.role}. Admins must use two-factor authentication.` : ""} />
    </>
  );
}
