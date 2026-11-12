import type { TradeRow } from "../../beta/types";
export function tradeNextStep(t: TradeRow, me: string): string {
  if (t.status === "complete")
    return "Swap complete. Both receipts are confirmed. You can leave a review.";
  if (["cancelled", "declined", "expired"].includes(t.status))
    return "This offer has ended. No new exchange actions are available.";
  if (t.status === "paused")
    return "Exchange paused. Resolve the problem together before continuing.";
  if (t.status === "proposed")
    return t.accepted_by.includes(me)
      ? "Waiting for the other collector to agree. Neither bottle is reserved yet."
      : "Review the agreed bottles and accept or decline the offer.";
  if (t.received_by.includes(me))
    return "Your receipt is confirmed. Waiting for the other collector; ownership has not changed yet.";
  if (t.method === "shipping" && !t.dispatched_by.includes(me))
    return "Agree shipping details in chat, add tracking and confirm dispatch.";
  return "Complete the exchange. Only confirm receipt after inspecting the agreed bottle.";
}
