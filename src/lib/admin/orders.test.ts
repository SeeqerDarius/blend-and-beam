import { describe, expect, it } from "vitest";
import { allowedTransitions, orderStatusLabels } from "./orders";

describe("order transitions", () => {
  it("has no transitions out of terminal states", () => {
    expect(allowedTransitions.cancelled).toEqual([]);
    expect(allowedTransitions.returned).toEqual([]);
  });

  it("always allows cancelling from a pre-fulfilment state", () => {
    expect(allowedTransitions.pending).toContain("cancelled");
    expect(allowedTransitions.confirmed).toContain("cancelled");
  });

  it("has a label for every status referenced in the transition map", () => {
    const statuses = new Set(Object.keys(allowedTransitions));
    for (const nextStatuses of Object.values(allowedTransitions)) {
      for (const status of nextStatuses) statuses.add(status);
    }
    for (const status of statuses) expect(orderStatusLabels[status as keyof typeof orderStatusLabels]).toBeTruthy();
  });
});
