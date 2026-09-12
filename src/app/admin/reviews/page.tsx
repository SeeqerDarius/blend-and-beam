import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/admin/format";
import { moderateReview } from "./actions";

export default async function AdminReviews({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin("reviews.manage");
  const { status } = await searchParams;
  const activeFilter = status ?? "pending";
  const supabase = await createClient();
  const { data: reviews } = await supabase
    .from("reviews")
    .select("id,user_id,rating,title,content,status,created_at,verified_purchase,products(name)")
    .eq("status", activeFilter)
    .order("created_at", { ascending: false });

  // reviews.user_id references auth.users, not public.profiles, so PostgREST
  // can't embed the join directly; resolve reviewer names separately.
  const reviewerIds = [...new Set((reviews ?? []).map((r) => r.user_id))];
  const { data: reviewers } = reviewerIds.length ? await supabase.from("profiles").select("id,email,full_name").in("id", reviewerIds) : { data: [] as { id: string; email: string | null; full_name: string | null }[] };
  const reviewerById = new Map((reviewers ?? []).map((p) => [p.id, p]));

  return (
    <>
      <p className="eyebrow">CUSTOMER FEEDBACK</p>
      <h2>Reviews</h2>
      <form className="admin-filters">
        <select name="status" defaultValue={activeFilter}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <button className="button secondary" type="submit">Filter</button>
      </form>
      {(reviews ?? []).length === 0 ? (
        <div className="empty-state"><strong>Nothing here</strong><p>No {activeFilter} reviews.</p></div>
      ) : (reviews ?? []).map((r) => (
        <article className="admin-review-card" key={r.id}>
          <p className="fine-print">{r.products?.name} · {reviewerById.get(r.user_id)?.full_name || reviewerById.get(r.user_id)?.email} · {"★".repeat(r.rating)}{r.verified_purchase ? " · Verified purchase" : ""} · {formatDate(r.created_at)}</p>
          {r.title && <strong>{r.title}</strong>}
          <p>{r.content}</p>
          {activeFilter === "pending" && (
            <div className="admin-row-actions">
              <form action={moderateReview.bind(null, r.id, "approved")}><button className="button secondary" type="submit">Approve</button></form>
              <form action={moderateReview.bind(null, r.id, "rejected")}><button className="text-link" type="submit">Reject</button></form>
            </div>
          )}
        </article>
      ))}
    </>
  );
}
