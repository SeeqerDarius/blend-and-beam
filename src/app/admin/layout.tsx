import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/context";
import { AdminShell } from "./_components/admin-shell";
import { MfaEnroll } from "./_components/mfa-enroll";
import { MfaChallenge } from "./_components/mfa-challenge";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext();

  if (ctx.status === "unauthenticated") redirect("/login?next=/admin");
  if (ctx.status === "not-staff") redirect("/");

  if (ctx.status === "needs-enrollment" || ctx.status === "needs-challenge") {
    return (
      <main className="admin-shell admin-shell-locked">
        <section className="admin-main mfa-gate">
          {ctx.status === "needs-enrollment" ? <MfaEnroll /> : <MfaChallenge />}
        </section>
      </main>
    );
  }

  return (
    <AdminShell email={ctx.email} permissions={ctx.permissions}>
      {children}
    </AdminShell>
  );
}
