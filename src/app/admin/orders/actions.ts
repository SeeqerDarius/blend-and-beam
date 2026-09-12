"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/context";
import type { OrderStatus } from "@/lib/admin/orders";

export async function transitionOrder(orderId: string, formData: FormData) {
  await requireAdmin("orders.manage");
  const supabase = await createClient();
  const status = String(formData.get("status")) as OrderStatus;
  const note = String(formData.get("note") ?? "").trim();
  const { error } = await supabase.rpc("transition_order", { p_order: orderId, p_status: status, p_note: note });
  if (error) redirect(`/admin/orders/${orderId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

export async function saveOrderNote(orderId: string, formData: FormData) {
  await requireAdmin("orders.manage");
  const supabase = await createClient();
  const note = String(formData.get("adminNote") ?? "");
  const { error } = await supabase.rpc("set_order_note", { p_order: orderId, p_note: note });
  if (error) redirect(`/admin/orders/${orderId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/admin/orders/${orderId}`);
}
