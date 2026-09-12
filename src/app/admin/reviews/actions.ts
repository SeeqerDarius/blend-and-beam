"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/context";

export async function moderateReview(id: string, status: "approved" | "rejected") {
  await requireAdmin("reviews.manage");
  const supabase = await createClient();
  await supabase.from("reviews").update({ status }).eq("id", id);
  revalidatePath("/admin/reviews");
}
