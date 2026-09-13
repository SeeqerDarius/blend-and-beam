"use client";
import { useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/catalog";
export function AddToCart({ product }: { product: Product }) {
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="add-button"
        disabled={added}
        onClick={() => {
          try {
            const raw = JSON.parse(localStorage.getItem("bb-cart") ?? "[]");
            const items: Array<{ slug: string; quantity: number }> =
              Array.isArray(raw)
                ? raw.filter(
                    (i) =>
                      typeof i.slug === "string" &&
                      Number.isInteger(i.quantity) &&
                      i.quantity > 0,
                  )
                : [];
            const found = items.find((i) => i.slug === product.slug);
            if (found) found.quantity = Math.min(50, found.quantity + 1);
            else items.push({ slug: product.slug, quantity: 1 });
            localStorage.setItem("bb-cart", JSON.stringify(items));
            sessionStorage.removeItem("bb-checkout-key");
            window.dispatchEvent(new Event("bb-cart-change"));
            setAdded(true);
          } catch {
            setError(
              "Your browser could not save the basket. Please enable site storage or call to order.",
            );
          }
        }}
      >
        {added ? "Added to bag" : "Add to cart"}
      </button>
      {added && (
        <p role="status">
          <Link href="/cart">View your bag and checkout</Link>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
