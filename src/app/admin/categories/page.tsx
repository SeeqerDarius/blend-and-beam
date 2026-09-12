import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { saveCategory, deleteCategory } from "./actions";

export default async function AdminCategories({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin("products.manage");
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("id,name,slug,is_active,parent_id").order("sort_order");

  return (
    <>
      <p className="eyebrow">CATALOG</p>
      <h2>Categories</h2>
      {error && <p className="form-error">{error}</p>}
      <form className="stack-form admin-inline-form" action={saveCategory}>
        <div className="form-row">
          <label>Name<input name="name" required /></label>
          <label>Parent category
            <select name="parentId" defaultValue="">
              <option value="">No parent</option>
              {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <button className="button button-dark" type="submit">Add category</button>
      </form>
      <table className="admin-table">
        <thead><tr><th>Name</th><th>Slug</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {(categories ?? []).length === 0 ? (
            <tr><td colSpan={4}>No categories yet.</td></tr>
          ) : (categories ?? []).map((c) => (
            <tr key={c.id}>
              <td><Link href={`/admin/categories/${c.id}`}>{c.name}</Link></td>
              <td>{c.slug}</td>
              <td><span className={`pill ${c.is_active ? "pill-active" : "pill-draft"}`}>{c.is_active ? "Active" : "Hidden"}</span></td>
              <td className="admin-row-actions">
                <form action={deleteCategory.bind(null, c.id)}><button className="text-link" type="submit">Delete</button></form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
