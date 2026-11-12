import {
  blankState,
  emptyBottle,
  type BetaState,
  type BottleRow,
} from "../../beta/types";
import { customEntry } from "../../../supabase/functions/_shared/catalog";
import { samplePhoto } from "./samplePhoto";
export const demoUser = "demo-you",
  demoOther = "demo-mika";
const id = () => `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const now = () => new Date().toISOString();
export function demoSeed(): BetaState {
  const bottle = (owner: string, name: string, key: string): BottleRow => ({
    ...emptyBottle,
    id: key,
    owner_id: owner,
    brand: "Sample house",
    name,
    size_ml: 100,
    remaining_percent: 80,
    condition: "good",
    image_path: samplePhoto,
    original_path: samplePhoto,
    condition_path: null,
    image_kind: "cutout",
    image_width: 200,
    image_height: 400,
    shelf_id: owner + "-shelf",
    position: 0,
    reserved_trade_id: null,
    trade_available: true,
    version: 1,
    methods: ["local", "shipping"],
    fragrance: customEntry({ brand: "Sample house", name }),
  });
  return {
    ...blankState,
    user_id: demoUser,
    is_admin: false,
    profiles: [
      {
        id: demoUser,
        handle: "@you",
        name: "Your demo collection",
        city: "Manila",
        bio: "Demo collector",
        shelf_public: false,
        avatar_url: null,
        deleted_at: null,
      },
      {
        id: demoOther,
        handle: "@mika",
        name: "Mika · sample collector",
        city: "Makati",
        bio: "Sample trading partner",
        shelf_public: true,
        avatar_url: null,
        deleted_at: null,
      },
    ],
    shelves: [
      {
        id: demoUser + "-shelf",
        owner_id: demoUser,
        name: "The daily rotation",
        position: 0,
      },
      {
        id: demoOther + "-shelf",
        owner_id: demoOther,
        name: "Mika’s shelf",
        position: 0,
      },
    ],
    bottles: [
      bottle(demoUser, "Sample fresh", "demo-bottle-a"),
      bottle(demoOther, "Sample woody", "demo-bottle-b"),
    ],
    wishlist: [],
  };
}
export function demoAction(
  previous: BetaState,
  name: string,
  args: Record<string, unknown>,
): { state: BetaState; value: unknown } {
  const s = JSON.parse(JSON.stringify(previous)) as BetaState,
    p = args as any,
    me = demoUser;
  let value: unknown = null;
  const trade = () => {
    const t = s.trades.find((t) => t.id === p.p_trade);
    if (!t) throw Error("Demo trade not found.");
    return t;
  };
  switch (name) {
    case "update_profile":
      Object.assign(
        s.profiles.find((x) => x.id === me)!,
        p.p_data,
      );
      break;
    case "save_shelf": {
      const sh = s.shelves.find((x) => x.id === p.p_id);
      if (!String(p.p_name || "").trim()) throw Error("Add a shelf name.");
      if (sh) sh.name = p.p_name;
      else
        s.shelves.push({
          id: id(),
          owner_id: me,
          name: p.p_name,
          position: s.shelves.length,
        });
      value = sh?.id || s.shelves.at(-1)!.id;
      break;
    }
    case "move_bottle": {
      const b = s.bottles.find((x) => x.id === p.p_bottle && x.owner_id === me);
      if (!b || b.reserved_trade_id) throw Error("Bottle unavailable.");
      b.shelf_id = p.p_shelf;
      b.position = p.p_position;
      break;
    }
    case "edit_bottle": {
      const b = s.bottles.find((x) => x.id === p.p_bottle && x.owner_id === me);
      if (!b || b.reserved_trade_id)
        throw Error("Reserved bottles cannot be edited.");
      Object.assign(b, p.p_data, { version: b.version + 1 });
      if (p.p_data.archived) s.bottles = s.bottles.filter((x) => x.id !== b.id);
      s.trades.forEach((t) => {
        if (
          t.status === "proposed" &&
          [t.offered_bottle_id, t.requested_bottle_id].includes(b.id)
        )
          t.status = "expired";
      });
      break;
    }
    case "save_capture_draft": {
      const j = s.jobs.find((x) => x.id === p.p_job);
      if (j) j.draft = p.p_draft;
      break;
    }
    case "finalize_capture": {
      const j = s.jobs.find((x) => x.id === p.p_job);
      if (!j || j.status !== "ready")
        throw Error("Sample cutout is not ready.");
      if (j.bottle_id) {
        value = j.bottle_id;
        break;
      }
      const b = {
        ...s.bottles[0],
        ...emptyBottle,
        ...p.p_data,
        id: id(),
        owner_id: me,
        shelf_id: p.p_shelf || me + "-shelf",
        image_path: samplePhoto,
        original_path: samplePhoto,
        version: 1,
        reserved_trade_id: null,
      } as BottleRow;
      s.bottles.push(b);
      j.bottle_id = b.id;
      value = b.id;
      break;
    }
    case "save_wish": {
      const entry = p.p_fragrance,
        existing = (s.wishlist || []).find(
          (w) =>
            w.fragrance.source === entry.source &&
            (entry.source === "scento"
              ? w.fragrance.reference?.id === entry.reference.id
              : [
                  w.fragrance.details.brand,
                  w.fragrance.details.name,
                  w.fragrance.details.concentration || "",
                ]
                  .map((v) => v.trim().toLowerCase())
                  .join(":") ===
                [
                  entry.details.brand,
                  entry.details.name,
                  entry.details.concentration || "",
                ]
                  .map((v: string) => v.trim().toLowerCase())
                  .join(":")),
        );
      if (existing) value = existing.id;
      else {
        const w = {
          id: id(),
          owner_id: me,
          fragrance: entry,
          created_at: now(),
        };
        s.wishlist = [w, ...(s.wishlist || [])];
        value = w.id;
      }
      break;
    }
    case "remove_wish":
      s.wishlist = s.wishlist?.filter((w) => w.id !== p.p_id);
      break;
    case "propose_trade": {
      const o = s.bottles.find((x) => x.id === p.p_offered),
        r = s.bottles.find((x) => x.id === p.p_requested);
      if (
        !o ||
        !r ||
        o.owner_id !== me ||
        r.owner_id === me ||
        o.reserved_trade_id ||
        r.reserved_trade_id
      )
        throw Error("Choose two available bottles.");
      value = id();
      s.trades.unshift({
        id: value as string,
        proposer_id: me,
        recipient_id: r.owner_id,
        offered_bottle_id: o.id,
        requested_bottle_id: r.id,
        method: p.p_method,
        status: "proposed",
        accepted_by: [me],
        received_by: [],
        cancel_by: [],
        resume_by: [],
        dispatched_by: [],
        exchange: {},
        exchange_note: "",
        snapshot: { offered: o, requested: r },
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
      break;
    }
    case "accept_trade":
    case "demo_other_accept": {
      const t = trade();
      if (t.status !== "proposed")
        throw Error("This proposal is no longer open.");
      const actor = name === "demo_other_accept" ? t.recipient_id : me;
      t.accepted_by = [...new Set([...t.accepted_by, actor])];
      if (
        t.accepted_by.includes(t.proposer_id) &&
        t.accepted_by.includes(t.recipient_id)
      ) {
        for (const b of s.bottles.filter((b) =>
          [t.offered_bottle_id, t.requested_bottle_id].includes(b.id),
        )) {
          if (b.reserved_trade_id) throw Error("Bottle already reserved.");
          b.reserved_trade_id = t.id;
        }
        t.status = "in-progress";
      }
      break;
    }
    case "confirm_receipt":
    case "demo_other_receipt": {
      const t = trade();
      if (t.status === "complete") break;
      if (t.status !== "in-progress")
        throw Error("Trade must be agreed first.");
      t.received_by = [
        ...new Set([
          ...t.received_by,
          name === "demo_other_receipt" ? t.recipient_id : me,
        ]),
      ];
      if (
        t.received_by.includes(t.proposer_id) &&
        t.received_by.includes(t.recipient_id)
      ) {
        for (const b of s.bottles.filter((b) =>
          [t.offered_bottle_id, t.requested_bottle_id].includes(b.id),
        )) {
          b.owner_id = b.owner_id === me ? t.recipient_id : me;
          b.shelf_id = b.owner_id + "-shelf";
          b.reserved_trade_id = null;
          b.trade_available = false;
        }
        t.status = "complete";
      }
      break;
    }
    case "pause_trade":
      trade().status = "paused";
      break;
    case "trade_action": {
      const t = trade();
      if (p.p_action === "exchange") t.exchange[me] = p.p_data;
      if (p.p_action === "dispatch")
        t.dispatched_by = [...new Set([...t.dispatched_by, me])];
      if (p.p_action === "decline") t.status = "declined";
      if (p.p_action === "cancel") {
        if (t.status === "proposed") t.status = "cancelled";
        else
          throw Error(
            "Demo: mutual cancellation requires both collectors. Report a problem to pause.",
          );
      }
      break;
    }
    case "send_message": {
      trade();
      if (!String(p.p_text || "").trim()) throw Error("Write a message.");
      value = id();
      s.messages.push({
        id: value as string,
        trade_id: p.p_trade,
        sender_id: me,
        text: p.p_text,
        sent_at: now(),
      });
      break;
    }
    case "mark_notifications_read":
      s.notifications.forEach((n) => {
        if (!p.p_trade || n.trade_id === p.p_trade) n.read_at = now();
      });
      break;
    case "review_trade": {
      const t = trade();
      if (t.status !== "complete") throw Error("Complete the trade first.");
      if (!s.reviews.some((r) => r.trade_id === t.id && r.reviewer_id === me))
        s.reviews.push({
          trade_id: t.id,
          reviewer_id: me,
          reviewee_id: t.recipient_id,
          rating: p.p_rating,
          comment: p.p_comment || "",
        });
      break;
    }
    case "block_collector":
      s.blocks = s.blocks.filter((x) => x.blocked_id !== p.p_user);
      if (p.p_block !== false)
        s.blocks.push({ blocker_id: me, blocked_id: p.p_user });
      break;
    case "report_problem":
      s.reports.push({
        id: id(),
        reason: p.p_reason,
        status: "open",
        trade_id: p.p_trade || null,
      });
      break;
    default:
      throw Error(
        "This action requires a live account. Demo changes stay on this device.",
      );
  }
  return { state: s, value };
}
