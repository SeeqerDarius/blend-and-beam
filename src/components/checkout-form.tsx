"use client";
import { useState, useRef } from "react";
import { placeOrder } from "@/app/checkout/actions";
import { money } from "@/lib/catalog";
import { BusinessContact } from "@/components/business-contact";
type Zone = {
  id: string;
  name: string;
  regions: string[];
  fee_minor: number;
  free_shipping_threshold_minor: number | null;
};
export function CheckoutForm({ zones }: { zones: Zone[] }) {
  const [region, setRegion] = useState("");
  const [zone, setZone] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{
    number: string;
    total: number;
  } | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      let key = sessionStorage.getItem("bb-checkout-key");
      if (!key) {
        key = crypto.randomUUID();
        sessionStorage.setItem("bb-checkout-key", key);
      }
      const items = JSON.parse(localStorage.getItem("bb-cart") ?? "[]");
      const result = await placeOrder({
        key,
        items,
        zone,
        address: Object.fromEntries(
          ["name", "phone", "address", "city", "region", "gps"].map((k) => [
            k,
            String(form.get(k) ?? ""),
          ]),
        ),
      });
      if (result.error) setError(result.error);
      else if (result.number && result.total !== undefined) {
        setReceipt({ number: result.number, total: result.total });
        localStorage.removeItem("bb-cart");
        sessionStorage.removeItem("bb-checkout-key");
      }
    } catch {
      setError(
        "Connection interrupted. Retry here with the same request, or check your account for confirmation.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (receipt)
    return (
      <section role="status">
        <h2>Order received</h2>
        <p>{receipt.number}</p>
        <p>Payment on delivery · {money(receipt.total)} · Unpaid</p>
        <p>
          Our team may call to confirm your delivery details before dispatch.
        </p>
        <a href="/account">View your orders</a>
        <BusinessContact />
      </section>
    );
  return (
    <form onSubmit={submit} className="stack-form" aria-busy={busy}>
      <fieldset disabled={busy}>
        <legend>Delivery details</legend>
        <div className="form-row">
          <label>
            Full name
            <input
              name="name"
              autoComplete="name"
              minLength={2}
              maxLength={150}
              required
            />
          </label>
          <label>
            Phone
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              pattern="[+0-9 ()\-]{9,20}"
              required
            />
          </label>
        </div>
        <label>
          Address
          <input
            name="address"
            autoComplete="street-address"
            minLength={5}
            maxLength={500}
            required
          />
        </label>
        <label>
          City / town
          <input
            name="city"
            autoComplete="address-level2"
            minLength={2}
            maxLength={100}
            required
          />
        </label>
        <label>
          Region
          <select
            name="region"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setZone("");
            }}
            required
          >
            <option value="">Select region</option>
            {[...new Set(zones.flatMap((z) => z.regions))].sort().map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          Delivery zone
          <select
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            required
          >
            <option value="">Choose supported delivery zone</option>
            {zones
              .filter((z) => z.regions.includes(region))
              .map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} · {money(z.fee_minor)}
                  {z.free_shipping_threshold_minor !== null
                    ? ` (free from ${money(z.free_shipping_threshold_minor)})`
                    : ""}
                </option>
              ))}
          </select>
        </label>
        <label>
          GhanaPost GPS
          <input name="gps" maxLength={80} />
        </label>
        <h2>Payment method</h2>
        <label>
          <input
            type="radio"
            name="payment_method"
            value="cod"
            checked
            readOnly
          />{" "}
          Payment on delivery
        </label>
        <p>
          Available only in the listed locations. Eligibility may require phone
          confirmation. Pay only when your order is delivered.
        </p>
        <p className="fine-print">
          Online payment is not yet available. Product prices, delivery and
          stock are checked on the server when you place your order.
        </p>
        {!zones.length && (
          <p role="status">
            Payment on delivery has not been enabled for any location yet.
            Please contact us to order.
          </p>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button
        disabled={busy || !zone}
        className="button button-dark submit-button"
        type="submit"
      >
        <span style={{ visibility: busy ? "hidden" : "visible" }}>
          Place order · pay on delivery
        </span>
        {busy && (
          <span className="submit-progress" role="status">
            Placing order…
          </span>
        )}
      </button>
      <BusinessContact />
    </form>
  );
}
