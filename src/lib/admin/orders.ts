import type { Database } from "@/lib/supabase/types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];

// Mirrors the state machine enforced by private.transition_order() in the
// database; this copy only drives which buttons render, the DB call is the
// real gate.
export const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["ready_for_dispatch", "cancelled"],
  ready_for_dispatch: ["shipped", "cancelled"],
  shipped: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  ready_for_dispatch: "Ready for dispatch",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};
