export const sections = [
  "collection",
  "community",
  "trading",
  "account",
  "jobs",
] as const;
export type Section = (typeof sections)[number];
export function sectionsForTable(table: string): Section[] {
  if (["capture_jobs"].includes(table)) return ["jobs"];
  if (["bottles", "shelves"].includes(table)) return ["collection"];
  if (table === "profiles") return ["community", "collection"];
  if (table === "reviews") return ["community"];
  if (table === "blocks")
    return ["account", "community", "collection", "trading"];
  if (
    ["trade_messages", "trades", "trade_events", "notifications"].includes(
      table,
    )
  )
    return ["trading"];
  if (["blocks", "reports", "wishlist"].includes(table)) return ["account"];
  return [...sections];
}
export function jobPollDelay(attempt: number) {
  return Math.min(30000, 5000 * Math.pow(2, Math.min(attempt, 3)));
}

export const permissionReconcileMs = 60000;

export function sectionsForAction(action: string): Section[] {
  if (["admin_state", "preview_shelf"].includes(action)) return [];
  if (action === "save_capture_draft") return ["jobs"];
  if (["save_wish", "remove_wish"].includes(action)) return ["account"];
  if (action === "finalize_capture") return ["collection", "jobs"];
  if (["save_shelf", "move_bottle"].includes(action)) return ["collection"];
  if (action === "edit_bottle") return ["collection", "trading"];
  if (action === "update_profile") return ["community", "collection"];
  if (
    ["send_message", "mark_notifications_read", "set_trade_note"].includes(
      action,
    )
  )
    return ["trading"];
  if (action === "review_trade") return ["trading", "community"];
  return [...sections];
}
