import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { saveCategory } from "../actions";

export default async function EditCategory({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireAdmin("products.manage");
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: category }, { data: categories }] = await Promise.all([
    supabase.from("categories").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id,name").neq("id", id).order("name"),
  ]);
  if (!category) notFound();

  return (
    <>
      <p className="eyebrow">EDIT CATEGORY</p>
      <h2>{category.name}</h2>
      {error && <p className="form-error">{error}</p>}
      <form className="stack-form" action={saveCategory}>
        <input type="hidden" name="id" value={category.id} />
        <div className="form-row">
          <label>Name<input name="name" defaultValue={category.name} required /></label>
          <label>Slug<input name="slug" defaultValue={category.slug} /></label>
        </div>
        <label>Description<textarea name="description" defaultValue={category.description ?? ""} rows={4} /></label>
        <label>Parent category
          <select name="parentId" defaultValue={category.parent_id ?? ""}>
            <option value="">No parent</option>
            {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="form-row">
          <label>SEO title<input name="seoTitle" defaultValue={category.seo_title ?? ""} /></label>
          <label>Sort order<input name="sortOrder" type="number" defaultValue={category.sort_order} /></label>
        </div>
        <label>SEO description<textarea name="seoDescription" defaultValue={category.seo_description ?? ""} rows={2} /></label>
        <label className="checkbox-label"><input type="checkbox" name="isActive" defaultChecked={category.is_active} /> Visible in storefront</label>
        <button className="button button-dark" type="submit">Save changes</button>
      </form>
    </>
  );
}
