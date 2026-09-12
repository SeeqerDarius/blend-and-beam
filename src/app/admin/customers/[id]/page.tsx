import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/catalog";
import { formatDate, formatDateTime } from "@/lib/admin/format";
import { orderStatusLabels } from "@/lib/admin/orders";

export default async function AdminCustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin("customers.read");
  const { id } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!profile) notFound();

  const { data: addresses } = await supabase.from("addresses").select("*").eq("user_id", id);
  const canSeeOrders = ["orders.manage", "reports.read", "payments.read"].some((p) => ctx.permissions.includes(p as never));
  const { data: orders } = canSeeOrders
    ? await supabase.from("orders").select("id,order_number,status,payment_status,total_minor,created_at").eq("user_id", id).order("created_at", { ascending: false })
    : { data: null };

  return (
    <>
      <p className="eyebrow">CUSTOMER</p>
      <h2>{profile.full_name || profile.email}</h2>
      <p>{profile.email}<br />{profile.phone}<br />Joined {formatDate(profile.created_at)}</p>

      <h3>Addresses</h3>
      {(addresses ?? []).length === 0 ? <p className="fine-print">No saved addresses.</p> : (
        <ul>
          {(addresses ?? []).map((a) => (
            <li key={a.id}>{a.full_name}, {a.address_line}, {a.city}, {a.region} · {a.phone}{a.is_default ? " (default)" : ""}</li>
          ))}
        </ul>
      )}

      <h3>Orders</h3>
      {!canSeeOrders ? (
        <p className="fine-print">Your role does not include order visibility.</p>
      ) : (orders ?? []).length === 0 ? (
        <p className="fine-print">No orders yet.</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>Order</th><th>Placed</th><th>Payment</th><th>Fulfilment</th><th>Total</th></tr></thead>
          <tbody>
            {(orders ?? []).map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/orders/${o.id}`}>{o.order_number}</Link></td>
                <td>{formatDateTime(o.created_at)}</td>
                <td>{o.payment_status}</td>
                <td>{orderStatusLabels[o.status]}</td>
                <td>{money(o.total_minor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
