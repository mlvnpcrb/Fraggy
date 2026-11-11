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
import { blankState, type BetaState, type Draft } from "./types";
import {
  supabase,
  rpc,
  gateway,
  uploadPhoto,
  clearPrivateCache,
  mediaUri,
} from "./api";
import { AccountScope, signOutDevice, type AccountLease } from "./session";
import { processCapture, recoverUploadedCapture } from "./capture";
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
  const sessionRef = useRef<Session | null>(null),
    scope = useRef(new AccountScope()),
    draftsRef = useRef(drafts),
    pending = useRef(new Set<string>()),
    refreshBusy = useRef<AccountLease | null>(null),
    writes = useRef(new Set<Promise<void>>());
  draftsRef.current = drafts;
  const assertCurrent = (lease: AccountLease) => {
    if (!scope.current.valid(lease))
      throw Error(
        "Your account changed. Reopen the capture from its original account.",
      );
  };
  const persist = async (lease: AccountLease, key: string, value: unknown) => {
    assertCurrent(lease);
    const write = AsyncStorage.setItem(key, JSON.stringify(value));
    writes.current.add(write);
    try {
      await write;
    } finally {
      writes.current.delete(write);
    }
    assertCurrent(lease);
  };
  useEffect(() => {
    const change = (next: Session | null) => {
      scope.current.set(next?.user.id || null);
      sessionRef.current = next;
      setSession(next);
    };
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        change(data.session);
        if (error) setError(error.message);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, next) =>
      change(next),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  const refresh = useCallback(async () => {
    if (!sessionRef.current) return;
    const lease = scope.current.capture();
    if (refreshBusy.current && scope.current.valid(refreshBusy.current)) return;
    refreshBusy.current = lease;
    try {
      await rpc("expire_proposals", {}, lease.userId);
      assertCurrent(lease);
      const data = await rpc<BetaState>("beta_state", {}, lease.userId);
      assertCurrent(lease);
      setState(data);
      setOffline(false);
      setError("");
      const own = {
        ...blankState,
        user_id: lease.userId,
        profiles: data.profiles.filter((p) => p.id === lease.userId),
        shelves: data.shelves.filter((s) => s.owner_id === lease.userId),
        bottles: data.bottles.filter((b) => b.owner_id === lease.userId),
      };
      await persist(lease, `fraggy.collection.${lease.userId}`, own);
      for (const bottle of own.bottles)
        if (bottle.image_path)
          void mediaUri(bottle.image_path, lease.userId).catch(() => {});
    } catch (e) {
      if (scope.current.valid(lease)) {
        setOffline(true);
        setError(e instanceof Error ? e.message : "Could not refresh.");
      }
    } finally {
      if (refreshBusy.current === lease) refreshBusy.current = null;
    }
  }, []);
  useEffect(() => {
    setState(blankState);
    draftsRef.current = [];
    setDrafts([]);
    const id = session?.user.id;
    if (!id) return;
    const lease = scope.current.capture();
    let active = true;
    Promise.all([
      AsyncStorage.getItem(`fraggy.collection.${id}`),
      AsyncStorage.getItem(`fraggy.drafts.${id}`),
    ])
      .then(([cache, draft]) => {
        if (!active || !scope.current.valid(lease)) return;
        if (cache) setState(JSON.parse(cache));
        if (draft) {
          const restored = JSON.parse(draft);
          draftsRef.current = restored;
          setDrafts(restored);
        }
        void refresh();
      })
      .catch(() => void refresh());
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
  const saveScoped = useCallback(async (draft: Draft, lease: AccountLease) => {
    assertCurrent(lease);
    const existing = draftsRef.current.find((d) => d.id === draft.id);
    const merged = { ...draft, jobId: draft.jobId || existing?.jobId };
    const next = [
      merged,
      ...draftsRef.current.filter((d) => d.id !== draft.id),
    ];
    draftsRef.current = next;
    setDrafts(next);
    await persist(lease, `fraggy.drafts.${lease.userId}`, next);
  }, []);
  const renderedUser = session?.user.id;
  const saveDraft = useCallback(
    async (draft: Draft) => {
      if (!renderedUser || sessionRef.current?.user.id !== renderedUser)
        throw Error("Sign in to the original account.");
      await saveScoped(draft, scope.current.capture());
    },
    [renderedUser, saveScoped],
  );
  const removeDraft = useCallback(
    async (id: string) => {
      if (!renderedUser || sessionRef.current?.user.id !== renderedUser) return;
      const lease = scope.current.capture(),
        next = draftsRef.current.filter((d) => d.id !== id);
      draftsRef.current = next;
      setDrafts(next);
      await persist(lease, `fraggy.drafts.${lease.userId}`, next);
    },
    [renderedUser],
  );
  const processDraft = useCallback(
    async (draft: Draft) => {
      if (!renderedUser || sessionRef.current?.user.id !== renderedUser)
        throw Error("Sign in to the original account.");
      const lease = scope.current.capture(),
        key = `${lease.userId}:${lease.generation}:${draft.id}`;
      if (pending.current.has(key)) return draft.jobId || "";
      pending.current.add(key);
      try {
        return await processCapture(draft, {
          gateway: <T,>(action: string, args?: Record<string, unknown>) =>
            gateway<T>(action, args, lease.userId, () =>
              scope.current.valid(lease),
            ),
          save: (d) => saveScoped(d, lease),
          upload: uploadPhoto,
          loadJobs: async () =>
            (await rpc<BetaState>("beta_state", {}, lease.userId)).jobs,
          latestForm: () =>
            draftsRef.current.find((d) => d.id === draft.id)?.form ||
            draft.form,
          refresh,
          isCurrent: () => scope.current.valid(lease),
        });
      } finally {
        pending.current.delete(key);
      }
    },
    [renderedUser, saveScoped, refresh],
  );
  useEffect(() => {
    if (offline || !session) return;
    for (const draft of drafts) {
      const job = state.jobs.find((j) => j.id === draft.jobId);
      if (!draft.jobId || job?.status === "uploading")
        void processDraft(draft).catch(() => {});
    }
    for (const job of state.jobs) {
      if (job.status !== "uploading" || drafts.some((d) => d.jobId === job.id))
        continue;
      const lease = scope.current.capture(),
        key = `server:${lease.userId}:${lease.generation}:${job.id}`;
      if (pending.current.has(key)) continue;
      pending.current.add(key);
      void recoverUploadedCapture(
        job,
        <T,>(action: string, args?: Record<string, unknown>) =>
          gateway<T>(action, args, lease.userId, () =>
            scope.current.valid(lease),
          ),
      )
        .then((changed) => {
          if (changed && scope.current.valid(lease)) void refresh();
        })
        .catch(() => {})
        .finally(() => pending.current.delete(key));
    }
  }, [offline, state.jobs, session?.user.id]);
  const run = useCallback(
    async <T,>(name: string, args: Record<string, unknown> = {}) => {
      if (!renderedUser || sessionRef.current?.user.id !== renderedUser)
        throw Error("Your account changed.");
      const lease = scope.current.capture();
      const data = await rpc<T>(name, args, lease.userId);
      assertCurrent(lease);
      await refresh();
      assertCurrent(lease);
      return data;
    },
    [renderedUser, refresh],
  );
  const signOut = async () => {
    const id = sessionRef.current?.user.id;
    scope.current.set(null);
    sessionRef.current = null;
    setSession(null);
    const result = await signOutDevice(supabase);
    await Promise.allSettled([...writes.current]);
    if (id) await clearPrivateCache(id);
    const currentSession = sessionRef.current as Session | null;
    if (currentSession?.user.id && currentSession.user.id !== id) return;
    setState(blankState);
    draftsRef.current = [];
    setDrafts([]);
    setOffline(false);
    setError(
      result.error
        ? "Signed out on this device. The server could not confirm session revocation."
        : "",
    );
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
