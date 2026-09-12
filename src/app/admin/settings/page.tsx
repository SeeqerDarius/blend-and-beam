import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/catalog";
import { saveShippingZone, setShippingZoneActive } from "./actions";

export default async function AdminSettings({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin("settings.manage");
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: zones } = await supabase.from("shipping_zones").select("*").order("name");

  return (
    <>
      <p className="eyebrow">STORE SETTINGS</p>
      <h2>Shipping zones</h2>
      {error && <p className="form-error">{error}</p>}
      <form className="stack-form admin-inline-form" action={saveShippingZone}>
        <div className="form-row">
          <label>Zone name<input name="name" required placeholder="Greater Accra" /></label>
          <label>Regions (comma separated)<input name="regions" required placeholder="Greater Accra" /></label>
        </div>
        <div className="form-row">
          <label>Fee (GH₵)<input name="fee" type="number" step="0.01" min="0" required /></label>
          <label>Free shipping over (GH₵)<input name="freeThreshold" type="number" step="0.01" min="0" /></label>
        </div>
        <label>Delivery estimate<input name="estimate" required placeholder="1–3 business days" /></label>
        <label className="checkbox-label"><input type="checkbox" name="isActive" defaultChecked /> Active</label>
        <button className="button button-dark" type="submit">Add zone</button>
      </form>
      <table className="admin-table">
        <thead><tr><th>Zone</th><th>Regions</th><th>Fee</th><th>Estimate</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {(zones ?? []).length === 0 ? (
            <tr><td colSpan={6}>No shipping zones yet.</td></tr>
          ) : (zones ?? []).map((z) => (
            <tr key={z.id}>
              <td>{z.name}</td>
              <td>{z.regions.join(", ")}</td>
              <td>{money(z.fee_minor)}</td>
              <td>{z.estimate}</td>
              <td><span className={`pill ${z.is_active ? "pill-active" : "pill-draft"}`}>{z.is_active ? "Active" : "Inactive"}</span></td>
              <td className="admin-row-actions">
                <form action={setShippingZoneActive.bind(null, z.id, !z.is_active)}>
                  <button className="text-link" type="submit">{z.is_active ? "Deactivate" : "Activate"}</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
