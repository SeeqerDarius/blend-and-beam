"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
const schema = z.object({
  key: z.uuid(),
  zone: z.uuid(),
  items: z
    .array(
      z.object({
        slug: z
          .string()
          .regex(/^[a-z0-9-]+$/)
          .max(150),
        quantity: z.number().int().min(1).max(50),
      }),
    )
    .min(1)
    .max(30),
  address: z.object({
    name: z.string().trim().min(2).max(150),
    phone: z.string().regex(/^\+?[0-9 ()-]{9,20}$/),
    address: z.string().trim().min(5).max(500),
    city: z.string().trim().min(2).max(100),
    region: z.string().min(2).max(100),
    gps: z.string().max(80),
  }),
});
export async function placeOrder(
  input: unknown,
): Promise<{ error?: string; number?: string; total?: number }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "Please sign in before placing your order." };
  const { key, items, address, zone } = parsed.data;
  const { data, error } = await db.rpc("place_cod_order", {
    p_key: key,
    p_items: items,
    p_address: address,
    p_zone: zone,
  });
  if (error)
    return {
      error:
        error.code === "P0001"
          ? error.message
          : "Your order could not be confirmed. Retry using this page; your request will not create a duplicate.",
    };
  revalidatePath("/account");
  revalidatePath("/admin/orders");
  return data as { number: string; total: number };
}
