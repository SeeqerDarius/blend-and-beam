import Link from "next/link";
import { requireStaff, staffPermissions } from "@/lib/admin-auth";
import { adminLinks } from "@/lib/admin-resources";
import { money } from "@/lib/catalog";
import { describeAudit } from "@/lib/audit";
import { reportRange, type Report } from "@/lib/reporting";

type ActivityRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  created_at: string;
  metadata: unknown;
};

export default async function Admin() {
  const { db } = await requireStaff();
  const permissions = await staffPermissions();
  const canSeeReports = permissions.has("reports.read");
  const canSeeAudit = permissions.has("audit.read");

  let report: Report | null = null;
  let reportUnavailable = false;
  if (canSeeReports) {
    const range = reportRange({ range: "7" });
    const result = await db.rpc("commerce_report", {
      p_from: range.from,
      p_to: range.to,
    });
    report = result.error ? null : (result.data as unknown as Report | null);
    reportUnavailable = Boolean(result.error);
  }

  let activity: ActivityRow[] = [];
  const actorById = new Map<string, string>();
  if (canSeeAudit) {
    const { data } = await db
      .from("audit_logs")
      .select("id,actor_id,action,entity_type,created_at,metadata")
      .order("created_at", { ascending: false })
      .limit(6);
    activity = (data ?? []) as unknown as ActivityRow[];
    const actorIds = [
      ...new Set(
        activity
          .map((row) => row.actor_id)
          .filter((id): id is string => typeof id === "string"),
      ),
    ];
    if (actorIds.length) {
      const { data: actors } = await db
        .from("profiles")
        .select("id,email,full_name")
        .in("id", actorIds);
      for (const actor of actors ?? []) {
        actorById.set(actor.id, actor.full_name || actor.email || "Unknown staff");
      }
    }
  }

  const links = adminLinks.slice(1).filter((link) => permissions.has(link[2]));
  const quickActions = [
    { permission: "products.manage", href: "/admin/products", label: "Add a product", detail: "Create a listing and prepare it for the storefront" },
    { permission: "orders.manage", href: "/admin/orders", label: "Review orders", detail: "Check fulfillment status and customer details" },
    { permission: "inventory.manage", href: "/admin/inventory", label: "Update stock", detail: "Record stock changes with a reason" },
  ].filter((action) => permissions.has(action.permission));
  const kpis = report?.kpis.current;

  return (
    <div className="admin-overview">
      <header className="overview-hero">
        <div>
          <p className="eyebrow">BLEND &amp; BEAM · STORE OPERATIONS</p>
          <h1>Good to see you</h1>
          <p>Keep products accurate, orders moving, and stock ready for customers.</p>
        </div>
        <Link className="overview-store-link" href="/shop">View the storefront <span aria-hidden="true">↗</span></Link>
      </header>

      {quickActions.length > 0 && (
        <section aria-labelledby="overview-actions-heading" className="overview-section">
          <div className="overview-section-heading">
            <div>
              <p className="eyebrow">YOUR WORKSPACE</p>
              <h2 id="overview-actions-heading">What would you like to do?</h2>
            </div>
          </div>
          <div className="overview-actions">
            {quickActions.map((action) => (
              <Link className="overview-action" href={action.href} key={action.href}>
                <span className="overview-action-icon" aria-hidden="true">↗</span>
                <span><strong>{action.label}</strong><small>{action.detail}</small></span>
                <span className="overview-action-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {canSeeReports && (
        <section aria-labelledby="overview-performance-heading" className="overview-section">
          <div className="overview-section-heading">
            <div>
              <p className="eyebrow">STORE PULSE</p>
              <h2 id="overview-performance-heading">Last 7 days</h2>
            </div>
            <Link className="overview-text-link" href="/admin/reports">View reports <span aria-hidden="true">→</span></Link>
          </div>
          {report ? (
            <>
              <div className="overview-metrics">
                <article className="overview-metric overview-metric-featured">
                  <span>Revenue</span>
                  <strong>{money(kpis?.revenue ?? 0)}</strong>
                  <small>Paid product sales</small>
                </article>
                <article className="overview-metric">
                  <span>Orders</span>
                  <strong>{kpis?.orders ?? 0}</strong>
                  <small>{kpis?.pending ?? 0} pending in this period</small>
                </article>
                <article className="overview-metric">
                  <span>Low stock</span>
                  <strong>{report.inventory.low_stock}</strong>
                  <small>At or below the stock threshold</small>
                </article>
                <article className="overview-metric">
                  <span>Out of stock</span>
                  <strong>{report.inventory.out_of_stock}</strong>
                  <small>Inventory rows with no stock</small>
                </article>
              </div>
              {(report.inventory.low_stock > 0 || report.inventory.out_of_stock > 0) && permissions.has("inventory.manage") && (
                <p className="overview-stock-notice">
                  Stock needs attention. <Link href="/admin/inventory">Review inventory <span aria-hidden="true">→</span></Link>
                </p>
              )}
            </>
          ) : (
            <p className="overview-empty" role="status">
              {reportUnavailable ? "Store metrics could not be loaded right now." : "Metrics will appear here when reporting data is available."}
            </p>
          )}
        </section>
      )}

      {canSeeAudit && (
        <section aria-labelledby="overview-activity-heading" className="overview-section">
          <div className="overview-section-heading">
            <div>
              <p className="eyebrow">TEAM UPDATES</p>
              <h2 id="overview-activity-heading">Recent activity</h2>
            </div>
            <Link className="overview-text-link" href="/admin/audit">View audit log <span aria-hidden="true">→</span></Link>
          </div>
          {activity.length === 0 ? (
            <p className="overview-empty">Actions recorded by your team will appear here.</p>
          ) : (
            <ul className="overview-activity">
              {activity.map((row) => {
                const { verb, entity, label } = describeAudit(row);
                const actor = row.actor_id ? actorById.get(row.actor_id) ?? "Unknown staff" : "System";
                const date = new Date(row.created_at);
                return (
                  <li key={row.id}>
                    <span className="overview-activity-dot" aria-hidden="true" />
                    <p><strong>{actor}</strong> {verb} {entity}{label ? <>: <em>{label}</em></> : null}</p>
                    <time dateTime={row.created_at}>{date.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" })}</time>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="overview-sections-heading" className="overview-section overview-all-sections">
        <div className="overview-section-heading">
          <div>
            <p className="eyebrow">ADMINISTRATION</p>
            <h2 id="overview-sections-heading">All workspaces</h2>
          </div>
          <span className="overview-section-count">{links.length} available</span>
        </div>
        <div className="overview-workspaces">
          {links.map((link) => (
            <Link key={link[1]} href={link[1]}>
              <span>{link[0]}</span><span aria-hidden="true">→</span>
            </Link>
          ))}
          {links.length === 0 && <p className="overview-empty">No additional workspaces are assigned to this account.</p>}
        </div>
      </section>
    </div>
  );
}
