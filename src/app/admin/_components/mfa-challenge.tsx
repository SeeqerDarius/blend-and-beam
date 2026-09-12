"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function MfaChallenge() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data, error: listError }) => {
      const verified = data?.totp.find((f) => f.status === "verified");
      if (verified) setFactorId(verified.id);
      else if (listError) setError(listError.message);
    });
  }, []);

  async function verify() {
    if (!factorId) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setBusy(false);
      setError(challengeError?.message ?? "Could not start verification.");
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.trim() });
    setBusy(false);
    if (verifyError) {
      setError("That code didn't match. Try the next code from your authenticator app.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mfa-panel">
      <p className="eyebrow">VERIFY YOUR IDENTITY</p>
      <h2>Enter your authenticator code</h2>
      <p>Enter the 6-digit code from your authenticator app to continue to the admin workspace.</p>
      <label>Authentication code
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" autoFocus />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="button button-dark" onClick={verify} disabled={busy || code.length !== 6 || !factorId}>{busy ? "Verifying…" : "Verify"}</button>
    </div>
  );
}
