import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/catalog";
import { formatDate } from "@/lib/admin/format";

export default async function AdminCustomers() {
  const ctx = await requireAdmin("customers.read");
  const supabase = await createClient();
  const { data: profiles } = await supabase.from("profiles").select("id,email,full_name,phone,created_at").order("created_at", { ascending: false }).limit(200);

  const canSeeOrders = ["orders.manage", "reports.read", "payments.read"].some((p) => ctx.permissions.includes(p as never));
  const orderStats = new Map<string, { count: number; total: number }>();
  if (canSeeOrders) {
    const { data: orders } = await supabase.from("orders").select("user_id,total_minor").not("user_id", "is", null);
    for (const order of orders ?? []) {
      if (!order.user_id) continue;
      const stat = orderStats.get(order.user_id) ?? { count: 0, total: 0 };
      stat.count += 1;
      stat.total += order.total_minor;
      orderStats.set(order.user_id, stat);
    }
  }

  return (
    <>
      <p className="eyebrow">CUSTOMERS</p>
      <h2>Customers</h2>
      <table className="admin-table">
        <thead><tr><th>Customer</th><th>Phone</th><th>Joined</th>{canSeeOrders && <><th>Orders</th><th>Lifetime value</th></>}</tr></thead>
        <tbody>
          {(profiles ?? []).length === 0 ? (
            <tr><td colSpan={canSeeOrders ? 5 : 3}>No customers yet.</td></tr>
          ) : (profiles ?? []).map((p) => {
            const stat = orderStats.get(p.id);
            return (
              <tr key={p.id}>
                <td><Link href={`/admin/customers/${p.id}`}>{p.full_name || p.email || p.id}</Link></td>
                <td>{p.phone ?? "—"}</td>
                <td>{formatDate(p.created_at)}</td>
                {canSeeOrders && <><td>{stat?.count ?? 0}</td><td>{money(stat?.total ?? 0)}</td></>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
