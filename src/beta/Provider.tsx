import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { blankState, type BetaState, type Draft, type Job } from "./types";
import {
  supabase,
  rpc,
  gateway,
  uploadPhoto,
  clearPrivateCache,
  mediaUri,
} from "./api";

type Context = {
  session: Session | null;
  loading: boolean;
  state: BetaState;
  offline: boolean;
  error: string;
  drafts: Draft[];
  refresh: () => Promise<void>;
  run: <T = unknown>(
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<T>;
  saveDraft: (draft: Draft) => Promise<void>;
  removeDraft: (id: string) => Promise<void>;
  processDraft: (draft: Draft) => Promise<string>;
  signOut: () => Promise<void>;
};
const BetaContext = createContext<Context | null>(null);
export function BetaProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [state, setState] = useState(blankState),
    [offline, setOffline] = useState(false),
    [error, setError] = useState(""),
    [drafts, setDrafts] = useState<Draft[]>([]);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const pending = useRef(new Set<string>());
  const refreshBusy = useRef(false);
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        setSession(data.session);
        if (error) setError(error.message);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  const refresh = useCallback(async () => {
    const user = sessionRef.current?.user.id;
    if (!user || refreshBusy.current) return;
    refreshBusy.current = true;
    try {
      await rpc("expire_proposals");
      const data = await rpc<BetaState>("beta_state");
      if (sessionRef.current?.user.id !== user) return;
      setState(data);
      setOffline(false);
      setError("");
      const own = {
        ...blankState,
        user_id: user,
        profiles: data.profiles.filter((p) => p.id === user),
        shelves: data.shelves.filter((s) => s.owner_id === user),
        bottles: data.bottles.filter((b) => b.owner_id === user),
      };
      await AsyncStorage.setItem(
        `fraggy.collection.${user}`,
        JSON.stringify(own),
      );
      for (const bottle of own.bottles)
        if (bottle.image_path)
          void mediaUri(bottle.image_path, user).catch(() => {});
    } catch (e) {
      setOffline(true);
      setError(e instanceof Error ? e.message : "Could not refresh.");
    } finally {
      refreshBusy.current = false;
    }
  }, []);
  useEffect(() => {
    setState(blankState);
    setDrafts([]);
    const id = session?.user.id;
    if (!id) return;
    let active = true;
    Promise.all([
      AsyncStorage.getItem(`fraggy.collection.${id}`),
      AsyncStorage.getItem(`fraggy.drafts.${id}`),
    ]).then(([cache, draft]) => {
      if (!active) return;
      if (cache) setState(JSON.parse(cache));
      if (draft) setDrafts(JSON.parse(draft));
      void refresh();
    });
    const channel = supabase
      .channel(`beta:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        () => void refresh(),
      )
      .subscribe();
    const listener = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        supabase.auth.startAutoRefresh();
        void refresh();
      } else supabase.auth.stopAutoRefresh();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === "active" || Platform.OS === "web")
        void refresh();
    }, 8000);
    return () => {
      active = false;
      clearInterval(timer);
      listener.remove();
      void supabase.removeChannel(channel);
    };
  }, [session?.user.id, refresh]);
  const saveDraft = useCallback(async (draft: Draft) => {
    const id = sessionRef.current?.user.id;
    if (!id) return;
    const existing = draftsRef.current.find((d) => d.id === draft.id);
    const merged = { ...draft, jobId: draft.jobId || existing?.jobId };
    const next = [
      merged,
      ...draftsRef.current.filter((d) => d.id !== draft.id),
    ];
    draftsRef.current = next;
    setDrafts(next);
    await AsyncStorage.setItem(`fraggy.drafts.${id}`, JSON.stringify(next));
  }, []);
  const removeDraft = useCallback(async (id: string) => {
    const user = sessionRef.current?.user.id;
    if (!user) return;
    const next = draftsRef.current.filter((d) => d.id !== id);
    draftsRef.current = next;
    setDrafts(next);
    await AsyncStorage.setItem(`fraggy.drafts.${user}`, JSON.stringify(next));
  }, []);
  const processDraft = useCallback(
    async (draft: Draft) => {
      if (pending.current.has(draft.id)) return draft.jobId || "";
      pending.current.add(draft.id);
      let current = draft;
      try {
        if (!current.jobId) {
          const result = await gateway<{ job: Job; upload_url: string }>(
            "create-capture",
          );
          current = {
            ...current,
            form:
              draftsRef.current.find((d) => d.id === draft.id)?.form ||
              current.form,
            jobId: result.job.id,
            error: undefined,
          };
          await saveDraft(current);
          await uploadPhoto(result.upload_url, current.uri);
        } else {
          const existing = await rpc<BetaState>("beta_state");
          const job = existing.jobs.find((j) => j.id === current.jobId);
          if (job?.status === "uploading") {
            const result = await gateway<{
              upload_url: string;
              uploaded?: boolean;
            }>("resume-upload", { job_id: current.jobId });
            if (!result.uploaded)
              await uploadPhoto(result.upload_url, current.uri);
          }
        }
        await gateway("start-capture", {
          job_id: current.jobId,
          draft:
            draftsRef.current.find((d) => d.id === draft.id)?.form ||
            current.form,
        });
        await refresh();
        return current.jobId!;
      } catch (e) {
        await saveDraft({
          ...current,
          form:
            draftsRef.current.find((d) => d.id === draft.id)?.form ||
            current.form,
          error:
            e instanceof Error ? e.message : "Photo could not be uploaded.",
        });
        throw e;
      } finally {
        pending.current.delete(draft.id);
      }
    },
    [saveDraft, refresh],
  );
  // Only interrupted uploads auto-resume. Failed inference waits for retry so
  // reconnection cannot consume every daily processing attempt.
  useEffect(() => {
    if (offline || !session) return;
    for (const draft of drafts) {
      const job = state.jobs.find((j) => j.id === draft.jobId);
      if (!draft.jobId || job?.status === "uploading")
        void processDraft(draft).catch(() => {});
    }
  }, [offline, state.jobs, session?.user.id]);
  const run = useCallback(
    async <T,>(name: string, args: Record<string, unknown> = {}) => {
      const data = await rpc<T>(name, args);
      await refresh();
      return data;
    },
    [refresh],
  );
  const signOut = async () => {
    const id = sessionRef.current?.user.id;
    await supabase.auth.signOut();
    if (id) await clearPrivateCache(id);
    setState(blankState);
    setDrafts([]);
  };
  return (
    <BetaContext.Provider
      value={{
        session,
        loading,
        state,
        offline,
        error,
        drafts,
        refresh,
        run,
        saveDraft,
        removeDraft,
        processDraft,
        signOut,
      }}
    >
      {children}
    </BetaContext.Provider>
  );
}
export function useBeta() {
  const context = useContext(BetaContext);
  if (!context) throw Error("BetaProvider is required.");
  return context;
}
