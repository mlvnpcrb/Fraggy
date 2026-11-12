import { it, expect } from "vitest";
import { demoSeed, demoAction } from "./demoStore";
it("simulates two-party ownership only after both explicit receipt actions", () => {
  let s = demoSeed();
  let result = demoAction(s, "propose_trade", {
    p_offered: "demo-bottle-a",
    p_requested: "demo-bottle-b",
    p_method: "local",
  });
  s = result.state;
  const p = { p_trade: result.value };
  expect(s.bottles[0].reserved_trade_id).toBeNull();
  s = demoAction(s, "demo_other_accept", p).state;
  expect(s.bottles[0].reserved_trade_id).toBe(p.p_trade);
  s = demoAction(s, "confirm_receipt", p).state;
  expect(s.bottles[0].owner_id).toBe("demo-you");
  s = demoAction(s, "demo_other_receipt", p).state;
  expect(s.bottles[0].owner_id).toBe("demo-mika");
  expect(demoAction(s, "demo_other_receipt", p).state.bottles[0].owner_id).toBe(
    "demo-mika",
  );
});

it("keeps custom concentrations and catalog entries separate", () => {
  let s = demoSeed();
  const make = (source: "custom" | "scento", concentration: string) => ({
    source,
    reference:
      source === "scento"
        ? {
            provider: "scento",
            id: "example",
            sourceUrl: "https://www.scento.com/perfumes/example",
            fetchedAt: "now",
          }
        : null,
    details: {
      brand: "House",
      name: "Example",
      concentration,
      family: null,
      top: [],
      heart: [],
      base: [],
      unstructuredNotes: [],
    },
    overrides: {},
  });
  for (const entry of [
    make("custom", "EDP"),
    make("custom", "EDT"),
    make("scento", "EDP"),
  ])
    s = demoAction(s, "save_wish", { p_fragrance: entry }).state;
  expect(s.wishlist).toHaveLength(3);
});
