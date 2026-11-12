import React, { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { BetaContext } from "../../beta/context";
import { BetaNavigator } from "../../beta/Navigator";
import { demoSeed, demoAction, demoUser } from "./demoStore";
import { samplePhoto } from "./samplePhoto";
import type { BetaState, Draft } from "../../beta/types";
const key = "fraggy.demo.v1";
export function DemoApp({ onExit }: { onExit: () => void }) {
  const [state, setState] = useState(demoSeed),
    [drafts, setDrafts] = useState<Draft[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const current = useRef({ state, drafts }),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!active.current) return;
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.version === 1 && saved.state?.user_id === demoUser) {
            current.current = saved;
            setState(saved.state);
            setDrafts(saved.drafts || []);
          }
        }
      })
      .catch(() =>
        setError(
          "The demo could not be restored. A fresh sample is available.",
        ),
      )
      .finally(() => {
        if (active.current) setLoading(false);
      });
    return () => {
      active.current = false;
    };
  }, []);
  const persist = async (
    s = current.current.state,
    d = current.current.drafts,
  ) => {
    current.current = { state: s, drafts: d };
    setState(s);
    setDrafts(d);
    await AsyncStorage.setItem(
      key,
      JSON.stringify({ version: 1, state: s, drafts: d }),
    );
  };
  const session = {
    user: { id: demoUser, email: "Isolated demo · no real account" },
  } as Session;
  return (
    <BetaContext.Provider
      value={{
        mode: "demo",
        session,
        loading,
        state,
        offline: false,
        error,
        drafts,
        refresh: async () => {},
        signOut: async () => {
          onExit();
        },
        run: async <T,>(name: string, args: Record<string, unknown> = {}) => {
          const result = demoAction(current.current.state, name, args);
          await persist(result.state);
          return result.value as T;
        },
        saveDraft: async (d) =>
          persist(undefined, [
            d,
            ...current.current.drafts.filter((x) => x.id !== d.id),
          ]),
        removeDraft: async (id) =>
          persist(
            undefined,
            current.current.drafts.filter((x) => x.id !== id),
          ),
        processDraft: async (draft) => {
          const jobId = draft.jobId || `demo-job-${draft.id}`;
          const s = {
            ...current.current.state,
            jobs: [
              {
                id: jobId,
                owner_id: demoUser,
                status: "ready" as const,
                original_path: samplePhoto,
                cutout_path: samplePhoto,
                width: 200,
                height: 400,
                error: null,
                lease_until: null,
                updated_at: new Date().toISOString(),
                draft: draft.form,
                bottle_id: null,
              },
              ...current.current.state.jobs.filter((j) => j.id !== jobId),
            ],
          };
          await persist(s, [
            { ...draft, jobId },
            ...current.current.drafts.filter((d) => d.id !== draft.id),
          ]);
          return jobId;
        },
      }}
    >
      <BetaNavigator />
    </BetaContext.Provider>
  );
}
