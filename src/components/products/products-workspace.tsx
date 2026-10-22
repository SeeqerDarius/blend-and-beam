import Image from "next/image";
import Link from "next/link";
import Form from "next/form";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin-auth";
import { money } from "@/lib/catalog";
import { isBackgroundRemovalConfigured } from "@/lib/hosted-background-removal";
import { cropSchema } from "@/lib/image-preparation";
import { productImageUrl, type AdminProductImage } from "@/lib/product-images";
import { PRODUCT_STATUSES, searchTerm, type ProductStatus } from "@/lib/product-form";
import { ProductEditor, type ProductInitial } from "@/components/products/product-editor";

export type ProductsQuery = { q?: string; status?: string; category?: string; sort?: string; page?: string; edit?: string; new?: string; created?: string; deleted?: string };
const PAGE_SIZE = 25;
const SORTS = {
  updated: { label: "Recently updated", column: "updated_at", ascending: false },
  name: { label: "Name A–Z", column: "name", ascending: true },
  price_low: { label: "Price, low to high", column: "price_minor", ascending: true },
  price_high: { label: "Price, high to low", column: "price_minor", ascending: false },
} as const;
type SortKey = keyof typeof SORTS;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ghs(minor: number | null | undefined) {
  return minor == null ? "" : (Number(minor) / 100).toFixed(2);
}

export async function ProductsWorkspace({ query }: { query: ProductsQuery }) {
  const { db } = await requireStaff("products.manage");
  const term = searchTerm(query.q);
  const status = PRODUCT_STATUSES.includes(query.status as ProductStatus) ? (query.status as ProductStatus) : undefined;
  const category = query.category && UUID.test(query.category) ? query.category : undefined;
  const sortKey: SortKey = query.sort && query.sort in SORTS ? (query.sort as SortKey) : "updated";
  const page = Math.min(10000, Math.max(1, Math.floor(Number(query.page)) || 1));
  const listParams = new URLSearchParams();
  if (term) listParams.set("q", term);
  if (status) listParams.set("status", status);
  if (category) listParams.set("category", category);
  if (sortKey !== "updated") listParams.set("sort", sortKey);
  if (page > 1) listParams.set("page", String(page));
  const listHref = `/admin/products${listParams.size ? `?${listParams}` : ""}`;
  const withParams = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(listParams);
    for (const [k, v] of Object.entries(extra)) if (v === undefined) p.delete(k);
    else p.set(k, v);
    return `/admin/products${p.size ? `?${p}` : ""}`;
  };

  const [categoryResult, brandResult, countResults] = await Promise.all([
    db.from("categories").select("id,name").order("sort_order").order("name").limit(500),
    db.from("brands").select("id,name").order("name").limit(500),
    Promise.all(
      [undefined, ...PRODUCT_STATUSES].map((s) => {
        const q = db.rpc("admin_products", undefined, { count: "exact", head: true });
        return s ? q.eq("status", s) : q;
      }),
    ),
  ]);
  const categories = categoryResult.data ?? [];
  const brands = brandResult.data ?? [];
  const counts = Object.fromEntries([["all", countResults[0].count ?? 0], ...PRODUCT_STATUSES.map((s, i) => [s, countResults[i + 1].count ?? 0])]) as Record<string, number>;

  let categoryIds: string[] | null = null;
  let loadError = Boolean(categoryResult.error || brandResult.error || countResults.some((r) => r.error));
  if (category && !loadError) {
    const links = await db.from("product_categories").select("product_id").eq("category_id", category).limit(5000);
    if (links.error) loadError = true;
    else categoryIds = links.data.map((l) => l.product_id);
  }

  type ListRow = { id: string; name: string; slug: string; sku: string; price_minor: number; compare_at_minor: number | null; status: ProductStatus; track_inventory: boolean; updated_at: string };
  let rows: ListRow[] = [];
  let total = 0;
  if (!loadError && !(categoryIds && !categoryIds.length)) {
    const sort = SORTS[sortKey];
    let list = db
      .rpc("admin_products", undefined, { count: "exact" })
      .select("id,name,slug,sku,price_minor,compare_at_minor,status,track_inventory,updated_at");
    if (status) list = list.eq("status", status);
    if (term) list = list.or(`name.ilike.%${term}%,sku.ilike.%${term}%,slug.ilike.%${term}%`);
    if (categoryIds) list = list.in("id", categoryIds);
    const result = await list
      .order(sort.column, { ascending: sort.ascending })
      .order("id")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (result.error) loadError = true;
    else {
      rows = result.data as unknown as ListRow[];
      total = result.count ?? 0;
    }
  }

  const ids = rows.map((r) => r.id);
  const [imageRows, linkRows, stockRows, variantRows] = ids.length
    ? await Promise.all([
        db.from("product_images").select("product_id,path,alt_text,sort_order").in("product_id", ids).order("sort_order"),
        db.from("product_categories").select("product_id,category_id").in("product_id", ids),
        db.from("inventory").select("product_id,quantity,low_stock_threshold").in("product_id", ids).is("variant_id", null),
        db.from("product_variants").select("product_id").in("product_id", ids),
      ])
    : [null, null, null, null];
  const thumbs = new Map<string, { url: string; alt: string; count: number }>();
  for (const image of imageRows?.data ?? []) {
    const existing = thumbs.get(image.product_id);
    if (existing) existing.count++;
    else thumbs.set(image.product_id, { url: productImageUrl(image.path), alt: image.alt_text, count: 1 });
  }
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const productCategories = new Map<string, string[]>();
  for (const link of linkRows?.data ?? []) productCategories.set(link.product_id, [...(productCategories.get(link.product_id) ?? []), categoryName.get(link.category_id) ?? "Hidden category"]);
  const stock = new Map((stockRows?.data ?? []).map((s) => [s.product_id!, s]));
  const variantCount = new Map<string, number>();
  for (const v of variantRows?.data ?? []) variantCount.set(v.product_id, (variantCount.get(v.product_id) ?? 0) + 1);

  const editor = query.new === "1" ? await newProduct() : query.edit ? await existingProduct(query.edit) : null;
  const filtered = Boolean(term || status || category);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function newProduct() {
    const initial: ProductInitial = { name: "", slug: "", sku: "", price: "", compareAt: "", cost: "", brand_id: "", categories: category ? [category] : [], description: "", warranty: "", seo_title: "", seo_description: "", status: "draft", is_featured: false, is_best_seller: false, track_inventory: true };
    return { mode: "create" as const, product: initial, images: [], variants: [], stock: null };
  }

  async function existingProduct(id: string) {
    if (!UUID.test(id)) notFound();
    const [product, links, images, variants, inventory] = await Promise.all([
      db.rpc("admin_product", { p_id: id }),
      db.from("product_categories").select("category_id").eq("product_id", id),
      db.from("product_images").select("id,path,original_path,alt_text,width,height,preparation").eq("product_id", id).order("sort_order").order("id"),
      db.from("product_variants").select("id,name,sku,price_minor,status").eq("product_id", id).order("name"),
      db.from("inventory").select("quantity,low_stock_threshold").eq("product_id", id).is("variant_id", null).maybeSingle(),
    ]);
    if (product.error || !product.data?.id) notFound();
    if (links.error || images.error || variants.error) throw new Error("This product's details could not be loaded. Please retry.");
    const p = product.data;
    const initial: ProductInitial = {
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      price: ghs(p.price_minor),
      // Older records stored 0 to mean "no compare-at price".
      compareAt: p.compare_at_minor ? ghs(p.compare_at_minor) : "",
      cost: ghs(p.cost_minor),
      brand_id: p.brand_id ?? "",
      categories: links.data.map((l) => l.category_id),
      description: p.description ?? "",
      warranty: p.warranty ?? "",
      seo_title: p.seo_title ?? "",
      seo_description: p.seo_description ?? "",
      status: p.status,
      is_featured: p.is_featured,
      is_best_seller: p.is_best_seller,
      track_inventory: p.track_inventory,
    };
    const adminImages: AdminProductImage[] = images.data.map((row) => {
      const prep = cropSchema.safeParse(row.preparation ?? {});
      return {
        id: row.id,
        url: productImageUrl(row.path),
        originalUrl: productImageUrl(row.original_path ?? row.path),
        alt: row.alt_text,
        width: row.width,
        height: row.height,
        preparation: prep.success ? { rotation: prep.data.rotation, crop: prep.data.crop, backgroundRemoval: prep.data.backgroundRemoval } : { rotation: 0, crop: null, backgroundRemoval: "keep" },
      };
    });
    return {
      mode: "edit" as const,
      product: initial,
      images: adminImages,
      variants: variants.data,
      stock: inventory.data ? { quantity: inventory.data.quantity, low: inventory.data.low_stock_threshold } : null,
    };
  }

  const notice =
    query.created === "1" ? "Product created. You can keep editing it here." : query.created === "partial" ? "Product created, but some details need another save. Check brand, compare-at price and categories." : undefined;

  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">CATALOG</p>
          <h1>Products</h1>
          <p className="field-hint">Prices are in Ghana cedis (GHS). Cost is staff-only. Archive products that have sold instead of deleting them.</p>
        </div>
        <Link href={withParams({ new: "1", edit: undefined })} className="button button-dark" scroll={false}>
          Add product
        </Link>
      </div>

      {query.deleted && (
        <p role="status" className="operations-notice">
          Product deleted.{query.deleted === "files" ? " Some image files could not be removed from storage." : ""}
        </p>
      )}

      <nav className="status-tabs" aria-label="Filter by status">
        {[["all", "All"], ...PRODUCT_STATUSES.map((s) => [s, s[0].toUpperCase() + s.slice(1)])].map(([key, label]) => {
          const current = (status ?? "all") === key;
          return (
            <Link key={key} href={withParams({ status: key === "all" ? undefined : key, page: undefined })} aria-current={current ? "page" : undefined} className={current ? "is-current" : undefined}>
              {label} <span>{counts[key]}</span>
            </Link>
          );
        })}
      </nav>

      <Form action="/admin/products" className="product-filters" role="search" aria-label="Search products">
        {status && <input type="hidden" name="status" value={status} />}
        <label className="grow">
          Search
          <input type="search" name="q" defaultValue={term} placeholder="Name, SKU or URL slug" />
        </label>
        <label>
          Category
          <select name="category" defaultValue={category ?? ""}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select name="sort" defaultValue={sortKey}>
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="button button-dark">
          Apply
        </button>
        {filtered && (
          <Link href="/admin/products" className="text-link">
            Clear filters
          </Link>
        )}
      </Form>

      {loadError ? (
        <div role="alert" className="state-panel">
          <h2>Products couldn&apos;t be loaded</h2>
          <p>The connection to the catalog may have been interrupted. Your data is safe.</p>
          <Link href={listHref} className="button button-dark">
            Try again
          </Link>
        </div>
      ) : rows.length === 0 ? (
        <div className="state-panel">
          {filtered ? (
            <>
              <h2>No products match these filters</h2>
              <p>Try a different search term, status or category.</p>
              <Link href="/admin/products" className="button button-dark">
                Clear filters
              </Link>
            </>
          ) : (
            <>
              <h2>No products yet</h2>
              <p>Add your first product with its price, images and category. Save it as a draft until it&apos;s ready to sell.</p>
              <Link href={withParams({ new: "1" })} className="button button-dark" scroll={false}>
                Add product
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="result-count" aria-live="polite">
            {total} product{total === 1 ? "" : "s"}
            {filtered ? " match" : ""}
            {pages > 1 ? ` · page ${page} of ${pages}` : ""}
          </p>
          <div className="table-scroll product-table-wrap">
            <table className="admin-table product-table">
              <caption className="sr-only">Products</caption>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">SKU</th>
                  <th scope="col">Price</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const thumb = thumbs.get(r.id);
                  const s = stock.get(r.id);
                  const variants = variantCount.get(r.id) ?? 0;
                  const cats = productCategories.get(r.id) ?? [];
                  return (
                    <tr key={r.id}>
                      <td data-label="Product">
                        <div className="product-cell">
                          <div className="product-thumb checkerboard">
                            {thumb ? <Image src={thumb.url} alt={thumb.alt} width={56} height={56} /> : <span aria-label="No image">—</span>}
                          </div>
                          <div>
                            <Link href={withParams({ edit: r.id, new: undefined })} scroll={false} className="product-name">
                              {r.name}
                            </Link>
                            <small>
                              {cats.length ? cats.join(", ") : "Uncategorised"}
                              {" · "}
                              {thumb ? `${thumb.count} image${thumb.count === 1 ? "" : "s"}` : "No images"}
                              {variants ? ` · ${variants} variant${variants === 1 ? "" : "s"}` : ""}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td data-label="SKU">
                        <code>{r.sku}</code>
                      </td>
                      <td data-label="Price">
                        {money(r.price_minor)}
                        {r.compare_at_minor && r.compare_at_minor > r.price_minor ? (
                          <small className="compare-price">
                            <del>{money(r.compare_at_minor)}</del>
                          </small>
                        ) : null}
                      </td>
                      <td data-label="Stock">
                        {!r.track_inventory ? (
                          <span className="muted">Not tracked</span>
                        ) : !s ? (
                          <span className="stock stock-out">No stock recorded</span>
                        ) : s.quantity <= 0 ? (
                          <span className="stock stock-out">Out of stock</span>
                        ) : s.quantity <= s.low_stock_threshold ? (
                          <span className="stock stock-low">{s.quantity} · low</span>
                        ) : (
                          <span className="stock">{s.quantity} in stock</span>
                        )}
                      </td>
                      <td data-label="Status">
                        <span className={`pill pill-${r.status}`}>{r.status}</span>
                      </td>
                      <td className="row-actions">
                        <Link href={withParams({ edit: r.id, new: undefined })} scroll={false} className="button-quiet" aria-label={`Edit ${r.name}`}>
                          Edit
                        </Link>
                        <Link href={`/admin/variants?product=${r.id}`} className="button-quiet" aria-label={`Variants for ${r.name}`}>
                          Variants
                        </Link>
                        {r.status === "active" && (
                          <Link href={`/products/${r.slug}`} className="button-quiet" target="_blank" rel="noopener" aria-label={`View ${r.name} in the store (opens a new tab)`}>
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav className="operations-pagination" aria-label="Product pages">
              {page > 1 ? <Link href={withParams({ page: page === 2 ? undefined : String(page - 1) })}>← Previous</Link> : <span />}
              <span>
                Page {page} of {pages}
              </span>
              {page < pages ? <Link href={withParams({ page: String(page + 1) })}>Next →</Link> : <span />}
            </nav>
          )}
        </>
      )}

      {editor && (
        <ProductEditor
          key={editor.mode === "edit" ? editor.product.id : "new"}
          mode={editor.mode}
          product={editor.product}
          categories={categories}
          brands={brands}
          images={editor.images}
          variants={editor.variants}
          stock={editor.stock}
          backgroundRemovalAvailable={isBackgroundRemovalConfigured()}
          listHref={listHref}
          notice={notice}
        />
      )}
    </>
  );
}
