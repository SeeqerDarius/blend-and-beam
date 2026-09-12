import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/catalog";
import { formatDateTime } from "@/lib/admin/format";
import { allowedTransitions, orderStatusLabels } from "@/lib/admin/orders";
import type { Database } from "@/lib/supabase/types";
import { transitionOrder, saveOrderNote } from "../actions";

type OrderDetail = {
  order: Database["public"]["Tables"]["orders"]["Row"];
  items: Database["public"]["Tables"]["order_items"]["Row"][];
  history: Database["public"]["Tables"]["order_status_history"]["Row"][];
  payments: Database["public"]["Tables"]["payments"]["Row"][];
};

export default async function AdminOrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const ctx = await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_order", { p_order: id });
  const detail = data as unknown as OrderDetail | null;
  if (!detail?.order) notFound();
  const { order, items, history, payments } = detail;

  const canManage = ctx.permissions.includes("orders.manage");
  const customer = order.user_id
    ? (await supabase.from("profiles").select("email,full_name,phone").eq("id", order.user_id).maybeSingle()).data
    : null;
  const nextStatuses = allowedTransitions[order.status];
  const shipping = order.shipping_address as { full_name?: string; address_line?: string; city?: string; region?: string; phone?: string } | null;

  return (
    <>
      <p className="eyebrow">ORDER</p>
      <h2>{order.order_number}</h2>
      {error && <p className="form-error">{error}</p>}
      <div className="metric-grid">
        <div className="metric"><small>Fulfilment</small><strong>{orderStatusLabels[order.status]}</strong></div>
        <div className="metric"><small>Payment</small><strong>{order.payment_status}</strong></div>
        <div className="metric"><small>Total</small><strong>{money(order.total_minor)}</strong></div>
        <div className="metric"><small>Placed</small><strong>{formatDateTime(order.created_at)}</strong></div>
      </div>

      <h3>Customer</h3>
      <p>{customer?.full_name || customer?.email || order.guest_email || "Guest"}<br />{customer?.phone || order.guest_phone}</p>
      {shipping && <p className="fine-print">{shipping.full_name}, {shipping.address_line}, {shipping.city}, {shipping.region} · {shipping.phone}</p>}

      <h3>Items</h3>
      <table className="admin-table">
        <thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}><td>{item.product_name}</td><td>{item.sku}</td><td>{item.quantity}</td><td>{money(item.unit_price_minor)}</td><td>{money(item.total_minor)}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="fine-print">Subtotal {money(order.subtotal_minor)} · Discount {money(order.discount_minor)} · Shipping {money(order.shipping_minor)} · Tax {money(order.tax_minor)}</p>

      {payments.length > 0 && (
        <>
          <h3>Payments</h3>
          <table className="admin-table">
            <thead><tr><th>Reference</th><th>Provider</th><th>Status</th><th>Amount</th><th>Verified</th></tr></thead>
            <tbody>{payments.map((p) => <tr key={p.id}><td>{p.reference}</td><td>{p.provider}</td><td>{p.status}</td><td>{money(p.amount_minor)}</td><td>{p.verified_at ? formatDateTime(p.verified_at) : "—"}</td></tr>)}</tbody>
          </table>
        </>
      )}

      <h3>Status history</h3>
      {history.length === 0 ? <p className="fine-print">No status changes recorded yet.</p> : (
        <ul>
          {history.map((h) => <li key={h.id}>{formatDateTime(h.created_at)} — {orderStatusLabels[h.status]}{h.note ? `: ${h.note}` : ""}</li>)}
        </ul>
      )}

      {canManage && (
        <>
          {nextStatuses.length > 0 ? (
            <>
              <h3>Update status</h3>
              <form className="stack-form" action={transitionOrder.bind(null, order.id)}>
                <label>Next status
                  <select name="status" required defaultValue="">
                    <option value="" disabled>Choose next status</option>
                    {nextStatuses.map((s) => <option key={s} value={s}>{orderStatusLabels[s]}</option>)}
                  </select>
                </label>
                <label>Note (required)<textarea name="note" required minLength={5} maxLength={500} rows={2} /></label>
                {order.payment_status !== "paid" && <p className="fine-print">Only cancellation is available until payment is verified.</p>}
                <button className="button button-dark" type="submit">Update status</button>
              </form>
            </>
          ) : <p className="fine-print">This order is in a final state.</p>}

          <h3>Internal note</h3>
          <form className="stack-form" action={saveOrderNote.bind(null, order.id)}>
            <textarea name="adminNote" defaultValue={order.admin_note ?? ""} rows={3} maxLength={2000} placeholder="Visible to staff only" />
            <button className="button secondary" type="submit">Save note</button>
          </form>
        </>
      )}
    </>
  );
}
