import { requireAdmin } from "@/lib/admin/context";
import { saveContent } from "../actions";

export default async function NewContent({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin("content.manage");
  const { error } = await searchParams;
  return (
    <>
      <p className="eyebrow">NEW PAGE</p>
      <h2>New page</h2>
      {error && <p className="form-error">{error}</p>}
      <form className="stack-form" action={saveContent}>
        <div className="form-row">
          <label>Title<input name="title" required /></label>
          <label>Slug (matches /policies/&lt;slug&gt;)<input name="slug" required placeholder="returns" /></label>
        </div>
        <label>Body<textarea name="body" rows={10} /></label>
        <label className="checkbox-label"><input type="checkbox" name="isPublished" /> Published</label>
        <button className="button button-dark" type="submit">Create page</button>
      </form>
    </>
  );
}
