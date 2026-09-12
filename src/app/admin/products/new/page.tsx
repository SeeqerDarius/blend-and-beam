import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "../product-form";

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin("products.manage");
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: categories }, { data: brands }] = await Promise.all([
    supabase.from("categories").select("id,name").order("name"),
    supabase.from("brands").select("id,name").order("name"),
  ]);

  return (
    <ProductForm
      product={null}
      categories={categories ?? []}
      brands={brands ?? []}
      selectedCategoryIds={[]}
      images={[]}
      imageBaseUrl=""
      error={error}
    />
  );
}
