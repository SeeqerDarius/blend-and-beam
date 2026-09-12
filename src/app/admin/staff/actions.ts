"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/context";

export async function assignStaff(formData: FormData) {
  await requireAdmin("staff.manage");
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const roleId = String(formData.get("roleId") ?? "");
  const { error } = await supabase.rpc("assign_staff", { p_email: email, p_role: roleId, p_remove: false });
  if (error) redirect(`/admin/staff?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/staff");
  redirect("/admin/staff");
}

export async function revokeStaff(email: string, roleId: string) {
  await requireAdmin("staff.manage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_staff", { p_email: email, p_role: roleId, p_remove: true });
  if (error) redirect(`/admin/staff?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/staff");
}
