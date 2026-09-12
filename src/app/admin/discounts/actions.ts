"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/context";

export async function saveDiscount(formData: FormData) {
  await requireAdmin("discounts.manage");
  const supabase = await createClient();
  const id = (formData.get("id") as string) || null;
  const kind = String(formData.get("kind") ?? "percentage");
  const payload = {
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    kind,
    value: Number(formData.get("value") ?? 0),
    minimum_minor: Math.round(Number(formData.get("minimum") ?? 0) * 100),
    max_redemptions: formData.get("maxRedemptions") ? Number(formData.get("maxRedemptions")) : null,
    per_customer: formData.get("perCustomer") ? Number(formData.get("perCustomer")) : null,
    starts_at: (formData.get("startsAt") as string) || null,
    expires_at: (formData.get("expiresAt") as string) || null,
    is_active: formData.get("isActive") === "on",
  };

  const result = id
    ? await supabase.from("discount_codes").update(payload).eq("id", id)
    : await supabase.from("discount_codes").insert(payload);
  if (result.error) redirect(`/admin/discounts?error=${encodeURIComponent(result.error.message)}`);
  revalidatePath("/admin/discounts");
  redirect("/admin/discounts");
}

export async function setDiscountActive(id: string, isActive: boolean) {
  await requireAdmin("discounts.manage");
  const supabase = await createClient();
  await supabase.from("discount_codes").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/admin/discounts");
}
