export type Profile = {
  id: string;
  handle: string;
  name: string;
  city: string;
  bio: string;
  avatar_url: string | null;
  shelf_public: boolean;
  deleted_at: string | null;
};
export type Shelf = {
  id: string;
  owner_id: string;
  name: string;
  position: number;
};
export type BottleRow = {
  id: string;
  owner_id: string;
  brand: string;
  name: string;
  size_ml: number;
  remaining_percent: number;
  image_path: string | null;
  original_path: string | null;
  condition_path: string | null;
  image_kind: "original" | "cutout";
  image_width: number | null;
  image_height: number | null;
  shelf_id: string;
  position: number;
  condition: string;
  has_cap: boolean;
  has_box: boolean;
  trade_available: boolean;
  reserved_trade_id: string | null;
  methods: ("local" | "shipping")[];
  notes: string;
  version: number;
};
export type BottleForm = {
  brand: string;
  name: string;
  size_ml: number;
  remaining_percent: number;
  condition: string;
  has_cap: boolean;
  has_box: boolean;
  trade_available: boolean;
  methods: ("local" | "shipping")[];
  notes: string;
};
export const emptyBottle: BottleForm = {
  brand: "",
  name: "",
  size_ml: 100,
  remaining_percent: 100,
  condition: "good",
  has_cap: true,
  has_box: false,
  trade_available: false,
  methods: ["local"],
  notes: "",
};
export type Job = {
  id: string;
  owner_id: string;
  status:
    | "uploading"
    | "queued"
    | "waking"
    | "processing"
    | "ready"
    | "failed"
    | "expired";
  original_path: string;
  cutout_path: string;
  width: number;
  height: number;
  error: string | null;
  lease_until: string | null;
  updated_at: string;
  draft: Partial<BottleForm>;
  bottle_id: string | null;
};
export type Exchange = {
  instructions?: string;
  address?: string;
  carrier?: string;
  tracking?: string;
};
export type TradeRow = {
  id: string;
  proposer_id: string;
  recipient_id: string;
  offered_bottle_id: string;
  requested_bottle_id: string;
  method: "local" | "shipping";
  status:
    | "proposed"
    | "in-progress"
    | "paused"
    | "complete"
    | "declined"
    | "cancelled"
    | "expired";
  accepted_by: string[];
  received_by: string[];
  cancel_by: string[];
  resume_by: string[];
  dispatched_by: string[];
  exchange: Record<string, Exchange>;
  snapshot: { offered: BottleRow; requested: BottleRow };
  exchange_note: string;
  expires_at: string;
};
export type BetaState = {
  user_id: string;
  is_admin: boolean;
  profiles: Profile[];
  bottles: BottleRow[];
  shelves: Shelf[];
  trades: TradeRow[];
  messages: {
    id: string;
    trade_id: string;
    sender_id: string;
    text: string;
    sent_at: string;
  }[];
  events: {
    id: string;
    trade_id: string;
    actor_id: string;
    kind: string;
    created_at: string;
  }[];
  notifications: {
    id: string;
    trade_id: string | null;
    kind: string;
    text: string;
    read_at: string | null;
    created_at: string;
  }[];
  jobs: Job[];
  reviews: {
    trade_id: string;
    reviewer_id: string;
    reviewee_id: string;
    rating: number;
    comment: string;
  }[];
  blocks: { blocker_id: string; blocked_id: string }[];
  reports: {
    id: string;
    reason: string;
    status: string;
    trade_id: string | null;
  }[];
};
export const blankState: BetaState = {
  user_id: "",
  is_admin: false,
  profiles: [],
  bottles: [],
  shelves: [],
  trades: [],
  messages: [],
  events: [],
  notifications: [],
  jobs: [],
  reviews: [],
  blocks: [],
  reports: [],
};
export type Draft = {
  id: string;
  uri: string;
  jobId?: string;
  form: BottleForm;
  createdAt: string;
  error?: string;
};
