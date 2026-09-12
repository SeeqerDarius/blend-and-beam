import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/catalog";
import { formatDateTime } from "@/lib/admin/format";

export default async function AdminPayments() {
  await requireAdmin("payments.read");
  const supabase = await createClient();
  const { data: payments } = await supabase
    .from("payments")
    .select("id,order_id,provider,reference,status,amount_minor,verified_at,created_at,orders(order_number)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <p className="eyebrow">PAYMENTS</p>
      <h2>Payment records</h2>
      <p className="fine-print">Raw provider webhook events are retained for audits and are not shown here.</p>
      <table className="admin-table">
        <thead><tr><th>Order</th><th>Provider</th><th>Reference</th><th>Status</th><th>Amount</th><th>Verified</th></tr></thead>
        <tbody>
          {(payments ?? []).length === 0 ? (
            <tr><td colSpan={6}>No payments recorded yet.</td></tr>
          ) : (payments ?? []).map((p) => (
            <tr key={p.id}>
              <td><Link href={`/admin/orders/${p.order_id}`}>{p.orders?.order_number ?? p.order_id}</Link></td>
              <td>{p.provider}</td>
              <td>{p.reference}</td>
              <td>{p.status}</td>
              <td>{money(p.amount_minor)}</td>
              <td>{p.verified_at ? formatDateTime(p.verified_at) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
