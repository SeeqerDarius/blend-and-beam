"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/context";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
}

export async function saveCategory(formData: FormData) {
  await requireAdmin("products.manage");
  const supabase = await createClient();
  const id = (formData.get("id") as string) || null;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(`/admin/categories${id ? `/${id}` : ""}?error=${encodeURIComponent("Name is required")}`);

  const payload = {
    name,
    slug: slugify(String(formData.get("slug") || name)),
    description: String(formData.get("description") ?? "").trim() || null,
    parent_id: (formData.get("parentId") as string) || null,
    seo_title: String(formData.get("seoTitle") ?? "").trim() || null,
    seo_description: String(formData.get("seoDescription") ?? "").trim() || null,
    sort_order: Number(formData.get("sortOrder") ?? 0) || 0,
    is_active: formData.get("isActive") === "on",
  };

  const result = id
    ? await supabase.from("categories").update(payload).eq("id", id)
    : await supabase.from("categories").insert(payload);
  if (result.error) redirect(`/admin/categories${id ? `/${id}` : ""}?error=${encodeURIComponent(result.error.message)}`);

  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

export async function deleteCategory(id: string) {
  await requireAdmin("products.manage");
  const supabase = await createClient();
  await supabase.from("categories").delete().eq("id", id);
  revalidatePath("/admin/categories");
}
