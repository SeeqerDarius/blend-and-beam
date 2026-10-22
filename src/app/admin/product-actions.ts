"use server";
import { requireStaff } from "@/lib/admin-auth";
import { prepareImage, cropSchema } from "@/lib/image-preparation";
import { removeImageBackground } from "@/lib/hosted-background-removal";
import { parseProductForm, deleteBlockReason, validImageOrder, MAX_PRODUCT_IMAGES, PRODUCT_STATUSES, type ProductFields } from "@/lib/product-form";
import { productImageUrl, type AdminProductImage } from "@/lib/product-images";
import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import type { Json } from "@/lib/supabase/types";

type Db = Awaited<ReturnType<typeof requireStaff>>["db"];
export type ProductResult = { errors?: Record<string, string>; error?: string; id?: string };
export type ImageResult = { error?: string; images?: AdminProductImage[] };

function refreshCatalog() {
  updateTag("catalog");
  revalidatePath("/", "layout");
  revalidatePath("/admin/products");
}

async function cleanupStaleUploads(db: Db) {
  const stale = await db.rpc("expire_product_uploads");
  for (const batch of stale.data ?? []) {
    if (!batch.paths.length) continue;
    const removed = await db.storage.from("products").remove(batch.paths);
    if (!removed.error) await db.from("product_upload_batches").delete().eq("id", batch.id).is("product_id", null);
  }
}

// Category links are a join table; bring them in line with the form's choice.
async function syncCategories(db: Db, productId: string, categories: string[]) {
  const current = await db.from("product_categories").select("category_id").eq("product_id", productId);
  if (current.error) return false;
  const existing = new Set(current.data.map((c) => c.category_id));
  const removed = [...existing].filter((id) => !categories.includes(id));
  const added = categories.filter((id) => !existing.has(id));
  if (removed.length) {
    const r = await db.from("product_categories").delete().eq("product_id", productId).in("category_id", removed);
    if (r.error) return false;
  }
  if (added.length) {
    const r = await db.from("product_categories").insert(added.map((category_id) => ({ product_id: productId, category_id })));
    if (r.error) return false;
  }
  return true;
}

function duplicateErrors(): ProductResult {
  return {
    errors: { sku: "This SKU may already be in use.", slug: "This URL slug may already be in use." },
    error: "Another product already uses this SKU or URL slug.",
  };
}

const stagedImageSchema = z.object({
  path: z.string().max(250),
  original_path: z.string().max(250),
  alt_text: z.string().trim().min(3).max(200),
  sort_order: z.number().int().min(0).max(MAX_PRODUCT_IMAGES - 1),
  preparation: cropSchema,
  width: z.number().int().min(1).max(2400),
  height: z.number().int().min(1).max(2400),
});
export type StagedImage = z.input<typeof stagedImageSchema>;

// Create flow: each image is prepared and stored under the upload session
// before the product exists, then committed atomically with the product.
export async function stageProductImage(form: FormData): Promise<{ error?: string; image?: StagedImage; id?: string }> {
  const { db, user } = await requireStaff("products.manage");
  await cleanupStaleUploads(db);
  const input = z.object({ key: z.uuid(), imageKey: z.uuid(), alt: z.string().trim().min(3).max(200) }).safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Each image needs a description of at least three characters." };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 4 * 1024 * 1024) return { error: "Choose an image under 4 MB." };
  const { key, imageKey, alt } = input.data;
  const attempt = crypto.randomUUID();
  const paths = [`${user.id}/${key}/${imageKey}-${attempt}.webp`, `${user.id}/${key}/${imageKey}-${attempt}-original.webp`];
  const registered = await db.rpc("register_product_upload", { p_key: key, p_paths: paths });
  if (registered.error) return { error: "Upload session could not be registered." };
  if (registered.data) return { id: registered.data };
  try {
    const options = cropSchema.parse(JSON.parse(String(form.get("options"))));
    const bytes = Buffer.from(await file.arrayBuffer());
    const cutout = options.backgroundRemoval === "remove-bg" ? await removeImageBackground(bytes, file.type) : undefined;
    const prepared = await prepareImage(bytes, file.type, options, cutout);
    for (const [path, data] of [[paths[0], prepared.prepared], [paths[1], prepared.original]] as const) {
      const uploaded = await db.storage.from("products").upload(path, data, { contentType: "image/webp", upsert: true });
      if (uploaded.error) throw new Error("Upload failed. Please retry.");
    }
    return { image: { path: paths[0], original_path: paths[1], alt_text: alt, sort_order: 0, preparation: options, width: prepared.width, height: prepared.height } };
  } catch (error) {
    return { error: `${file.name}: ${error instanceof Error ? error.message : "Image could not be prepared."}` };
  }
}

// Fields the atomic create RPC doesn't take are applied right after it.
function extraFields(p: ProductFields) {
  return { brand_id: p.brand_id, compare_at_minor: p.compare_at_minor, warranty: p.warranty || null };
}

export async function createProduct(form: FormData): Promise<ProductResult> {
  const { db, user } = await requireStaff("products.manage");
  await cleanupStaleUploads(db);
  const key = z.uuid().safeParse(form.get("key"));
  if (!key.success) return { error: "Reload to start a new upload session." };
  const parsed = parseProductForm(form);
  if ("errors" in parsed) return { errors: parsed.errors };
  let images: z.output<typeof stagedImageSchema>[];
  try {
    images = z.array(stagedImageSchema).max(MAX_PRODUCT_IMAGES).parse(JSON.parse(String(form.get("images") ?? "[]")));
  } catch {
    return { error: "Image details could not be read. Remove and re-add the images." };
  }
  const registered = await db.rpc("register_product_upload", { p_key: key.data, p_paths: [] });
  if (registered.error) return { error: "Upload session could not be checked." };
  if (registered.data) return { id: registered.data };
  const p = parsed.data;
  const saved = await db.rpc("create_product_with_images", {
    p_key: key.data,
    p_product: {
      name: p.name, slug: p.slug, sku: p.sku, price_minor: p.price_minor, cost_minor: p.cost_minor,
      description: p.description, seo_title: p.seo_title, seo_description: p.seo_description,
      status: p.status, is_featured: p.is_featured, is_best_seller: p.is_best_seller, track_inventory: p.track_inventory,
    },
    p_images: images as unknown as Json,
    p_category: parsed.categories[0],
  });
  if (saved.error) {
    if (saved.error.code === "23505") return duplicateErrors();
    return { error: "The product could not be saved. Retry; the upload session prevents duplicates." };
  }
  const id = saved.data;
  // Remove staged files that were not used (for example images removed after a retry).
  const batch = await db.from("product_upload_batches").select("paths").eq("id", key.data).eq("actor_id", user.id).single();
  const used = new Set(images.flatMap((i) => [i.path, i.original_path]));
  const unused = (batch.data?.paths ?? []).filter((p) => !used.has(p));
  if (unused.length) await db.storage.from("products").remove(unused);
  const extra = await db.from("products").update(extraFields(parsed.data)).eq("id", id).select("id").single();
  const linked = await syncCategories(db, id, parsed.categories);
  refreshCatalog();
  if (extra.error || !linked) return { id, error: "The product was created, but its brand, compare-at price or categories could not all be saved. Check them in the editor." };
  return { id };
}

export async function updateProduct(form: FormData): Promise<ProductResult> {
  const { db } = await requireStaff("products.manage");
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { error: "This product could not be identified. Reload and try again." };
  const parsed = parseProductForm(form);
  if ("errors" in parsed) return { errors: parsed.errors };
  const current = await db.rpc("admin_product", { p_id: id.data });
  if (current.error || !current.data?.id) return { error: "This product no longer exists." };
  const p = parsed.data;
  const becameActive = p.status === "active" && current.data.status !== "active";
  const saved = await db
    .from("products")
    .update({ ...p, warranty: p.warranty || null, updated_at: new Date().toISOString(), ...(becameActive ? { published_at: new Date().toISOString() } : {}) })
    .eq("id", id.data)
    .select("id")
    .single();
  if (saved.error) return saved.error.code === "23505" ? duplicateErrors() : { error: "The product could not be saved. Check your permissions and try again." };
  const linked = await syncCategories(db, id.data, parsed.categories);
  refreshCatalog();
  if (!linked) return { id: id.data, error: "Product details were saved, but its categories could not be updated." };
  return { id: id.data };
}

export async function setProductStatus(productId: string, status: string): Promise<{ error?: string }> {
  const { db } = await requireStaff("products.manage");
  const id = z.uuid().safeParse(productId);
  const next = z.enum(PRODUCT_STATUSES).safeParse(status);
  if (!id.success || !next.success) return { error: "Choose a valid product and status." };
  const current = await db.rpc("admin_product", { p_id: id.data });
  if (current.error || !current.data?.id) return { error: "This product no longer exists." };
  const becameActive = next.data === "active" && current.data.status !== "active";
  const saved = await db
    .from("products")
    .update({ status: next.data, updated_at: new Date().toISOString(), ...(becameActive ? { published_at: new Date().toISOString() } : {}) })
    .eq("id", id.data)
    .select("id")
    .single();
  if (saved.error) return { error: "The status could not be changed." };
  refreshCatalog();
  return {};
}

// Deletion goes only through the guarded RPC, which refuses products with
// order, cart, review or stock history so those records stay intact.
export async function deleteProduct(productId: string): Promise<{ error?: string; blocked?: string; cleanupWarning?: boolean }> {
  const { db } = await requireStaff("products.manage");
  const id = z.uuid().safeParse(productId);
  if (!id.success) return { error: "Select a valid product to delete." };
  const { data: paths, error } = await db.rpc("delete_product", { p_id: id.data });
  if (error) {
    const blocked = deleteBlockReason(error.message);
    if (blocked) return { blocked };
    if (error.message.toLowerCase().includes("not found")) return { error: "This product no longer exists." };
    return { error: "The product could not be deleted. Try again, or archive it instead." };
  }
  let cleanupWarning = false;
  if (paths?.length) {
    try {
      cleanupWarning = Boolean((await db.storage.from("products").remove(paths)).error);
    } catch {
      cleanupWarning = true;
    }
  }
  refreshCatalog();
  return { cleanupWarning };
}

// ---- Images on an existing product: every change applies immediately. ----

async function loadImages(db: Db, productId: string): Promise<AdminProductImage[] | null> {
  const { data, error } = await db
    .from("product_images")
    .select("id,path,original_path,alt_text,width,height,preparation,sort_order")
    .eq("product_id", productId)
    .order("sort_order")
    .order("id");
  if (error) return null;
  return data.map((row) => {
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
}

async function imagesResult(db: Db, productId: string, error?: string): Promise<ImageResult> {
  const images = await loadImages(db, productId);
  return images ? { images, error } : { error: error ?? "Images could not be reloaded. Refresh the page." };
}

async function prepareUpload(file: File, options: unknown) {
  const config = cropSchema.parse(options);
  const bytes = Buffer.from(await file.arrayBuffer());
  const cutout = config.backgroundRemoval === "remove-bg" ? await removeImageBackground(bytes, file.type) : undefined;
  return { config, prepared: await prepareImage(bytes, file.type, config, cutout) };
}

function parseOptions(form: FormData) {
  try {
    return JSON.parse(String(form.get("options") ?? "{}"));
  } catch {
    return null;
  }
}

export async function addProductImage(form: FormData): Promise<ImageResult> {
  const { db } = await requireStaff("products.manage");
  const product = z.uuid().safeParse(form.get("product"));
  const alt = z.string().trim().min(3).max(200).safeParse(form.get("alt"));
  const file = form.get("file");
  if (!product.success) return { error: "This product could not be identified." };
  if (!alt.success) return { error: "Describe the image in at least three characters." };
  if (!(file instanceof File) || file.size === 0 || file.size > 4 * 1024 * 1024) return { error: "Choose a JPEG, PNG or WebP image under 4 MB." };
  const existing = await db.from("product_images").select("sort_order").eq("product_id", product.data).order("sort_order", { ascending: false });
  if (existing.error) return { error: "Product images could not be checked." };
  if (existing.data.length >= MAX_PRODUCT_IMAGES) return imagesResult(db, product.data, `A product can have up to ${MAX_PRODUCT_IMAGES} images.`);
  let result;
  try {
    result = await prepareUpload(file, parseOptions(form));
  } catch (error) {
    return imagesResult(db, product.data, `${file.name}: ${error instanceof Error ? error.message : "Image could not be prepared."}`);
  }
  const stem = `${product.data}/${crypto.randomUUID()}`;
  const path = `${stem}.webp`, originalPath = `${stem}-original.webp`;
  const storage = db.storage.from("products");
  const up = await storage.upload(path, result.prepared.prepared, { contentType: "image/webp", upsert: false });
  if (up.error) return imagesResult(db, product.data, "The image could not be uploaded.");
  const upOriginal = await storage.upload(originalPath, result.prepared.original, { contentType: "image/webp", upsert: false });
  if (upOriginal.error) {
    await storage.remove([path]);
    return imagesResult(db, product.data, "The original image could not be retained, so nothing was saved.");
  }
  const inserted = await db.from("product_images").insert({
    product_id: product.data,
    path,
    original_path: originalPath,
    alt_text: alt.data,
    sort_order: (existing.data[0]?.sort_order ?? -1) + 1,
    preparation: result.config as unknown as Json,
    width: result.prepared.width,
    height: result.prepared.height,
  });
  if (inserted.error) {
    await storage.remove([path, originalPath]);
    return imagesResult(db, product.data, "Image details could not be saved.");
  }
  refreshCatalog();
  return imagesResult(db, product.data);
}

// Re-prepares an image from its retained original (rotate, crop, background
// removal, or restore), or replaces it with a newly uploaded file in place.
export async function updateProductImage(form: FormData): Promise<ImageResult> {
  const { db } = await requireStaff("products.manage");
  const imageId = z.uuid().safeParse(form.get("image"));
  const alt = z.string().trim().min(3).max(200).safeParse(form.get("alt"));
  if (!imageId.success) return { error: "This image could not be identified." };
  const { data: image, error } = await db.from("product_images").select("id,product_id,path,original_path,preparation").eq("id", imageId.data).single();
  if (error || !image) return { error: "This image no longer exists. Refresh the page." };
  if (!alt.success) return imagesResult(db, image.product_id, "Describe the image in at least three characters.");
  const options = parseOptions(form);
  const file = form.get("file");
  const replacing = file instanceof File && file.size > 0;
  const storage = db.storage.from("products");
  const stem = `${image.product_id}/${crypto.randomUUID()}`;
  const path = `${stem}.webp`;
  let config, prepared, originalPath = image.original_path ?? image.path, newOriginal = false;
  try {
    if (replacing) {
      if (file.size > 4 * 1024 * 1024) return imagesResult(db, image.product_id, "Choose an image under 4 MB.");
      ({ config, prepared } = await prepareUpload(file, options));
      originalPath = `${stem}-original.webp`;
      newOriginal = true;
    } else {
      config = cropSchema.parse(options);
      const source = await storage.download(originalPath);
      if (source.error) return imagesResult(db, image.product_id, "The original image could not be loaded.");
      const bytes = Buffer.from(await source.data.arrayBuffer());
      const mime = source.data.type.split(";")[0];
      const cutout = config.backgroundRemoval === "remove-bg" ? await removeImageBackground(bytes, mime) : undefined;
      prepared = await prepareImage(bytes, mime, config, cutout, { maxBytes: 8 * 1024 * 1024 });
    }
  } catch (err) {
    return imagesResult(db, image.product_id, err instanceof Error ? err.message : "The image could not be prepared.");
  }
  const up = await storage.upload(path, prepared.prepared, { contentType: "image/webp", upsert: false });
  if (up.error) return imagesResult(db, image.product_id, "The image could not be uploaded. Your existing image is unchanged.");
  if (newOriginal) {
    const upOriginal = await storage.upload(originalPath, prepared.original, { contentType: "image/webp", upsert: false });
    if (upOriginal.error) {
      await storage.remove([path]);
      return imagesResult(db, image.product_id, "The original could not be retained, so the image was not replaced.");
    }
  }
  const saved = await db
    .from("product_images")
    .update({ path, original_path: originalPath, alt_text: alt.data, width: prepared.width, height: prepared.height, preparation: config as unknown as Json })
    .eq("id", image.id)
    .select("id")
    .single();
  if (saved.error) {
    await storage.remove(newOriginal ? [path, originalPath] : [path]);
    return imagesResult(db, image.product_id, "Image details could not be saved. Your existing image is unchanged.");
  }
  // Drop superseded files, never the original still in use.
  const stale = [image.path, ...(newOriginal && image.original_path ? [image.original_path] : [])].filter((p) => p !== originalPath);
  if (stale.length) await storage.remove(stale);
  refreshCatalog();
  return imagesResult(db, image.product_id);
}

export async function updateImageAlt(imageId: string, altText: string): Promise<ImageResult> {
  const { db } = await requireStaff("products.manage");
  const id = z.uuid().safeParse(imageId);
  const alt = z.string().trim().min(3).max(200).safeParse(altText);
  if (!id.success) return { error: "This image could not be identified." };
  if (!alt.success) return { error: "Describe the image in at least three characters." };
  const saved = await db.from("product_images").update({ alt_text: alt.data }).eq("id", id.data).select("product_id").single();
  if (saved.error || !saved.data) return { error: "The description could not be saved." };
  refreshCatalog();
  return imagesResult(db, saved.data.product_id);
}

export async function removeProductImage(imageId: string): Promise<ImageResult> {
  const { db } = await requireStaff("products.manage");
  const id = z.uuid().safeParse(imageId);
  if (!id.success) return { error: "This image could not be identified." };
  const { data: image, error } = await db.from("product_images").select("id,product_id,path,original_path").eq("id", id.data).single();
  if (error || !image) return { error: "This image no longer exists. Refresh the page." };
  const removed = await db.from("product_images").delete().eq("id", image.id);
  if (removed.error) return imagesResult(db, image.product_id, "The image could not be removed.");
  const files = [image.path, image.original_path].filter((p): p is string => Boolean(p));
  const cleanup = await db.storage.from("products").remove(files);
  refreshCatalog();
  return imagesResult(db, image.product_id, cleanup.error ? "The image was removed, but its files could not be deleted from storage." : undefined);
}

// The first image in the order is the primary image shown on the storefront.
export async function reorderProductImages(productId: string, order: string[]): Promise<ImageResult> {
  const { db } = await requireStaff("products.manage");
  const id = z.uuid().safeParse(productId);
  if (!id.success) return { error: "This product could not be identified." };
  const current = await db.from("product_images").select("id").eq("product_id", id.data);
  if (current.error) return { error: "Product images could not be loaded." };
  if (!validImageOrder(current.data.map((r) => r.id), order)) return imagesResult(db, id.data, "The image list changed. Review the order and try again.");
  for (const [index, imageId] of order.entries()) {
    const saved = await db.from("product_images").update({ sort_order: index }).eq("id", imageId).eq("product_id", id.data);
    if (saved.error) return imagesResult(db, id.data, "The new order could not be fully saved.");
  }
  refreshCatalog();
  return imagesResult(db, id.data);
}
