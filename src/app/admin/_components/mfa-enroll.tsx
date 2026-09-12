"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Enrollment = { factorId: string; qrCode: string; secret: string };

export function MfaEnroll({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startEnrollment() {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (enrollError || !data.totp) {
      setError(enrollError?.message ?? "Could not start enrollment.");
      return;
    }
    setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verifyCode() {
    if (!enrollment) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrollment.factorId });
    if (challengeError || !challenge) {
      setBusy(false);
      setError(challengeError?.message ?? "Could not start verification.");
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: enrollment.factorId, challengeId: challenge.id, code: code.trim() });
    setBusy(false);
    if (verifyError) {
      setError("That code didn't match. Check the time on your authenticator app and try again.");
      return;
    }
    onDone?.();
    router.refresh();
  }

  if (!enrollment) {
    return (
      <div className="mfa-panel">
        <p className="eyebrow">TWO-FACTOR AUTHENTICATION REQUIRED</p>
        <h2>Set up an authenticator app</h2>
        <p>Every admin action requires a verified authenticator (TOTP) app such as Google Authenticator, 1Password, or Authy. This only needs to be set up once.</p>
        {error && <p className="form-error">{error}</p>}
        <button className="button button-dark" onClick={startEnrollment} disabled={busy}>{busy ? "Starting…" : "Start setup"}</button>
      </div>
    );
  }

  return (
    <div className="mfa-panel">
      <p className="eyebrow">SCAN TO CONTINUE</p>
      <h2>Scan this code</h2>
      <p>Open your authenticator app and scan the QR code, or enter the key manually.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mfa-qr" src={enrollment.qrCode} alt="Authenticator QR code" width={200} height={200} />
      <p className="fine-print mfa-secret">Manual key: <code>{enrollment.secret}</code></p>
      <label>Enter the 6-digit code
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="button button-dark" onClick={verifyCode} disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify and continue"}</button>
    </div>
  );
}
