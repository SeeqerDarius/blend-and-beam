import Link from "next/link";
import { requireStaff } from "@/lib/admin-auth";
import { money } from "@/lib/catalog";
import { reportRange, type Report } from "@/lib/reporting";
export async function ReportsDashboard({
  query,
}: {
  query: { range?: string; from?: string; to?: string };
}) {
  const { db } = await requireStaff("reports.read");
  let range;
  try {
    range = reportRange(query);
  } catch (error) {
    return (
      <p role="alert">
        {(error as Error).message}{" "}
        <Link href="/admin/reports">Reset filters</Link>
      </p>
    );
  }
  const { data, error } = await db.rpc("commerce_report", {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw new Error("Reports could not be loaded. Please retry.");
  const r = data as unknown as Report;
  const c = r.kpis.current,
    p = r.kpis.previous;
  const change = (current: number, previous: number) =>
    previous === 0
      ? current
        ? "No preceding-period baseline"
        : "No change"
      : `${current >= previous ? "+" : ""}${(((current - previous) / previous) * 100).toFixed(1)}% vs preceding period`;
  const cards = [
    {
      label: "Product revenue",
      value: money(c?.revenue ?? 0),
      delta: change(c?.revenue ?? 0, p?.revenue ?? 0),
    },
    {
      label: "Orders",
      value: String(c?.orders ?? 0),
      delta: change(c?.orders ?? 0, p?.orders ?? 0),
    },
    {
      label: "Average order value",
      value: money((c?.revenue ?? 0) / (c?.sales_orders || 1)),
      delta: change(
        (c?.revenue ?? 0) / (c?.sales_orders || 1),
        (p?.revenue ?? 0) / (p?.sales_orders || 1),
      ),
    },
    {
      label: "Units sold",
      value: String(c?.units ?? 0),
      delta: change(c?.units ?? 0, p?.units ?? 0),
    },
  ];
  const max = Math.max(1, ...r.trend.map((d) => d.revenue));
  return (
    <>
      <p className="eyebrow">BUSINESS PERFORMANCE</p>
      <h1>Reports</h1>
      <form className="report-filter" action="/admin/reports">
        <label>
          Period
          <select name="range" defaultValue={query.range ?? "30"}>
            <option value="1">Today</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        <label>
          From
          <input type="date" name="from" defaultValue={range.from} />
        </label>
        <label>
          To
          <input type="date" name="to" defaultValue={range.to} />
        </label>
        <button className="button button-dark">Apply filters</button>
        <a
          className="button"
          href={`/admin/reports/export?from=${range.from}&to=${range.to}`}
        >
          Export CSV
        </a>
      </form>
      <p>
        {range.from} – {range.to} · Africa/Accra · Compared with the preceding
        equivalent period
      </p>
      <div className="report-kpis">
        {cards.map((card) => (
          <article className="operations-card" key={card.label}>
            <h2>{card.label}</h2>
            <strong>{card.value}</strong>
            <small>{card.delta}</small>
          </article>
        ))}
      </div>
      <p className="fine-print">
        Revenue and units include paid orders excluding cancelled and returned
        orders. Revenue excludes delivery and tax. Average order value is
        product revenue divided by those orders.
      </p>
      {!c?.orders && (
        <p className="operations-notice" role="status">
          No orders in this period. Results will appear as orders are received.
        </p>
      )}
      <section className="operations-card">
        <h2>Sales trend</h2>
        {!c?.revenue ? (
          <p>No paid product sales in this period.</p>
        ) : (
          <>
            <p>Daily product revenue in GHS</p>
            <div className="sales-trend" role="list">
              {r.trend.map((day) => (
                <div
                  key={day.day}
                  role="listitem"
                  tabIndex={0}
                  title={`${day.day}: ${money(day.revenue)}`}
                  aria-label={`${day.day}: ${money(day.revenue)}`}
                >
                  <span
                    style={{
                      height: `${Math.max(1, (day.revenue / max) * 100)}%`,
                    }}
                  />
                  <small>{day.day.slice(5)}</small>
                </div>
              ))}
            </div>
            <details>
              <summary>View daily values</summary>
              <DataTable rows={r.trend} moneyKeys={["revenue"]} />
            </details>
          </>
        )}
      </section>
      <div className="report-columns">
        <section className="operations-card">
          <h2>Order progress</h2>
          <DataTable
            rows={[
              {
                paid: c?.paid ?? 0,
                unpaid: c?.unpaid ?? 0,
                pending: c?.pending ?? 0,
                delivered: c?.delivered ?? 0,
                cancelled: c?.cancelled ?? 0,
                returned: c?.returned ?? 0,
              },
            ]}
          />
          <p className="fine-print">Payment and fulfillment counts overlap.</p>
        </section>
        <section className="operations-card">
          <h2>Gross profit</h2>
          <strong>
            {c?.gross_profit == null
              ? "Cost data unavailable"
              : money(c.gross_profit)}
          </strong>
          <p>
            Margin:{" "}
            {c?.costed_revenue
              ? `${(((c.gross_profit ?? 0) / c.costed_revenue) * 100).toFixed(1)}%`
              : "Unavailable"}
          </p>
          <p className="fine-print">
            Based on sale-time costs for{" "}
            {c?.uncosted_lines
              ? `costed items only; ${c.uncosted_lines} sale lines have no cost.`
              : "costed items."}{" "}
            Missing costs are excluded, never treated as zero.
          </p>
        </section>
      </div>
      <section className="operations-card">
        <h2>COD and online payment</h2>
        <DataTable rows={r.payment_methods} moneyKeys={["collected_total"]} />
        <p className="fine-print">
          Collected totals include delivery and tax; cancelled and returned
          orders are excluded.
        </p>
      </section>
      <div className="report-columns">
        <section className="operations-card">
          <h2>Top products by revenue</h2>
          <DataTable rows={r.top_revenue} moneyKeys={["revenue"]} />
        </section>
        <section className="operations-card">
          <h2>Top products by units</h2>
          <DataTable rows={r.top_units} moneyKeys={["revenue"]} />
        </section>
      </div>
      <section className="operations-card">
        <h2>Category performance</h2>
        <DataTable rows={r.categories} moneyKeys={["revenue"]} />
        <p className="fine-print">
          Products with multiple categories are assigned once, to the first
          category by stable identifier. Current categorisation applies.
        </p>
      </section>
      <div className="report-columns">
        <section className="operations-card">
          <h2>Inventory health</h2>
          <p>
            {r.inventory.low_stock} low stock · {r.inventory.out_of_stock} out
            of stock
          </p>
          <p>
            Known inventory cost:{" "}
            <strong>
              {r.inventory.value == null
                ? "Unavailable"
                : money(r.inventory.value)}
            </strong>
          </p>
          <p className="fine-print">
            Current active base-product stock at recorded cost.{" "}
            {r.inventory.uncosted} rows have missing or variant-specific cost
            data and are excluded. Inventory is a current snapshot, independent
            of the date filter.
          </p>
          <DataTable rows={r.stock} />
          <Link href="/admin/inventory">Manage inventory</Link>
        </section>
        <section className="operations-card">
          <h2>Customers and locations</h2>
          <p>
            {r.customers.ordering_customers} ordering customers ·{" "}
            {r.customers.repeat_customers} placed multiple orders in this period
          </p>
          <DataTable rows={r.geography} moneyKeys={["collected_total"]} />
        </section>
      </div>
    </>
  );
}
function DataTable({
  rows,
  moneyKeys = [],
}: {
  rows: object[];
  moneyKeys?: string[];
}) {
  if (!rows.length) return <p>No data in this period.</p>;
  const keys = Object.keys(rows[0]);
  return (
    <div className="table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            {keys.map((k) => (
              <th scope="col" key={k}>
                {k.replaceAll("_", " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {keys.map((k) => {
                const value = (row as Record<string, unknown>)[k];
                return (
                  <td key={k}>
                    {value == null
                      ? "—"
                      : moneyKeys.includes(k)
                        ? money(Number(value))
                        : String(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
