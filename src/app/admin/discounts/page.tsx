import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/catalog";
import { saveDiscount, setDiscountActive } from "./actions";

export default async function AdminDiscounts({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin("discounts.manage");
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: discounts } = await supabase.from("discount_codes").select("*").order("code");

  return (
    <>
      <p className="eyebrow">PROMOTIONS</p>
      <h2>Discount codes</h2>
      {error && <p className="form-error">{error}</p>}
      <form className="stack-form admin-inline-form" action={saveDiscount}>
        <div className="form-row">
          <label>Code<input name="code" required placeholder="WELCOME10" /></label>
          <label>Type
            <select name="kind" defaultValue="percentage">
              <option value="percentage">Percentage off</option>
              <option value="fixed">Fixed amount off (GH₵)</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>Value<input name="value" type="number" min="1" required /></label>
          <label>Minimum order (GH₵)<input name="minimum" type="number" step="0.01" min="0" defaultValue="0" /></label>
        </div>
        <div className="form-row">
          <label>Max redemptions<input name="maxRedemptions" type="number" min="1" /></label>
          <label>Per customer limit<input name="perCustomer" type="number" min="1" /></label>
        </div>
        <div className="form-row">
          <label>Starts<input name="startsAt" type="date" /></label>
          <label>Expires<input name="expiresAt" type="date" /></label>
        </div>
        <label className="checkbox-label"><input type="checkbox" name="isActive" defaultChecked /> Active</label>
        <button className="button button-dark" type="submit">Create code</button>
      </form>
      <table className="admin-table">
        <thead><tr><th>Code</th><th>Discount</th><th>Minimum</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {(discounts ?? []).length === 0 ? (
            <tr><td colSpan={5}>No discount codes yet.</td></tr>
          ) : (discounts ?? []).map((d) => (
            <tr key={d.id}>
              <td>{d.code}</td>
              <td>{d.kind === "percentage" ? `${d.value}%` : money(d.value)}</td>
              <td>{money(d.minimum_minor)}</td>
              <td><span className={`pill ${d.is_active ? "pill-active" : "pill-draft"}`}>{d.is_active ? "Active" : "Inactive"}</span></td>
              <td className="admin-row-actions">
                <form action={setDiscountActive.bind(null, d.id, !d.is_active)}>
                  <button className="text-link" type="submit">{d.is_active ? "Deactivate" : "Activate"}</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
