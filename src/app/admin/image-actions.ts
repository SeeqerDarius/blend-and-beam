"use server";
import { requireStaff } from "@/lib/admin-auth";
import { prepareImage } from "@/lib/image-preparation";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
export async function recropImage(form: FormData): Promise<{ error?: string }> {
  const { db } = await requireStaff("products.manage");
  const parsed = z
    .object({ image: z.uuid(), alt: z.string().trim().min(3).max(200) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check the image and alt text." };
  const { data: image, error } = await db
    .from("product_images")
    .select("id,product_id,path,original_path")
    .eq("id", parsed.data.image)
    .single();
  if (error || !image) return { error: "Image could not be found." };
  const source = await db.storage
    .from("products")
    .download(image.original_path ?? image.path);
  if (source.error) return { error: "Original could not be loaded." };
  try {
    const bytes = Buffer.from(await source.data.arrayBuffer());
    const mime = source.data.type.split(";")[0];
    const prepared = await prepareImage(
      bytes,
      mime,
      JSON.parse(String(form.get("options"))),
    );
    const path = `${image.product_id}/${crypto.randomUUID()}.webp`;
    const uploaded = await db.storage
      .from("products")
      .upload(path, prepared.prepared, { contentType: "image/webp" });
    if (uploaded.error)
      return { error: "Upload failed. Your existing image is unchanged." };
    const saved = await db
      .from("product_images")
      .update({
        path,
        original_path: image.original_path ?? image.path,
        alt_text: parsed.data.alt,
        width: prepared.width,
        height: prepared.height,
        preparation: JSON.parse(String(form.get("options"))),
      })
      .eq("id", image.id)
      .select("id")
      .single();
    if (saved.error) {
      await db.storage.from("products").remove([path]);
      return { error: "Image metadata could not be saved." };
    }
    if (image.original_path && image.path !== image.original_path)
      await db.storage.from("products").remove([image.path]);
    updateTag("catalog");
    revalidatePath("/", "layout");
    return {};
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Image preparation failed.",
    };
  }
}
export async function makePrimary(form: FormData) {
  const { db } = await requireStaff("products.manage");
  const id = z.uuid().parse(form.get("image"));
  const { error } = await db.rpc("set_primary_image", { p_image: id });
  if (error) throw new Error("Primary image could not be updated.");
  updateTag("catalog");
  revalidatePath("/", "layout");
}
