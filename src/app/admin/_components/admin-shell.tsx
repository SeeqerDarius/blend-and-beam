"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { adminNav, type PermissionKey } from "@/lib/admin/nav";
import { createClient } from "@/lib/supabase/browser";

export function AdminShell({ email, permissions, children }: { email: string; permissions: PermissionKey[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const visible = adminNav.filter((item) => permissions.includes(item.permission));

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="admin-shell">
      <aside className="admin-nav">
        <BrandLogo inverse />
        {visible.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={active ? "active" : undefined}>
              {item.label}
            </Link>
          );
        })}
        <div className="admin-nav-footer">
          <small>{email}</small>
          <button onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <section className="admin-main">{children}</section>
    </main>
  );
}
