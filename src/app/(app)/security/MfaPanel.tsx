"use client";
import { useEffect, useState } from "react";
import { Button, Card, CardHeader, Input, Field } from "@/components/ui";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Enroll = { factorId: string; qr: string; secret: string };

export function MfaPanel() {
  const supabase = createBrowserSupabase();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<Enroll | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactorId(data?.totp.find((f) => f.status === "verified")?.id ?? null);
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setLevel(aal?.currentLevel ?? null);
  }
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function start() {
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error || !data) return setMsg("Could not start setup. Try again.");
    setEnroll({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }
  async function verify(id: string) {
    setBusy(true); setMsg(null);
    const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({ factorId: id });
    if (e1 || !ch) { setBusy(false); return setMsg("Could not start verification."); }
    const { error } = await supabase.auth.mfa.verify({ factorId: id, challengeId: ch.id, code: code.trim() });
    setBusy(false);
    if (error) return setMsg("That code is not valid.");
    setEnroll(null); setCode(""); setMsg("Verified."); await refresh();
  }

  return (
    <Card className="max-w-md">
      <CardHeader title="Authenticator app" desc={level === "aal2" ? "This session is verified with two-factor." : "Not verified in this session."} />
      <div className="space-y-4 p-5">
        {!factorId && !enroll && <Button onClick={start} loading={busy}>Set up two-factor</Button>}
        {enroll && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enroll.qr} alt="QR code to scan with your authenticator app" className="h-40 w-40 rounded border border-line" />
            <p className="text-xs text-muted">Or enter this key manually: <code className="font-mono">{enroll.secret}</code></p>
            <Field label="6-digit code"><Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
            <Button onClick={() => verify(enroll.factorId)} loading={busy}>Confirm</Button>
          </>
        )}
        {factorId && level !== "aal2" && (
          <>
            <Field label="Code from your authenticator app"><Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
            <Button onClick={() => verify(factorId)} loading={busy}>Verify this session</Button>
          </>
        )}
        {msg && <p role="status" className="text-sm text-muted">{msg}</p>}
      </div>
    </Card>
  );
}
