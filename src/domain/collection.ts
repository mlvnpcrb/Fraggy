import { ME, type Bottle, type BottleInput } from "./types";
let serial = 0;
export function addBottle(input: BottleInput): Bottle {
  if (!input.name.trim() || !input.brand.trim())
    throw new Error("Add the fragrance name and brand.");
  if (!Number.isFinite(input.sizeMl) || input.sizeMl <= 0)
    throw new Error("Bottle size must be greater than zero.");
  if (
    !Number.isFinite(input.remainingPercent) ||
    input.remainingPercent < 0 ||
    input.remainingPercent > 100
  )
    throw new Error("Remaining amount must be between 0 and 100%.");
  if (input.imageKind === "original" && !input.imageUri)
    throw new Error("Choose a bottle photo first.");
  return {
    ...input,
    name: input.name.trim(),
    brand: input.brand.trim(),
    ownerId: ME,
    id: `b-${Date.now()}-${++serial}`,
  };
}
