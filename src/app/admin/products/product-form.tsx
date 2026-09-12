import type { Database } from "@/lib/supabase/types";
import { saveProduct, deleteProductImage } from "./actions";

type Product = Database["public"]["Tables"]["products"]["Row"];
type Category = Pick<Database["public"]["Tables"]["categories"]["Row"], "id" | "name">;
type Brand = Pick<Database["public"]["Tables"]["brands"]["Row"], "id" | "name">;
type ProductImage = Database["public"]["Tables"]["product_images"]["Row"];

export function ProductForm({
  product,
  categories,
  brands,
  selectedCategoryIds,
  images,
  imageBaseUrl,
  error,
}: {
  product: Product | null;
  categories: Category[];
  brands: Brand[];
  selectedCategoryIds: string[];
  images: ProductImage[];
  imageBaseUrl: string;
  error?: string;
}) {
  const minor = (value: number | null | undefined) => (value == null ? "" : (value / 100).toFixed(2));

  return (
    <>
      <p className="eyebrow">{product ? "EDIT PRODUCT" : "NEW PRODUCT"}</p>
      <h2>{product?.name ?? "New product"}</h2>
      {error && <p className="form-error">{error}</p>}
      <form className="stack-form" action={saveProduct} encType="multipart/form-data">
        {product && <input type="hidden" name="id" value={product.id} />}
        <div className="form-row">
          <label>Name<input name="name" defaultValue={product?.name} required /></label>
          <label>SKU<input name="sku" defaultValue={product?.sku} required /></label>
        </div>
        <label>Slug (leave blank to generate from name)<input name="slug" defaultValue={product?.slug} placeholder="marlow-hydraulic-chair" /></label>
        <label>Short description<input name="shortDescription" defaultValue={product?.short_description ?? ""} maxLength={160} /></label>
        <label>Description<textarea name="description" defaultValue={product?.description ?? ""} rows={5} /></label>
        <div className="form-row">
          <label>Price (GH₵)<input name="price" type="number" step="0.01" min="0" defaultValue={minor(product?.price_minor)} required /></label>
          <label>Compare-at price (GH₵)<input name="compareAt" type="number" step="0.01" min="0" defaultValue={minor(product?.compare_at_minor)} /></label>
        </div>
        <div className="form-row">
          <label>Cost (GH₵, internal)<input name="cost" type="number" step="0.01" min="0" defaultValue={minor(product?.cost_minor)} /></label>
          <label>Warranty<input name="warranty" defaultValue={product?.warranty ?? ""} placeholder="12-month warranty" /></label>
        </div>
        <div className="form-row">
          <label>Brand
            <select name="brandId" defaultValue={product?.brand_id ?? ""}>
              <option value="">No brand</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label>Status
            <select name="status" defaultValue={product?.status ?? "draft"}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
        <fieldset className="checkbox-grid">
          <legend>Categories</legend>
          {categories.length === 0 && <p className="fine-print">No categories yet — create one first.</p>}
          {categories.map((c) => (
            <label key={c.id} className="checkbox-label">
              <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={selectedCategoryIds.includes(c.id)} /> {c.name}
            </label>
          ))}
        </fieldset>
        <div className="form-row">
          <label className="checkbox-label"><input type="checkbox" name="isFeatured" defaultChecked={product?.is_featured} /> Featured</label>
          <label className="checkbox-label"><input type="checkbox" name="isBestSeller" defaultChecked={product?.is_best_seller} /> Best seller</label>
        </div>
        <label>Add image<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /></label>
        <button className="button button-dark" type="submit">{product ? "Save changes" : "Create product"}</button>
      </form>
      {product && (
        <>
          <h3>Images</h3>
          {images.length === 0 ? <p className="fine-print">No images uploaded yet.</p> : (
            <div className="admin-image-grid">
              {images.map((img) => (
                <figure key={img.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${imageBaseUrl}/${img.path}`} alt={img.alt_text} />
                  <form action={deleteProductImage.bind(null, img.id, product.id, img.path)}>
                    <button className="text-link" type="submit">Remove</button>
                  </form>
                </figure>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
