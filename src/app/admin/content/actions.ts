"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/context";

export async function saveContent(formData: FormData) {
  await requireAdmin("content.manage");
  const supabase = await createClient();
  const id = (formData.get("id") as string) || null;
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const payload = {
    slug,
    title: String(formData.get("title") ?? "").trim(),
    body: String(formData.get("body") ?? ""),
    is_published: formData.get("isPublished") === "on",
    updated_at: new Date().toISOString(),
  };
  if (!slug || !payload.title) redirect(`/admin/content${id ? `/${id}` : "/new"}?error=${encodeURIComponent("Slug and title are required")}`);

  const result = id
    ? await supabase.from("site_content").update(payload).eq("id", id)
    : await supabase.from("site_content").insert(payload);
  if (result.error) redirect(`/admin/content${id ? `/${id}` : "/new"}?error=${encodeURIComponent(result.error.message)}`);

  revalidatePath("/admin/content");
  revalidatePath(`/policies/${slug}`);
  redirect("/admin/content");
}
