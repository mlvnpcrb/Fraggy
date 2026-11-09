import { describe, expect, it } from "vitest";
import {
  proposeTrade,
  acceptTrade,
  confirmReceipt,
  pauseTrade,
} from "./trades";
import type { Bottle, Trade } from "./types";
const bottle = (id: string, ownerId: string): Bottle => ({
  id,
  ownerId,
  brand: "Brand",
  name: id,
  sizeMl: 100,
  remainingPercent: 80,
  imageKind: "sample-cutout",
  art: "amber",
  tradeAvailable: true,
  notes: "Woody",
  methods: ["local", "shipping"],
});
const bottles = [
  bottle("mine", "you"),
  bottle("theirs", "alex"),
  bottle("other", "you"),
];
const proposal = (bs = bottles) =>
  proposeTrade(
    {
      offeredBottleId: "mine",
      requestedBottleId: "theirs",
      method: "shipping",
    },
    bs,
  );
const accepted = () => {
  const p = proposal();
  return acceptTrade(p, "alex", bottles);
};
describe("propose a swap", () => {
  it("starts with only the proposer accepting", () => {
    const t = proposal();
    expect(t.acceptedBy).toEqual(["you"]);
    expect(t.status).toBe("proposed");
    expect(t.recipientId).toBe("alex");
  });
  it("rejects bottles owned by other collectors and self swaps", () => {
    expect(() =>
      proposeTrade(
        {
          offeredBottleId: "theirs",
          requestedBottleId: "mine",
          method: "local",
        },
        bottles,
      ),
    ).toThrow();
    expect(() =>
      proposeTrade(
        {
          offeredBottleId: "mine",
          requestedBottleId: "other",
          method: "local",
        },
        bottles,
      ),
    ).toThrow();
    expect(() =>
      proposeTrade(
        { offeredBottleId: "mine", requestedBottleId: "mine", method: "local" },
        bottles,
      ),
    ).toThrow();
  });
  it("rejects reserved, unavailable and unsupported method offers", () => {
    expect(() =>
      proposal([
        { ...bottles[0], reservedTradeId: "locked" },
        ...bottles.slice(1),
      ]),
    ).toThrow();
    expect(() =>
      proposal([{ ...bottles[0], tradeAvailable: false }, ...bottles.slice(1)]),
    ).toThrow();
    expect(() =>
      proposal([bottles[0], { ...bottles[1], methods: ["local"] }, bottles[2]]),
    ).toThrow();
  });
});
describe("confirm a trade", () => {
  it("rejects receipt before both accept and rejects unrelated actors", () => {
    const p = proposal();
    expect(() => confirmReceipt(p, "you", bottles)).toThrow();
    expect(() => acceptTrade(p, "intruder", bottles)).toThrow();
    const a = accepted();
    expect(() => confirmReceipt(a.trade, "intruder", a.bottles)).toThrow();
  });
  it("reserves both bottles only after mutual acceptance", () => {
    const a = accepted();
    expect(a.trade.status).toBe("in-progress");
    expect(
      a.bottles.slice(0, 2).every((b) => b.reservedTradeId === a.trade.id),
    ).toBe(true);
    expect(bottles[0].reservedTradeId).toBeUndefined();
  });
  it.each([
    ["you", "alex"],
    ["alex", "you"],
  ])(
    "transfers ownership only after both receipts (%s first)",
    (first, second) => {
      const a = accepted();
      const one = confirmReceipt(a.trade, first, a.bottles);
      expect(one.bottles[0].ownerId).toBe("you");
      expect(one.bottles[1].ownerId).toBe("alex");
      expect(one.trade.status).toBe("in-progress");
      const two = confirmReceipt(one.trade, second, one.bottles);
      expect(two.trade.status).toBe("complete");
      expect(two.bottles[0].ownerId).toBe("alex");
      expect(two.bottles[1].ownerId).toBe("you");
      expect(two.bottles[0].reservedTradeId).toBeUndefined();
      expect(two.bottles[1].tradeAvailable).toBe(false);
      expect(confirmReceipt(two.trade, second, two.bottles)).toEqual(two);
      expect(two.trade.proposerId).toBe("you");
    },
  );
  it("duplicate receipt never counts as two collectors", () => {
    const a = accepted();
    const one = confirmReceipt(a.trade, "you", a.bottles);
    const repeat = confirmReceipt(one.trade, "you", one.bottles);
    expect(repeat.trade.receivedBy).toEqual(["you"]);
    expect(repeat.trade.status).toBe("in-progress");
  });
  it("rejects conflicting reservations at acceptance time", () => {
    const p = proposal();
    expect(() =>
      acceptTrade(p, "alex", [
        { ...bottles[0], reservedTradeId: "another" },
        ...bottles.slice(1),
      ]),
    ).toThrow();
  });
  it("pauses a trade without releasing bottles or allowing completion", () => {
    const a = accepted();
    const paused = pauseTrade(a.trade);
    expect(paused.status).toBe("paused");
    expect(() => confirmReceipt(paused, "you", a.bottles)).toThrow();
    expect(a.bottles[0].reservedTradeId).toBe(a.trade.id);
  });
});
