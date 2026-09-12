import Link from "next/link";
import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/admin/format";

export default async function AdminContent() {
  await requireAdmin("content.manage");
  const supabase = await createClient();
  const { data: pages } = await supabase.from("site_content").select("id,slug,title,is_published,updated_at").order("slug");

  return (
    <>
      <div className="admin-toolbar">
        <div><p className="eyebrow">SITE CONTENT</p><h2>Pages</h2></div>
        <Link className="button button-dark" href="/admin/content/new">+ New page</Link>
      </div>
      <table className="admin-table">
        <thead><tr><th>Title</th><th>Slug</th><th>Status</th><th>Updated</th></tr></thead>
        <tbody>
          {(pages ?? []).length === 0 ? (
            <tr><td colSpan={4}>No pages yet. Create returns, privacy or terms to publish them on the storefront.</td></tr>
          ) : (pages ?? []).map((p) => (
            <tr key={p.id}>
              <td><Link href={`/admin/content/${p.id}`}>{p.title}</Link></td>
              <td>/policies/{p.slug}</td>
              <td><span className={`pill ${p.is_published ? "pill-active" : "pill-draft"}`}>{p.is_published ? "Published" : "Draft"}</span></td>
              <td>{formatDate(p.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
