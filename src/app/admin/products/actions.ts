"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/context";
import type { Database } from "@/lib/supabase/types";

type ProductStatus = Database["public"]["Enums"]["product_status"];

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
}

function toMinor(value: FormDataEntryValue | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Math.round(Number(value) * 100);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function saveProduct(formData: FormData) {
  await requireAdmin("products.manage");
  const supabase = await createClient();

  const id = (formData.get("id") as string) || null;
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const priceMinor = toMinor(formData.get("price"));
  const status = (String(formData.get("status") ?? "draft") as ProductStatus);

  if (!name || !sku || priceMinor === null) {
    redirect(`/admin/products/${id ?? "new"}?error=${encodeURIComponent("Name, SKU and price are required")}`);
  }

  const categoryIds = formData.getAll("categoryIds").map(String);
  const payload = {
    name,
    slug: slugify(String(formData.get("slug") || name)),
    sku,
    price_minor: priceMinor!,
    compare_at_minor: toMinor(formData.get("compareAt")),
    cost_minor: toMinor(formData.get("cost")),
    status,
    short_description: String(formData.get("shortDescription") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    brand_id: (formData.get("brandId") as string) || null,
    warranty: String(formData.get("warranty") ?? "").trim() || null,
    is_featured: formData.get("isFeatured") === "on",
    is_best_seller: formData.get("isBestSeller") === "on",
    published_at: status === "active" ? new Date().toISOString() : null,
  };

  let productId = id;
  if (id) {
    const { error } = await supabase.from("products").update(payload).eq("id", id);
    if (error) redirect(`/admin/products/${id}?error=${encodeURIComponent(error.message)}`);
  } else {
    const { data, error } = await supabase.from("products").insert(payload).select("id").single();
    if (error || !data) redirect(`/admin/products/new?error=${encodeURIComponent(error?.message ?? "Could not create product")}`);
    productId = data!.id;
  }

  await supabase.from("product_categories").delete().eq("product_id", productId!);
  if (categoryIds.length) {
    await supabase.from("product_categories").insert(categoryIds.map((categoryId) => ({ product_id: productId!, category_id: categoryId })));
  }

  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    const ext = image.name.split(".").pop() ?? "jpg";
    const path = `${productId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("products").upload(path, image, { contentType: image.type });
    if (!uploadError) {
      await supabase.from("product_images").insert({ product_id: productId!, path, alt_text: name, sort_order: 0 });
    }
  }

  revalidatePath("/admin/products");
  redirect(`/admin/products/${productId}`);
}

export async function setProductStatus(id: string, status: ProductStatus) {
  await requireAdmin("products.manage");
  const supabase = await createClient();
  await supabase.from("products").update({ status, published_at: status === "active" ? new Date().toISOString() : null }).eq("id", id);
  revalidatePath("/admin/products");
}

export async function deleteProductImage(imageId: string, productId: string, path: string) {
  await requireAdmin("products.manage");
  const supabase = await createClient();
  await supabase.storage.from("products").remove([path]);
  await supabase.from("product_images").delete().eq("id", imageId);
  revalidatePath(`/admin/products/${productId}`);
}
