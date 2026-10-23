import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/server";
import { setStaffPassword } from "@/app/staff-login/actions";

export const metadata = {
  title: "Set up staff access",
  robots: { index: false, follow: false },
};

export default async function StaffSetupPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user)
    redirect("/admin/login?error=Open the latest staff invitation link to continue.");

  const { data: member, error } = await db.rpc("staff_membership");
  if (error || member !== true)
    redirect("/admin/login?error=Staff setup is available through an invitation only.");

  const query = await searchParams;

  return (
    <main className="staff-auth-page">
      <section className="staff-auth-card" aria-labelledby="staff-password-title">
        <BrandLogo />
        <p className="eyebrow">STAFF INVITATION</p>
        <h1 id="staff-password-title">Set your password</h1>
        <p>Choose a unique password to secure your staff account. Next, set up two-step verification before entering the admin workspace.</p>

        {query.error && (
          <p className="form-error" role="alert">{query.error.slice(0, 250)}</p>
        )}

        <form action={setStaffPassword} className="stack-form">
          <label htmlFor="staff-new-password">New password</label>
          <input id="staff-new-password" name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required />
          <SubmitButton pendingText="Saving password…">Save and continue</SubmitButton>
        </form>
      </section>
    </main>
  );
}
