import { describe, expect, it } from "vitest";
import { addBottle } from "./collection";
import type { BottleInput } from "./types";
const input: BottleInput = {
  brand: "Le Labo",
  name: "Santal 33",
  sizeMl: 100,
  remainingPercent: 80,
  imageKind: "original",
  imageUri: "file:///photo.jpg",
  tradeAvailable: true,
  art: "amber",
  notes: "Woody",
  methods: ["local", "shipping"],
};
describe("local collection", () => {
  it.each([
    { name: " " },
    { brand: " " },
    { sizeMl: 0 },
    { sizeMl: -1 },
    { sizeMl: NaN },
    { remainingPercent: 101 },
    { remainingPercent: -1 },
    { remainingPercent: Infinity },
  ])("rejects invalid bottle values %j", (values) => {
    expect(() => addBottle({ ...input, ...values })).toThrow();
  });
  it("preserves an original photo without claiming background removal", () => {
    const bottle = addBottle({ ...input, name: " Santal 33 " });
    expect(bottle.name).toBe("Santal 33");
    expect(bottle.ownerId).toBe("you");
    expect(bottle.imageKind).toBe("original");
    expect(bottle.imageUri).toBe(input.imageUri);
    expect(bottle.id).not.toBe(addBottle(input).id);
  });
});
