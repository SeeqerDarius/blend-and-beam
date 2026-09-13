"use server";
import { requireStaff } from "@/lib/admin-auth";
import { prepareImage, cropSchema } from "@/lib/image-preparation";
import { toMinor } from "@/lib/product-draft";
import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import type { Json } from "@/lib/supabase/types";
const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(150),
  sku: z.string().trim().min(1).max(200),
  description: z.string().max(10000),
  seo_title: z.string().max(60),
  seo_description: z.string().max(160),
  status: z.enum(["draft", "active", "archived"]),
  price_minor: z.number().int().min(0),
  cost_minor: z.number().int().min(0).nullable(),
  is_featured: z.boolean(),
  is_best_seller: z.boolean(),
  track_inventory: z.boolean(),
});
export type ProductResult = {
  errors?: Record<string, string>;
  error?: string;
  id?: string;
};
const imageSchema = z.object({
  path: z.string().max(250),
  original_path: z.string().max(250),
  alt_text: z.string().trim().min(3).max(200),
  sort_order: z.number().int().min(0).max(5),
  preparation: cropSchema,
  width: z.number().int().min(1).max(2400),
  height: z.number().int().min(1).max(2400),
});
export type StagedImage = z.infer<typeof imageSchema>;
export async function stageProductImage(
  form: FormData,
): Promise<{ error?: string; image?: StagedImage; id?: string }> {
  const { db, user } = await requireStaff("products.manage");
  const stale=await db.rpc("expire_product_uploads");
  for(const batch of stale.data??[]){if(!batch.paths.length)continue;const removed=await db.storage.from("products").remove(batch.paths);if(!removed.error)await db.from("product_upload_batches").delete().eq("id",batch.id).is("product_id",null)}
  const input = z
    .object({
      key: z.uuid(),
      imageKey: z.uuid(),
      alt: z.string().trim().min(3).max(200),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Check the image description and upload session." };
  const file = form.get("file");
  if (!(file instanceof File) || file.size > 4 * 1024 * 1024)
    return { error: "Choose an image under 4 MB." };
  const { key, imageKey, alt } = input.data;
  const attempt=crypto.randomUUID();
  const paths = [
    `${user.id}/${key}/${imageKey}-${attempt}.webp`,
    `${user.id}/${key}/${imageKey}-${attempt}-original.webp`,
  ];
  const registered = await db.rpc("register_product_upload", {
    p_key: key,
    p_paths: paths,
  });
  if (registered.error)
    return { error: "Upload session could not be registered." };
  if (registered.data) return { id: registered.data };
  try {
    const options = cropSchema.parse(JSON.parse(String(form.get("options"))));
    const prepared = await prepareImage(
      Buffer.from(await file.arrayBuffer()),
      file.type,
      options,
    );
    for (const [path, bytes] of [
      [paths[0], prepared.prepared],
      [paths[1], prepared.original],
    ] as const) {
      const uploaded = await db.storage
        .from("products")
        .upload(path, bytes, { contentType: "image/webp", upsert: true });
      if (uploaded.error) throw new Error("Upload failed. Please retry.");
    }
    return {
      image: {
        path: paths[0],
        original_path: paths[1],
        alt_text: alt,
        sort_order: 0,
        preparation: options,
        width: prepared.width,
        height: prepared.height,
      },
    };
  } catch (error) {
    return {
      error: `${file.name}: ${error instanceof Error ? error.message : "Image could not be prepared."}`,
    };
  }
}
export async function createProduct(form: FormData): Promise<ProductResult> {
  const { db, user } = await requireStaff("products.manage");
  const stale=await db.rpc("expire_product_uploads");
  for(const batch of stale.data??[]){if(!batch.paths.length)continue;const removed=await db.storage.from("products").remove(batch.paths);if(!removed.error)await db.from("product_upload_batches").delete().eq("id",batch.id).is("product_id",null)}
  const key = z.uuid().safeParse(form.get("key"));
  if (!key.success) return { error: "Reload to start a new upload session." };
  const raw: Record<string, unknown> = Object.fromEntries(form);
  const errors: Record<string, string> = {};
  for (const name of ["price_minor", "cost_minor"]) {
    try {
      raw[name] =
        name === "cost_minor" && !String(form.get(name) ?? "").trim()
          ? null
          : toMinor(String(form.get(name) ?? ""));
    } catch {
      errors[name] = "Enter GHS with no more than two decimal places.";
    }
  }
  if (Object.keys(errors).length) return { errors };
  const parsed = productSchema.safeParse({
    ...raw,
    is_featured: form.get("is_featured") === "on",
    is_best_seller: form.get("is_best_seller") === "on",
    track_inventory: form.get("track_inventory") === "on",
  });
  if (!parsed.success)
    return {
      errors: Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
      ),
    };
  let images: StagedImage[];
  try {
    images = z
      .array(imageSchema)
      .max(6)
      .parse(JSON.parse(String(form.get("preparation") ?? "[]")));
  } catch {
    return { error: "Check image preparation settings." };
  }
  const category = z
    .uuid()
    .nullable()
    .safeParse(form.get("category") || null);
  if (!category.success)
    return { errors: { category: "Choose a valid category." } };
  const registered = await db.rpc("register_product_upload", {
    p_key: key.data,
    p_paths: [],
  });
  if (registered.error)
    return { error: "Upload session could not be checked." };
  if (registered.data) return { id: registered.data };
  const saved = await db.rpc("create_product_with_images", {
    p_key: key.data,
    p_product: parsed.data,
    p_images: images as Json,
    p_category: category.data ?? undefined,
  });
  if (saved.error) {
    if (saved.error.code === "23505")
      return {
        errors: {
          sku: "Check that the SKU is unique.",
          slug: "Check that the URL slug is unique.",
        },
        error:
          "A SKU or slug is already in use. Entries and staged images are retained.",
      };
    return {
      error:
        "Save could not be confirmed. Retry this form; the upload session prevents duplicate products.",
    };
  }
  // Remove unused images from this committed session (for example selections removed after a retry).
  const batch = await db
    .from("product_upload_batches")
    .select("paths")
    .eq("id", key.data)
    .eq("actor_id", user.id)
    .single();
  const used = new Set(images.flatMap((i) => [i.path, i.original_path]));
  const unused = (batch.data?.paths ?? []).filter((p) => !used.has(p));
  if (unused.length) await db.storage.from("products").remove(unused);
  updateTag("catalog");
  revalidatePath("/", "layout");
  revalidatePath("/admin/products");
  return { id: saved.data };
}

