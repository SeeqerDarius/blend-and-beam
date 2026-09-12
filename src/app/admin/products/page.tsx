import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/catalog";
import { setProductStatus } from "./actions";

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdmin("products.manage");
  const { q, status } = await searchParams;
  const supabase = await createClient();
  const { data: products, error } = await supabase.rpc("admin_products");

  const filtered = (products ?? []).filter((p) => {
    if (status && p.status !== status) return false;
    if (q && !`${p.name} ${p.sku}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">CATALOG</p>
          <h2>Products</h2>
        </div>
        <Link className="button button-dark" href="/admin/products/new">+ New product</Link>
      </div>
      <form className="admin-filters">
        <input name="q" defaultValue={q} placeholder="Search name or SKU" />
        <select name="status" defaultValue={status ?? ""}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <button className="button secondary" type="submit">Filter</button>
      </form>
      {error && <p className="form-error">{error.message}</p>}
      <table className="admin-table">
        <thead><tr><th>Product</th><th>SKU</th><th>Price</th><th>Status</th><th>Featured</th><th></th></tr></thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={6}>No products match yet. Create the first one.</td></tr>
          ) : filtered.map((p) => (
            <tr key={p.id}>
              <td><Link href={`/admin/products/${p.id}`}>{p.name}</Link></td>
              <td>{p.sku}</td>
              <td>{money(p.price_minor)}</td>
              <td><span className={`pill pill-${p.status}`}>{p.status}</span></td>
              <td>{p.is_featured ? "★" : ""}</td>
              <td className="admin-row-actions">
                {p.status !== "active" && (
                  <form action={setProductStatus.bind(null, p.id, "active")}><button className="text-link" type="submit">Publish</button></form>
                )}
                {p.status !== "archived" && (
                  <form action={setProductStatus.bind(null, p.id, "archived")}><button className="text-link" type="submit">Archive</button></form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
