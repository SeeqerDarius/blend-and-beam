"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/context";

export async function adjustStock(formData: FormData) {
  await requireAdmin("inventory.manage");
  const supabase = await createClient();
  const productId = String(formData.get("productId"));
  const variantId = (formData.get("variantId") as string) || null;
  const delta = Number(formData.get("delta"));
  const reason = String(formData.get("reason") ?? "").trim();

  const { error } = await supabase.rpc("adjust_stock", { p_product: productId, p_delta: delta, p_reason: reason, p_variant: variantId ?? undefined });
  if (error) redirect(`/admin/inventory?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/inventory");
  redirect("/admin/inventory");
}
