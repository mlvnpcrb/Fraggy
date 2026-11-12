import { it, expect, vi } from "vitest";
import { chooseMode, loadApplication } from "./mode";
it("admin alias opens only the demo loader and never loads live auth", async () => {
  const live = vi.fn(),
    demo = vi.fn(async () => "demo");
  expect(chooseMode(" ADMIN ", "admin")).toBe("demo");
  expect(chooseMode("admin", "Admin")).toBeNull();
  await loadApplication("demo", { live, demo });
  expect(live).not.toHaveBeenCalled();
  expect(demo).toHaveBeenCalledOnce();
});
