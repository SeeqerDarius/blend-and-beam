import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "../product-form";

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireAdmin("products.manage");
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: product }, { data: categories }, { data: brands }, { data: links }, { data: images }] = await Promise.all([
    supabase.rpc("admin_product", { p_id: id }),
    supabase.from("categories").select("id,name").order("name"),
    supabase.from("brands").select("id,name").order("name"),
    supabase.from("product_categories").select("category_id").eq("product_id", id),
    supabase.from("product_images").select("*").eq("product_id", id).order("sort_order"),
  ]);

  if (!product) notFound();

  return (
    <ProductForm
      product={product}
      categories={categories ?? []}
      brands={brands ?? []}
      selectedCategoryIds={(links ?? []).map((l) => l.category_id)}
      images={images ?? []}
      imageBaseUrl={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products`}
      error={error}
    />
  );
}
