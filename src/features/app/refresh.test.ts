import { expect, it } from "vitest";
import { sectionsForTable, jobPollDelay, sectionsForAction } from "./refresh";
it("invalidates only relevant slices and bounds job polling", () => {
  expect(sectionsForTable("trade_messages")).toEqual(["trading"]);
  expect(sectionsForTable("capture_jobs")).toEqual(["jobs"]);
  expect(jobPollDelay(0)).toBe(5000);
  expect(jobPollDelay(20)).toBe(30000);
});

it("rechecks collection permissions when visibility dependencies change", () => {
  expect(sectionsForTable("profiles")).toContain("collection");
  expect(sectionsForTable("blocks")).toContain("collection");
});

it("draft autosave and chat do not refetch unrelated collections", () => {
  expect(sectionsForAction("save_capture_draft")).toEqual(["jobs"]);
  expect(sectionsForAction("send_message")).toEqual(["trading"]);
});
