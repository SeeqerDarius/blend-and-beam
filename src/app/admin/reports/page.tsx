import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/catalog";
import { daysAgo } from "@/lib/admin/format";

export default async function AdminReports() {
  await requireAdmin("reports.read");
  const supabase = await createClient();
  const since = daysAgo(30);

  const { data: orders } = await supabase.from("orders").select("id,total_minor,payment_status,created_at").gte("created_at", since);
  const paidOrders = (orders ?? []).filter((o) => o.payment_status === "paid");

  const revenueByDay = new Map<string, number>();
  for (const order of paidOrders) {
    const day = order.created_at.slice(0, 10);
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + order.total_minor);
  }
  const days = [...revenueByDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const maxRevenue = Math.max(1, ...days.map(([, total]) => total));

  const orderIds = paidOrders.map((o) => o.id);
  const { data: items } = orderIds.length
    ? await supabase.from("order_items").select("product_name,quantity,total_minor").in("order_id", orderIds)
    : { data: [] as { product_name: string; quantity: number; total_minor: number }[] };
  const byProduct = new Map<string, { quantity: number; revenue: number }>();
  for (const item of items ?? []) {
    const stat = byProduct.get(item.product_name) ?? { quantity: 0, revenue: 0 };
    stat.quantity += item.quantity;
    stat.revenue += item.total_minor;
    byProduct.set(item.product_name, stat);
  }
  const topProducts = [...byProduct.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 8);
  const totalRevenue = days.reduce((sum, [, total]) => sum + total, 0);

  return (
    <>
      <p className="eyebrow">PERFORMANCE</p>
      <h2>Reports</h2>
      <div className="metric-grid">
        <div className="metric"><small>Revenue (30d)</small><strong>{money(totalRevenue)}</strong></div>
        <div className="metric"><small>Paid orders (30d)</small><strong>{paidOrders.length}</strong></div>
      </div>

      <h3>Revenue by day</h3>
      {days.length === 0 ? <p className="fine-print">No paid orders in the last 30 days yet.</p> : (
        <div className="report-bars">
          {days.map(([day, total]) => (
            <div className="report-bar" key={day} title={`${day}: ${money(total)}`}>
              <div className="report-bar-fill" style={{ height: `${Math.max(4, (total / maxRevenue) * 100)}%` }} />
              <small>{day.slice(5)}</small>
            </div>
          ))}
        </div>
      )}

      <h3>Top products by revenue</h3>
      {topProducts.length === 0 ? <p className="fine-print">No sales yet.</p> : (
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Units sold</th><th>Revenue</th></tr></thead>
          <tbody>
            {topProducts.map(([name, stat]) => (
              <tr key={name}><td>{name}</td><td>{stat.quantity}</td><td>{money(stat.revenue)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
