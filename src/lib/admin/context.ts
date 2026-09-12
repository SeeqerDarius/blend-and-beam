import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PermissionKey } from "./nav";

export type AdminContext =
  | { status: "unauthenticated" }
  | { status: "not-staff" }
  | { status: "needs-enrollment"; email: string; permissions: PermissionKey[] }
  | { status: "needs-challenge"; email: string; permissions: PermissionKey[] }
  | { status: "ready"; email: string; userId: string; permissions: PermissionKey[] };

export async function getAdminContext(): Promise<AdminContext> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { status: "unauthenticated" };

  const { data: isStaff } = await supabase.rpc("staff_membership");
  if (!isStaff) return { status: "not-staff" };

  const { data: permissionData } = await supabase.rpc("my_permissions");
  const permissions = (permissionData ?? []) as PermissionKey[];
  const email = userData.user.email ?? "";

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") {
    return { status: "ready", email, userId: userData.user.id, permissions };
  }
  return aal?.nextLevel === "aal2"
    ? { status: "needs-challenge", email, permissions }
    : { status: "needs-enrollment", email, permissions };
}

export function hasPermission(ctx: AdminContext, key: PermissionKey) {
  return ctx.status === "ready" && ctx.permissions.includes(key);
}

// For use inside /admin/* pages: the layout already gates on staff+MFA, but
// each page fetches its own context (Next.js pages and layouts don't share
// server state) and re-checks the specific permission it needs.
export async function requireAdmin(permission?: PermissionKey) {
  const ctx = await getAdminContext();
  if (ctx.status !== "ready") redirect("/admin");
  if (permission && !ctx.permissions.includes(permission)) redirect("/admin");
  return ctx;
}
