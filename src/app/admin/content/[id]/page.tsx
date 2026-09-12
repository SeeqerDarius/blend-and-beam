import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { saveContent } from "../actions";

export default async function EditContent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireAdmin("content.manage");
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: page } = await supabase.from("site_content").select("*").eq("id", id).maybeSingle();
  if (!page) notFound();

  return (
    <>
      <p className="eyebrow">EDIT PAGE</p>
      <h2>{page.title}</h2>
      {error && <p className="form-error">{error}</p>}
      <form className="stack-form" action={saveContent}>
        <input type="hidden" name="id" value={page.id} />
        <div className="form-row">
          <label>Title<input name="title" defaultValue={page.title} required /></label>
          <label>Slug<input name="slug" defaultValue={page.slug} required /></label>
        </div>
        <label>Body<textarea name="body" defaultValue={page.body} rows={12} /></label>
        <label className="checkbox-label"><input type="checkbox" name="isPublished" defaultChecked={page.is_published} /> Published</label>
        <button className="button button-dark" type="submit">Save changes</button>
      </form>
    </>
  );
}
