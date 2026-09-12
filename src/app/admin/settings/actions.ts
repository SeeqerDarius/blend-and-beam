"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/context";

export async function saveShippingZone(formData: FormData) {
  await requireAdmin("settings.manage");
  const supabase = await createClient();
  const id = (formData.get("id") as string) || null;
  const regions = String(formData.get("regions") ?? "").split(",").map((r) => r.trim()).filter(Boolean);
  const payload = {
    name: String(formData.get("name") ?? "").trim(),
    regions,
    fee_minor: Math.round(Number(formData.get("fee") ?? 0) * 100),
    free_shipping_threshold_minor: formData.get("freeThreshold") ? Math.round(Number(formData.get("freeThreshold")) * 100) : null,
    estimate: String(formData.get("estimate") ?? "").trim(),
    is_active: formData.get("isActive") === "on",
  };
  if (!payload.name || regions.length === 0 || !payload.estimate) {
    redirect(`/admin/settings?error=${encodeURIComponent("Name, at least one region and a delivery estimate are required")}`);
  }

  const result = id
    ? await supabase.from("shipping_zones").update(payload).eq("id", id)
    : await supabase.from("shipping_zones").insert(payload);
  if (result.error) redirect(`/admin/settings?error=${encodeURIComponent(result.error.message)}`);
  revalidatePath("/admin/settings");
  redirect("/admin/settings");
}

export async function setShippingZoneActive(id: string, isActive: boolean) {
  await requireAdmin("settings.manage");
  const supabase = await createClient();
  await supabase.from("shipping_zones").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/admin/settings");
}
