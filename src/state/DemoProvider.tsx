import React, { createContext, useContext, useRef, useState } from "react";
import { createDemo } from "../data/demo";
import { addBottle as createBottle } from "../domain/collection";
import {
  acceptTrade,
  confirmReceipt,
  pauseTrade,
  proposeTrade,
  type ProposalInput,
} from "../domain/trades";
import {
  ME,
  type BottleInput,
  type DemoState,
  type Trade,
} from "../domain/types";
type Context = DemoState & {
  addBottle: (input: BottleInput) => void;
  propose: (input: ProposalInput) => string;
  act: (
    id: string,
    action: "accept" | "receive" | "pause",
    actor?: string,
  ) => void;
  reset: () => void;
};
const DemoContext = createContext<Context | null>(null);
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(createDemo);
  const current = useRef(state);
  const publish = (next: DemoState) => {
    current.current = next;
    setState(next);
  };
  const addBottle = (input: BottleInput) => {
    const bottle = createBottle(input);
    publish({
      ...current.current,
      bottles: [bottle, ...current.current.bottles],
    });
  };
  const propose = (input: ProposalInput) => {
    const s = current.current;
    const trade = proposeTrade(input, s.bottles);
    publish({ ...s, trades: [trade, ...s.trades] });
    return trade.id;
  };
  const act = (
    id: string,
    action: "accept" | "receive" | "pause",
    actor = ME,
  ) => {
    const s = current.current,
      t = s.trades.find((t) => t.id === id);
    if (!t) throw new Error("Trade not found.");
    const result =
      action === "accept"
        ? acceptTrade(t, actor, s.bottles)
        : action === "receive"
          ? confirmReceipt(t, actor, s.bottles)
          : { trade: pauseTrade(t), bottles: s.bottles };
    publish({
      bottles: result.bottles,
      trades: s.trades.map((old: Trade) =>
        old.id === id ? result.trade : old,
      ),
    });
  };
  return (
    <DemoContext.Provider
      value={{
        ...state,
        addBottle,
        propose,
        act,
        reset: () => publish(createDemo()),
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw Error("DemoProvider missing");
  return ctx;
}
