import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { assignStaff, revokeStaff } from "./actions";

export default async function AdminStaff({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin("staff.manage");
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: roles }, { data: assignments }] = await Promise.all([
    supabase.from("roles").select("id,name").order("name"),
    supabase.from("user_roles").select("user_id,role_id,roles(name)"),
  ]);

  // user_roles.user_id references auth.users, not public.profiles, so
  // PostgREST can't embed the join directly; resolve names separately.
  const staffIds = [...new Set((assignments ?? []).map((a) => a.user_id))];
  const { data: staffProfiles } = staffIds.length ? await supabase.from("profiles").select("id,email,full_name").in("id", staffIds) : { data: [] as { id: string; email: string | null; full_name: string | null }[] };
  const profileById = new Map((staffProfiles ?? []).map((p) => [p.id, p]));

  return (
    <>
      <p className="eyebrow">TEAM ACCESS</p>
      <h2>Staff</h2>
      <p className="fine-print">Every admin action also requires the staff member to complete two-factor authentication on their own account.</p>
      {error && <p className="form-error">{error}</p>}
      <form className="stack-form admin-inline-form" action={assignStaff}>
        <div className="form-row">
          <label>Staff email (must already have a confirmed account)<input name="email" type="email" required /></label>
          <label>Role
            <select name="roleId" required defaultValue="">
              <option value="" disabled>Choose a role</option>
              {(roles ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
        </div>
        <button className="button button-dark" type="submit">Grant access</button>
      </form>
      <table className="admin-table">
        <thead><tr><th>Person</th><th>Role</th><th></th></tr></thead>
        <tbody>
          {(assignments ?? []).length === 0 ? (
            <tr><td colSpan={3}>No staff assigned yet.</td></tr>
          ) : (assignments ?? []).map((a) => {
            const person = profileById.get(a.user_id);
            return (
              <tr key={`${a.user_id}-${a.role_id}`}>
                <td>{person?.full_name || person?.email || a.user_id}</td>
                <td>{a.roles?.name}</td>
                <td className="admin-row-actions">
                  <form action={revokeStaff.bind(null, person?.email ?? "", a.role_id)}>
                    <button className="text-link" type="submit">Revoke</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
