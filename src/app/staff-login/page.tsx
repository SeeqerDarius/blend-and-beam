import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/server";
import { safeAdminNext } from "@/lib/auth-validation";
import { staffSignIn } from "./actions";

export const metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function StaffLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const query = await searchParams;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();

  if (user) {
    const { data: member, error } = await db.rpc("staff_membership");
    if (!error && member === true) {
      const { data: assurance } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
      redirect(assurance?.currentLevel === "aal2" ? "/admin" : "/account/security?next=/admin");
    }
  }

  return (
    <main className="staff-auth-page">
      <section className="staff-auth-card" aria-labelledby="staff-login-title">
        <BrandLogo />
        <p className="eyebrow">BLEND &amp; BEAM · STORE OPERATIONS</p>
        <h1 id="staff-login-title">Admin sign in</h1>
        <p>For invited staff members only. Customer accounts cannot access this workspace.</p>

        {query.error && (
          <p className="form-error" role="alert">{query.error.slice(0, 250)}</p>
        )}

        <form action={staffSignIn} className="stack-form">
          <input type="hidden" name="next" value={safeAdminNext(query.next)} />
          <label htmlFor="staff-email">Work email</label>
          <input id="staff-email" name="email" type="email" maxLength={254} autoComplete="username" required />
          <label htmlFor="staff-password">Password</label>
          <input id="staff-password" name="password" type="password" maxLength={128} autoComplete="current-password" required />
          <SubmitButton pendingText="Signing in…">Sign in to admin</SubmitButton>
        </form>

        <p className="staff-auth-help">Staff access is created by invitation. If you do not have an invitation, contact a store administrator.</p>
        <Link className="staff-customer-link" href="/login">Go to customer sign in</Link>
      </section>
    </main>
  );
}
