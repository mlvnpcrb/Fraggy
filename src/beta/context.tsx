import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";
import type { BetaState, Draft } from "./types";
export type Context = {
  mode: "live" | "demo";
  session: Session | null;
  loading: boolean;
  state: BetaState;
  offline: boolean;
  error: string;
  drafts: Draft[];
  refresh: (
    wanted?: readonly import("../features/app/refresh").Section[],
  ) => Promise<void>;
  run: <T = unknown>(
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<T>;
  saveDraft: (draft: Draft) => Promise<void>;
  removeDraft: (id: string) => Promise<void>;
  processDraft: (draft: Draft) => Promise<string>;
  signOut: () => Promise<void>;
};
export const BetaContext = createContext<Context | null>(null);

export function useBeta() {
  const context = useContext(BetaContext);
  if (!context) throw Error("BetaProvider is required.");
  return context;
}
