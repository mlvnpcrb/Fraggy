import { ME, type Bottle, type Method, type Trade } from "./types";
export type ProposalInput = {
  offeredBottleId: string;
  requestedBottleId: string;
  method: Method;
};
export type TradeResult = { trade: Trade; bottles: Bottle[] };
let serial = 0;
function pair(
  input: Pick<Trade, "offeredBottleId" | "requestedBottleId">,
  bottles: Bottle[],
) {
  const offered = bottles.find((b) => b.id === input.offeredBottleId),
    requested = bottles.find((b) => b.id === input.requestedBottleId);
  if (!offered || !requested)
    throw new Error("A bottle is no longer available.");
  return { offered, requested };
}
function participant(trade: Trade, actorId: string) {
  if (actorId !== trade.proposerId && actorId !== trade.recipientId)
    throw new Error("Only these two collectors can confirm this trade.");
}
export function proposeTrade(input: ProposalInput, bottles: Bottle[]): Trade {
  const { offered, requested } = pair(input, bottles);
  if (
    offered.ownerId !== ME ||
    requested.ownerId === ME ||
    offered.id === requested.id
  )
    throw new Error(
      "Choose one of your bottles and one from another collector.",
    );
  for (const b of [offered, requested]) {
    if (!b.tradeAvailable || b.reservedTradeId)
      throw new Error("This bottle is not available to swap.");
    if (!b.methods.includes(input.method))
      throw new Error("Choose an exchange method both collectors offer.");
  }
  return {
    ...input,
    id: `t-${Date.now()}-${++serial}`,
    proposerId: ME,
    recipientId: requested.ownerId,
    acceptedBy: [ME],
    receivedBy: [],
    status: "proposed",
  };
}
export function acceptTrade(
  trade: Trade,
  actorId: string,
  bottles: Bottle[],
): TradeResult {
  participant(trade, actorId);
  if (trade.status === "paused" || trade.status === "complete")
    throw new Error("This trade cannot be accepted.");
  if (trade.status === "in-progress") return { trade, bottles };
  const { offered, requested } = pair(trade, bottles);
  if (
    offered.ownerId !== trade.proposerId ||
    requested.ownerId !== trade.recipientId
  )
    throw new Error("The bottle owner has changed. Start a new offer.");
  for (const b of [offered, requested])
    if (
      !b.tradeAvailable ||
      (b.reservedTradeId && b.reservedTradeId !== trade.id)
    )
      throw new Error("A bottle has been reserved for another trade.");
  const acceptedBy = [...new Set([...trade.acceptedBy, actorId])];
  const both = [trade.proposerId, trade.recipientId].every((id) =>
    acceptedBy.includes(id),
  );
  return {
    trade: { ...trade, acceptedBy, status: both ? "in-progress" : "proposed" },
    bottles: both
      ? bottles.map((b) =>
          b.id === offered.id || b.id === requested.id
            ? { ...b, reservedTradeId: trade.id }
            : b,
        )
      : bottles,
  };
}
export function confirmReceipt(
  trade: Trade,
  actorId: string,
  bottles: Bottle[],
): TradeResult {
  participant(trade, actorId);
  if (trade.status === "complete") return { trade, bottles };
  if (
    trade.status !== "in-progress" ||
    ![trade.proposerId, trade.recipientId].every((id) =>
      trade.acceptedBy.includes(id),
    )
  )
    throw new Error("Both collectors must accept before confirming receipt.");
  const { offered, requested } = pair(trade, bottles);
  if ([offered, requested].some((b) => b.reservedTradeId !== trade.id))
    throw new Error("The bottle reservation has changed.");
  const receivedBy = [...new Set([...trade.receivedBy, actorId])];
  const both = [trade.proposerId, trade.recipientId].every((id) =>
    receivedBy.includes(id),
  );
  return {
    trade: { ...trade, receivedBy, status: both ? "complete" : "in-progress" },
    bottles: both
      ? bottles.map((b) =>
          b.id === offered.id
            ? {
                ...b,
                ownerId: trade.recipientId,
                reservedTradeId: undefined,
                tradeAvailable: false,
              }
            : b.id === requested.id
              ? {
                  ...b,
                  ownerId: trade.proposerId,
                  reservedTradeId: undefined,
                  tradeAvailable: false,
                }
              : b,
        )
      : bottles,
  };
}
export function pauseTrade(trade: Trade): Trade {
  if (trade.status === "complete")
    throw new Error("Completed trades cannot be paused.");
  return { ...trade, status: "paused" };
}
