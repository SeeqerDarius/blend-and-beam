import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { adjustStock } from "./actions";

export default async function AdminInventory({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin("inventory.manage");
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: inventory } = await supabase
    .from("inventory")
    .select("id,quantity,low_stock_threshold,product_id,variant_id,products(name,sku),product_variants(name)")
    .order("quantity");

  const trackedProductIds = new Set((inventory ?? []).map((row) => row.product_id).filter((id): id is string => !!id));
  const { data: allProducts } = await supabase.from("products").select("id,name,sku").order("name");
  const untracked = (allProducts ?? []).filter((p) => !trackedProductIds.has(p.id));

  return (
    <>
      <p className="eyebrow">STOCK</p>
      <h2>Inventory</h2>
      {error && <p className="form-error">{error}</p>}
      <table className="admin-table">
        <thead><tr><th>Product</th><th>SKU</th><th>On hand</th><th>Threshold</th><th>Adjust</th></tr></thead>
        <tbody>
          {(inventory ?? []).length === 0 ? (
            <tr><td colSpan={5}>No tracked stock yet.</td></tr>
          ) : (inventory ?? []).map((row) => {
            const low = row.quantity <= row.low_stock_threshold;
            const name = row.products?.name ?? "Unknown product";
            const variant = row.product_variants?.name;
            return (
              <tr key={row.id} className={low ? "row-low-stock" : undefined}>
                <td>{name}{variant ? ` — ${variant}` : ""}</td>
                <td>{row.products?.sku}</td>
                <td>{row.quantity}{low && <span className="pill pill-draft"> Low</span>}</td>
                <td>{row.low_stock_threshold}</td>
                <td>
                  <form className="admin-inline-form" action={adjustStock}>
                    <input type="hidden" name="productId" value={row.product_id ?? ""} />
                    {row.variant_id && <input type="hidden" name="variantId" value={row.variant_id} />}
                    <input name="delta" type="number" placeholder="±qty" required style={{ width: 80 }} />
                    <input name="reason" placeholder="Reason (min 5 chars)" required style={{ width: 200 }} />
                    <button className="button secondary" type="submit">Apply</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {untracked.length > 0 && (
        <>
          <h3>Not yet stocked</h3>
          <table className="admin-table">
            <thead><tr><th>Product</th><th>SKU</th><th>Set initial stock</th></tr></thead>
            <tbody>
              {untracked.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.sku}</td>
                  <td>
                    <form className="admin-inline-form" action={adjustStock}>
                      <input type="hidden" name="productId" value={p.id} />
                      <input name="delta" type="number" placeholder="qty" required style={{ width: 80 }} />
                      <input name="reason" defaultValue="Initial stock" required style={{ width: 200 }} />
                      <button className="button secondary" type="submit">Apply</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
