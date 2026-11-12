import { it, expect } from "vitest";
import { tradeNextStep } from "./progress";
import type { TradeRow } from "../../beta/types";
it("never calls a one-receipt swap complete and keeps disputes paused", () => {
  const t = {
    status: "in-progress",
    received_by: ["a"],
    accepted_by: ["a", "b"],
    dispatched_by: [],
    method: "local",
  } as unknown as TradeRow;
  expect(tradeNextStep(t, "a")).toContain("ownership has not changed");
  expect(tradeNextStep({ ...t, status: "paused" }, "a")).toContain("paused");
});
