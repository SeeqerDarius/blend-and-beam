import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/catalog";
import { formatDateTime } from "@/lib/admin/format";
import { orderStatusLabels } from "@/lib/admin/orders";

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; payment?: string }> }) {
  const ctx = await requireAdmin();
  const canView = ["orders.manage", "reports.read", "payments.read"].some((p) => ctx.permissions.includes(p as never));
  if (!canView) {
    return <><p className="eyebrow">ORDERS</p><h2>No access</h2><p>Your role does not include order visibility.</p></>;
  }

  const { status, payment } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("orders").select("id,order_number,user_id,guest_email,status,payment_status,total_minor,created_at").order("created_at", { ascending: false }).limit(100);
  if (status) query = query.eq("status", status as never);
  if (payment) query = query.eq("payment_status", payment as never);
  const { data: orders } = await query;

  const userIds = [...new Set((orders ?? []).map((o) => o.user_id).filter((id): id is string => !!id))];
  const { data: profileRows } = userIds.length ? await supabase.from("profiles").select("id,email").in("id", userIds) : { data: [] as { id: string; email: string | null }[] };
  const emailByUser = new Map((profileRows ?? []).map((p) => [p.id, p.email]));

  return (
    <>
      <p className="eyebrow">FULFILMENT</p>
      <h2>Orders</h2>
      <form className="admin-filters">
        <select name="status" defaultValue={status ?? ""}>
          <option value="">All fulfilment statuses</option>
          {Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select name="payment" defaultValue={payment ?? ""}>
          <option value="">All payment statuses</option>
          {["pending", "processing", "paid", "failed", "cancelled", "refunded", "partially_refunded"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className="button secondary" type="submit">Filter</button>
      </form>
      <table className="admin-table">
        <thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Payment</th><th>Fulfilment</th><th>Total</th></tr></thead>
        <tbody>
          {(orders ?? []).length === 0 ? (
            <tr><td colSpan={6}>No orders match.</td></tr>
          ) : (orders ?? []).map((order) => (
            <tr key={order.id}>
              <td><Link href={`/admin/orders/${order.id}`}>{order.order_number}</Link></td>
              <td>{(order.user_id && emailByUser.get(order.user_id)) || order.guest_email || "Guest"}</td>
              <td>{formatDateTime(order.created_at)}</td>
              <td>{order.payment_status}</td>
              <td>{orderStatusLabels[order.status]}</td>
              <td>{money(order.total_minor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
