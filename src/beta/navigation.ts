export type BetaStack = {
  Home: undefined;
  Capture: { draftId?: string; jobId?: string; shelfId?: string };
  Bottle: { id: string };
  Collector: { id: string };
  Trade: { id: string };
  Inbox: undefined;
  Admin: undefined;
  Settings: undefined;
  Activity: undefined;
  Wishlist: undefined;
  PrivacyPreview: undefined;
  Support: undefined;
  Proposal: {
    offeredId: string;
    requestedId: string;
    method: "local" | "shipping";
  };
};
