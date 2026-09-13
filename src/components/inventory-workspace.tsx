import Image from "next/image";
import { requireStaff } from "@/lib/admin-auth";
import { InventorySelector } from "@/components/inventory-selector";
import { SubmitButton } from "@/components/submit-button";
import { adjustStock } from "@/app/admin/actions";
export async function InventoryWorkspace({
  query,
}: {
  query: { q?: string; saved?: string; error?: string; page?: string };
}) {
  const { db } = await requireStaff("inventory.manage");
  const page = Math.max(1, Math.min(10000, Number(query.page) || 1));
  const [stock, products, variants] = await Promise.all([
    db
      .from("inventory")
      .select(
        "id,product_id,variant_id,quantity,low_stock_threshold,updated_at",
        { count: "exact" },
      )
      .order("quantity")
      .range((page - 1) * 50, page * 50 - 1),
    db
      .from("products")
      .select("id,name,sku,product_images(path,alt_text,sort_order)")
      .order("name")
      .limit(1000),
    db.from("product_variants").select("id,name,product_id").limit(1000),
  ]);
  if (stock.error || products.error || variants.error)
    throw new Error("Inventory could not be loaded. Please retry.");
  const productMap = new Map(products.data.map((p) => [p.id, p]));
  const variantMap = new Map(variants.data.map((v) => [v.id, v]));
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return (
    <>
      <p className="eyebrow">STOCK CONTROL</p>
      <h1>Inventory</h1>
      {query.saved && <p role="status">Stock adjustment recorded.</p>}
      {query.error && <p role="alert">{query.error.slice(0, 300)}</p>}
      <p>
        Find stock by product name or SKU. Adjustments are atomic and recorded
        with your account and reason.
      </p>
      <div className="table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              {[
                "Product",
                "SKU",
                "Variant",
                "Quantity",
                "Low-stock threshold",
                "Stock status",
                "Last updated",
                "Action",
              ].map((s) => (
                <th key={s} scope="col">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stock.data.map((row) => {
              const p = productMap.get(row.product_id ?? "");
              const image = [...(p?.product_images ?? [])].sort(
                (a, b) => a.sort_order - b.sort_order,
              )[0];
              return (
                <tr key={row.id}>
                  <td>
                    <div className="inventory-product">
                      {image && (
                        <Image
                          src={`${base}/storage/v1/object/public/products/${image.path.split("/").map(encodeURIComponent).join("/")}`}
                          alt={image.alt_text}
                          width={60}
                          height={80}
                          style={{ objectFit: "contain" }}
                        />
                      )}
                      <strong>{p?.name ?? "Product unavailable"}</strong>
                    </div>
                  </td>
                  <td>{p?.sku ?? "—"}</td>
                  <td>
                    {variantMap.get(row.variant_id ?? "")?.name ??
                      "Base product"}
                  </td>
                  <td>{row.quantity}</td>
                  <td>{row.low_stock_threshold}</td>
                  <td>
                    {row.quantity <= 0
                      ? "Out of stock"
                      : row.quantity <= row.low_stock_threshold
                        ? "Low stock"
                        : "In stock"}
                  </td>
                  <td>
                    {new Intl.DateTimeFormat("en-GH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Africa/Accra",
                    }).format(new Date(row.updated_at))}
                  </td>
                  <td>
                    <a href={`#adjust-${row.id}`}>
                      Adjust {p?.name ?? "stock"}
                    </a>
                    <details id={`adjust-${row.id}`}>
                      <summary>Adjust</summary>
                      <form action={adjustStock} className="operations-form">
                        <input
                          type="hidden"
                          name="product"
                          value={row.product_id ?? ""}
                        />
                        <input
                          type="hidden"
                          name="variant"
                          value={row.variant_id ?? ""}
                        />
                        <label>
                          Quantity change
                          <input
                            type="number"
                            name="delta"
                            min={-100000}
                            max={100000}
                            required
                          />
                        </label>
                        <label>
                          Reason
                          <input
                            name="reason"
                            minLength={5}
                            maxLength={500}
                            required
                          />
                        </label>
                        <SubmitButton>Record adjustment</SubmitButton>
                      </form>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!stock.data.length && (
        <p>No inventory rows yet. Record initial stock below.</p>
      )}
      <p>
        Page {page} · {stock.count ?? 0} stock records{" "}
        {page > 1 && <a href={`?page=${page - 1}`}>Previous</a>}{" "}
        {(stock.count ?? 0) > page * 50 && (
          <a href={`?page=${page + 1}`}>Next</a>
        )}
      </p>
      <h2>Record stock adjustment</h2>
      <form action={adjustStock} className="operations-form operations-card">
        <InventorySelector products={products.data} variants={variants.data} />
        <label>
          Quantity change
          <input
            name="delta"
            type="number"
            min={-100000}
            max={100000}
            required
          />
        </label>
        <label>
          Reason
          <input name="reason" minLength={5} maxLength={500} required />
        </label>
        <SubmitButton>Record adjustment</SubmitButton>
      </form>
    </>
  );
}
