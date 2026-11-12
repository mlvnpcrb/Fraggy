import React, { useCallback, useEffect, useRef, useState } from "react";
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
  compressPhoto,
  mediaUri,
} from "./api";
import { AccountScope, signOutDevice, type AccountLease } from "./session";
import { processCapture, recoverUploadedCapture } from "./capture";
import NetInfo from "@react-native-community/netinfo";
import { QueryClient, isCancelledError } from "@tanstack/react-query";
import {
  sections,
  sectionsForTable,
  sectionsForAction,
  jobPollDelay,
  permissionReconcileMs,
  type Section,
} from "../features/app/refresh";
import { BetaContext } from "./context";
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
    removedDrafts = useRef(new Set<string>()),
    stateRef = useRef(blankState),
    queries = useRef(
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: 0, gcTime: 300000 },
        },
      }),
    ),
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
    return () => {
      data.subscription.unsubscribe();
      supabase.auth.stopAutoRefresh();
    };
  }, []);
  const refresh = useCallback(async (wanted: readonly Section[] = sections) => {
    if (!sessionRef.current) return;
    const lease = scope.current.capture();
    try {
      if (wanted.includes("trading"))
        await rpc("expire_proposals", {}, lease.userId);
      assertCurrent(lease);
      const parts = await Promise.all(
        wanted.map((section) =>
          queries.current.fetchQuery({
            queryKey: [lease.userId, section],
            queryFn: () =>
              rpc<Partial<BetaState>>(
                "beta_section",
                { p_section: section },
                lease.userId,
              ),
          }),
        ),
      );
      assertCurrent(lease);
      const next: BetaState = {
        ...stateRef.current,
        ...Object.assign({}, ...parts),
      };
      stateRef.current = next;
      setState(next);
      setOffline(false);
      setError("");
      if (parts.some((p) => p.bottles || p.profiles || p.wishlist)) {
        const own = {
          ...blankState,
          user_id: lease.userId,
          profiles: next.profiles.filter((p) => p.id === lease.userId),
          wishlist: next.wishlist || [],
          bottles: next.bottles.filter((b) => b.owner_id === lease.userId),
          shelves: next.shelves.filter((s) => s.owner_id === lease.userId),
        };
        await persist(lease, `fraggy.collection.${lease.userId}`, own);
        for (const bottle of own.bottles)
          if (bottle.image_path)
            void mediaUri(bottle.image_path, lease.userId).catch(() => {});
      }
    } catch (e) {
      if (!isCancelledError(e) && scope.current.valid(lease)) {
        setOffline(
          e instanceof TypeError || /network|fetch|offline/i.test(String(e)),
        );
        setError(
          e instanceof Error ? e.message : "Could not refresh. Try again.",
        );
      }
    }
  }, []);
  useEffect(() => {
    queries.current.clear();
    removedDrafts.current.clear();
    stateRef.current = blankState;
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
        if (cache) {
          stateRef.current = { ...blankState, ...JSON.parse(cache) };
          setState(stateRef.current);
        }
        if (draft) {
          const restored = JSON.parse(draft);
          draftsRef.current = restored;
          setDrafts(restored);
        }
        void refresh();
      })
      .catch(() => void refresh());
    const queued = new Set<Section>();
    let debounce: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel(`beta:${id}`)
      .on("postgres_changes", { event: "*", schema: "public" }, (event) => {
        for (const section of sectionsForTable(event.table))
          queued.add(section);
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          void refresh([...queued]);
          queued.clear();
        }, 250);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
      });
    // RLS can suppress an event precisely when the viewer loses SELECT access.
    // Reconcile on focus/reconnect and once a minute while foregrounded.
    const permissionTimer = setInterval(() => {
      if (AppState.currentState === "active" || Platform.OS === "web")
        void refresh(["collection", "community", "account", "trading"]);
    }, permissionReconcileMs);
    const disconnect = NetInfo.addEventListener((connection) => {
      if (connection.isConnected === false) setOffline(true);
      else if (
        connection.isConnected === true &&
        (AppState.currentState === "active" || Platform.OS === "web")
      )
        void refresh();
    });
    const listener = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        supabase.auth.startAutoRefresh();
        void refresh();
      } else supabase.auth.stopAutoRefresh();
    });
    return () => {
      active = false;
      clearTimeout(debounce);
      clearInterval(permissionTimer);
      listener.remove();
      disconnect();
      void supabase.removeChannel(channel);
    };
  }, [session?.user.id, refresh]);
  useEffect(() => {
    if (
      !session ||
      offline ||
      !state.jobs.some((j) =>
        ["queued", "waking", "processing", "uploading"].includes(j.status),
      )
    )
      return;
    let disposed = false,
      attempt = 0,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (
        !disposed &&
        (AppState.currentState === "active" || Platform.OS === "web")
      )
        await refresh(["jobs"]);
      if (!disposed) timer = setTimeout(poll, jobPollDelay(attempt++));
    };
    timer = setTimeout(poll, jobPollDelay(0));
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [
    session?.user.id,
    offline,
    state.jobs.map((j) => j.id + ":" + j.status).join(","),
    refresh,
  ]);
  const saveScoped = useCallback(async (draft: Draft, lease: AccountLease) => {
    assertCurrent(lease);
    if (removedDrafts.current.has(draft.id)) return;
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
      removedDrafts.current.add(id);
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
          upload: async (url, uri) => {
            const compressed = await compressPhoto(uri);
            assertCurrent(lease);
            await uploadPhoto(url, compressed);
            assertCurrent(lease);
          },
          loadJobs: async () =>
            (await rpc<BetaState>("beta_state", {}, lease.userId)).jobs,
          latestUi: () =>
            draftsRef.current.find((d) => d.id === draft.id)?.ui || draft.ui,
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
      const wanted = sectionsForAction(name);
      await Promise.all(
        wanted.map((section) =>
          queries.current.cancelQueries({ queryKey: [lease.userId, section] }),
        ),
      );
      assertCurrent(lease);
      if (wanted.length) await refresh(wanted);
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
    queries.current.clear();
    const result = await signOutDevice(supabase);
    await Promise.allSettled([...writes.current]);
    if (id) await clearPrivateCache(id);
    const currentSession = sessionRef.current as Session | null;
    if (currentSession?.user.id && currentSession.user.id !== id) return;
    stateRef.current = blankState;
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
        mode: "live",
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
