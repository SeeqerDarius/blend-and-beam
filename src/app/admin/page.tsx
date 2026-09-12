import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/catalog";
import { daysAgo } from "@/lib/admin/format";
import { orderStatusLabels } from "@/lib/admin/orders";

export default async function AdminOverview() {
  const ctx = await requireAdmin("admin.access");
  const supabase = await createClient();

  const canSeeOrders = ["orders.manage", "reports.read", "payments.read"].some((p) => ctx.permissions.includes(p as never));
  const canSeeCustomers = ctx.permissions.includes("customers.read");
  const canSeeInventory = ["inventory.manage", "products.manage", "reports.read"].some((p) => ctx.permissions.includes(p as never));

  const thirtyDaysAgo = daysAgo(30);

  const [ordersResult, customersResult, inventoryResult] = await Promise.all([
    canSeeOrders
      ? supabase.from("orders").select("id,order_number,user_id,guest_email,status,payment_status,total_minor,created_at").order("created_at", { ascending: false }).limit(8)
      : Promise.resolve({ data: null }),
    canSeeCustomers ? supabase.from("profiles").select("id", { count: "exact", head: true }) : Promise.resolve({ count: null }),
    canSeeInventory ? supabase.from("inventory").select("quantity,low_stock_threshold") : Promise.resolve({ data: null }),
  ]);

  const recentOrders = ordersResult.data ?? [];
  const userIds = [...new Set(recentOrders.map((o) => o.user_id).filter((id): id is string => !!id))];
  const { data: profileRows } = userIds.length && canSeeCustomers
    ? await supabase.from("profiles").select("id,email").in("id", userIds)
    : { data: [] as { id: string; email: string | null }[] };
  const emailByUser = new Map((profileRows ?? []).map((p) => [p.id, p.email]));

  let revenue30d = 0;
  let orders30d = 0;
  if (canSeeOrders) {
    const { data: recentWindow } = await supabase.from("orders").select("total_minor,payment_status,created_at").gte("created_at", thirtyDaysAgo);
    for (const row of recentWindow ?? []) {
      orders30d += 1;
      if (row.payment_status === "paid") revenue30d += row.total_minor;
    }
  }

  const lowStockCount = (inventoryResult.data ?? []).filter((row) => row.quantity <= row.low_stock_threshold).length;

  const metrics: Array<[string, string, boolean]> = [
    ["Revenue (30d)", money(revenue30d), canSeeOrders],
    ["Orders (30d)", String(orders30d), canSeeOrders],
    ["Customers", String(customersResult.count ?? 0), canSeeCustomers],
    ["Low stock", String(lowStockCount), canSeeInventory],
  ];

  return (
    <>
      <p className="eyebrow">OPERATIONS</p>
      <h2>Good morning</h2>
      <p>Live figures below. No demonstration sales are mixed into business reporting.</p>
      <div className="metric-grid">
        {metrics.map(([label, value, unlocked]) => (
          <div className="metric" key={label}>
            <small>{label}</small>
            <strong>{unlocked ? value : "—"}</strong>
          </div>
        ))}
      </div>
      <h3>Recent orders</h3>
      {!canSeeOrders ? (
        <div className="empty-state"><strong>No access</strong><p>Your role does not include order visibility.</p></div>
      ) : (
        <table className="admin-table">
          <thead><tr><th>Order</th><th>Customer</th><th>Payment</th><th>Fulfilment</th><th>Total</th></tr></thead>
          <tbody>
            {recentOrders.length === 0 ? (
              <tr><td colSpan={5}>No orders yet. Your first paid order will appear here.</td></tr>
            ) : recentOrders.map((order) => (
              <tr key={order.id}>
                <td><Link href={`/admin/orders/${order.id}`}>{order.order_number}</Link></td>
                <td>{(order.user_id && emailByUser.get(order.user_id)) || order.guest_email || "Guest"}</td>
                <td>{order.payment_status}</td>
                <td>{orderStatusLabels[order.status]}</td>
                <td>{money(order.total_minor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
