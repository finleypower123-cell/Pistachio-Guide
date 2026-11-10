"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { logEvent } from "@/lib/analytics";
import { SHOW_DEMO } from "@/lib/preview";
import { local } from "@/lib/storage";
import { getSupabase } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/config";
import type { Activity, Prefs, RecentItem, SavedItem } from "@/lib/types";

const DEFAULT_PREFS: Prefs = { categories: [], budget: 50, weatherSmart: true };

interface UserState {
  /** Supabase user, or null in on-device mode / signed out */
  user: User | null;
  displayName: string | null;
  cloud: boolean;
  supabaseReady: boolean;
  prefs: Prefs;
  setPrefs: (p: Prefs) => void;
  saved: SavedItem[];
  isSaved: (id: string) => boolean;
  toggleSave: (a: Activity) => void;
  recent: RecentItem[];
  addRecent: (a: Activity) => void;
  clearRecent: () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null; needsConfirm: boolean }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<UserState | null>(null);

function mergeById<T extends { id: string }>(a: T[], b: T[]) {
  const m = new Map<string, T>();
  [...b, ...a].forEach((x) => m.set(x.id, x));
  return [...m.values()];
}

/** Sample listings saved or viewed before they were removed from the live site are dropped. */
function realOnly<T extends { snapshot?: Activity }>(items: T[]): T[] {
  return SHOW_DEMO ? items : items.filter((i) => i.snapshot?.source !== "demo");
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const loadedFor = useRef<string | null>(null);

  // Device data first, so the UI works instantly and offline.
  useEffect(() => {
    setPrefsState(local.get("prefs", DEFAULT_PREFS));
    setSaved(realOnly(local.get("saved", [])));
    setRecent(realOnly(local.get("recent", [])));
    setDisplayName(local.get<string | null>("name", null));
  }, []);

  // Supabase session
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // When a user signs in, load their profile and merge anything saved on this device.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !user || loadedFor.current === user.id) return;
    loadedFor.current = user.id;
    (async () => {
      const { data } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
      const devSaved = local.get<SavedItem[]>("saved", []);
      const devRecent = local.get<RecentItem[]>("recent", []);
      const nextSaved = realOnly(mergeById(devSaved, (data?.saved as SavedItem[]) ?? []));
      const nextRecent = realOnly(mergeById(devRecent, (data?.recent as RecentItem[]) ?? []))
        .sort((a, b) => b.viewedAt - a.viewedAt)
        .slice(0, 20);
      const nextPrefs = (data?.prefs as Prefs) ?? local.get("prefs", DEFAULT_PREFS);
      const name = (data?.display_name as string) ?? (user.user_metadata?.name as string) ?? user.email ?? null;
      setSaved(nextSaved);
      setRecent(nextRecent);
      setPrefsState({ ...DEFAULT_PREFS, ...nextPrefs });
      setDisplayName(name);
      await sb.from("profiles").upsert({ id: user.id, display_name: name, saved: nextSaved, recent: nextRecent, prefs: nextPrefs });
    })();
  }, [user]);

  const persist = useCallback(
    (patch: { saved?: SavedItem[]; recent?: RecentItem[]; prefs?: Prefs }) => {
      if (patch.saved) local.set("saved", patch.saved);
      if (patch.recent) local.set("recent", patch.recent);
      if (patch.prefs) local.set("prefs", patch.prefs);
      const sb = getSupabase();
      if (sb && user) void sb.from("profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", user.id).then(() => {});
    },
    [user],
  );

  const setPrefs = useCallback(
    (p: Prefs) => {
      setPrefsState(p);
      persist({ prefs: p });
    },
    [persist],
  );

  const toggleSave = useCallback(
    (a: Activity) => {
      setSaved((prev) => {
        const exists = prev.some((s) => s.id === a.id);
        const next = exists ? prev.filter((s) => s.id !== a.id) : [{ id: a.id, savedAt: Date.now(), snapshot: a }, ...prev];
        if (!exists) logEvent(a.id, "save");
        persist({ saved: next });
        return next;
      });
    },
    [persist],
  );

  const addRecent = useCallback(
    (a: Activity) => {
      setRecent((prev) => {
        if (prev[0]?.id === a.id) return prev;
        const next = [{ id: a.id, viewedAt: Date.now(), snapshot: a }, ...prev.filter((r) => r.id !== a.id)].slice(0, 20);
        persist({ recent: next });
        return next;
      });
    },
    [persist],
  );

  const clearRecent = useCallback(() => {
    setRecent([]);
    persist({ recent: [] });
  }, [persist]);

  const signIn = async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return "Accounts aren't connected in this build yet.";
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  };

  const signUp = async (email: string, password: string, name: string) => {
    const sb = getSupabase();
    if (!sb) return { error: "Accounts aren't connected in this build yet.", needsConfirm: false };
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: `${window.location.origin}/profile` },
    });
    if (error) return { error: error.message, needsConfirm: false };
    return { error: null, needsConfirm: !data.session };
  };

  const signOut = async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    loadedFor.current = null;
    setUser(null);
  };

  return (
    <Ctx.Provider
      value={{
        user,
        displayName,
        cloud: Boolean(user),
        supabaseReady: hasSupabase,
        prefs,
        setPrefs,
        saved,
        isSaved: (id) => saved.some((s) => s.id === id),
        toggleSave,
        recent,
        addRecent,
        clearRecent,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useUser() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUser must be used inside UserProvider");
  return v;
}
