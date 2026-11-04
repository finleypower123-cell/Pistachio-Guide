/**
 * Preview-only stand-in for next/navigation. Routes live in memory; the URL hash carries a
 * plain page name (e.g. #explore, #activity-slow-clay) so links can be bookmarked and shared.
 */
import { useMemo, useSyncExternalStore } from "react";

type Loc = { path: string; search: string };
const listeners = new Set<() => void>();

const ROUTES = ["explore", "map", "categories", "saved", "profile", "login", "business", "about"];

export function hashToPath(hash: string): string | null {
  const h = hash.replace(/^#/, "");
  if (!h || h === "home") return "/";
  if (ROUTES.includes(h)) return `/${h}`;
  if (h.startsWith("activity-")) return `/activity/${h.slice(9)}`;
  return null;
}

function pathToHash(path: string) {
  if (path === "/") return "home";
  if (path.startsWith("/activity/")) return `activity-${path.slice(10)}`;
  return path.slice(1);
}

let loc: Loc = { path: hashToPath(typeof location !== "undefined" ? location.hash : "") ?? "/", search: "" };
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function navigate(href: string) {
  const [beforeHash, fragment] = href.split("#");
  const [pathRaw, search = ""] = beforeHash.split("?");
  const path = pathRaw || loc.path;
  const changed = path !== loc.path || search !== loc.search;
  loc = { path, search };
  const name = pathToHash(path);
  try {
    if (location.hash.replace(/^#/, "") !== name) history.pushState(null, "", `#${name}`);
  } catch {
    /* some viewers block history; in-memory routing still works */
  }
  if (changed) emit();
  requestAnimationFrame(() => {
    if (fragment) document.getElementById(fragment)?.scrollIntoView({ behavior: "smooth" });
    else if (changed) window.scrollTo(0, 0);
  });
}

if (typeof window !== "undefined") {
  const sync = () => {
    const p = hashToPath(location.hash);
    if (p === null) {
      // An in-page anchor like #location: scroll to it and keep the current page.
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (p !== loc.path) {
      loc = { path: p, search: "" };
      emit();
      window.scrollTo(0, 0);
    }
  };
  window.addEventListener("hashchange", sync);
  window.addEventListener("popstate", sync);
}

export function useLoc() {
  return useSyncExternalStore(subscribe, () => loc, () => loc);
}

export function usePathname() {
  return useLoc().path;
}

export function useSearchParams() {
  const { search } = useLoc();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function useParams<T extends Record<string, string>>(): T {
  const { path } = useLoc();
  const m = path.match(/^\/activity\/(.+)$/);
  return (m ? { id: decodeURIComponent(m[1]) } : {}) as T;
}

export function useRouter() {
  return { push: navigate, replace: navigate, back: () => history.back(), refresh: () => {}, prefetch: () => {} };
}
