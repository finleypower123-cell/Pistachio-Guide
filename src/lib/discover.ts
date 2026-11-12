import { overturePlaceById } from "./overture";
import { CITIES, CITY_DATA_RADIUS_KM, type City, type CityData } from "./cities";
import { distanceKm } from "./geo";
import { osmApiPlace, photonNearby } from "./places-fallback";
import { seedAreaPhotos } from "./wiki";
import { roundCoord } from "./osm";
import type { Activity } from "./types";

/**
 * Client-side loaders for real OpenStreetMap places.
 *
 * Nearby places: our API route (Overpass, full records, cached at the CDN) is asked first. The
 * public Overpass servers often don't answer, so after a short head start the browser also asks
 * Photon directly and uses whichever real data arrives. Photon is called from the browser, not
 * our server, because it throttles by IP address and hosting providers share theirs.
 *
 * Results are remembered on the device for a while so reloads are instant and the free services
 * aren't asked again for the same area.
 */

export const timing = { headStartMs: 2500, serverWaitMs: 10000 };
const SERVER_MAX_RADIUS_M = 5000;

async function viaServer<T>(path: string, signal?: AbortSignal): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timing.serverWaitMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const r = await fetch(path, { signal: ctrl.signal });
    const j = await r.json();
    if (!r.ok) throw Object.assign(new Error(j.error ?? "Request failed."), { status: r.status });
    return j as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

const FRIENDLY = "Couldn't load real places just now. Try again in a minute.";

// ---- on-device cache -------------------------------------------------------------------------

const CACHE_KEY = "pg:places-cache:v1";
const FULL_TTL_MS = 24 * 3600_000;
const PARTIAL_TTL_MS = 6 * 3600_000;
/** Older results are still shown straight away while fresh ones load behind them. */
const STALE_OK_MS = 30 * 86_400_000;
const MAX_AREAS = 3;

interface CacheEntry {
  key: string;
  at: number;
  full: boolean;
  places: Activity[];
}

function readCache(key: string): { places: Activity[]; fresh: boolean } | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]") as CacheEntry[];
    const hit = all.find((e) => e.key === key);
    const age = hit ? Date.now() - hit.at : Infinity;
    if (!hit || age > STALE_OK_MS) return null;
    return { places: hit.places, fresh: age <= (hit.full ? FULL_TTL_MS : PARTIAL_TTL_MS) };
  } catch {
    return null;
  }
}

function writeCache(key: string, places: Activity[], full: boolean) {
  try {
    if (typeof localStorage === "undefined" || !places.length) return;
    const all = (JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]") as CacheEntry[]).filter((e) => e.key !== key);
    all.unshift({ key, at: Date.now(), full, places });
    localStorage.setItem(CACHE_KEY, JSON.stringify(all.slice(0, MAX_AREAS)));
  } catch {
    // Storage full or unavailable: the cache is only a convenience.
  }
}

// ---- ready-made city files -------------------------------------------------------------------

/** City files older than this are ignored: the weekly rebuild has clearly stopped. */
const CITY_DATA_MAX_AGE_MS = 45 * 86_400_000;

async function readyMade(lat: number, lng: number, radiusM: number, signal?: AbortSignal): Promise<{ places: Activity[]; exact: boolean } | null> {
  if (typeof window === "undefined" || radiusM !== CITY_DATA_RADIUS_KM * 1000) return null;
  let city: City | undefined;
  let km = Infinity;
  for (const c of CITIES) {
    const d = distanceKm({ lat, lng }, c);
    if (d < km) {
      km = d;
      city = c;
    }
  }
  // Beyond about 2.5 km the city file covers too little of what is around the visitor.
  if (!city || km > 2.5) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const onAbort = () => ctrl.abort();
    signal?.addEventListener("abort", onAbort);
    let data: CityData;
    try {
      const r = await fetch(`/data/cities/${city.slug}.json`, { signal: ctrl.signal });
      if (!r.ok) return null;
      data = (await r.json()) as CityData;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
    if (!data.places?.length || Date.now() - Date.parse(data.builtAt) > CITY_DATA_MAX_AGE_MS) return null;
    const exact = km < 0.3;
    if (exact) seedAreaPhotos({ lat, lng }, CITY_DATA_RADIUS_KM, data.photos ?? {});
    return { places: data.places, exact };
  } catch {
    return null;
  }
}

// ---- loaders ---------------------------------------------------------------------------------

type Loaded = { places: Activity[]; full: boolean };

export async function loadNearbyPlaces(
  lat: number,
  lng: number,
  radiusM: number,
  signal?: AbortSignal,
  opts: { fresh?: boolean; onProgress?: (places: Activity[]) => void } = {},
): Promise<Activity[]> {
  const rl = roundCoord(lat);
  const rg = roundCoord(lng);
  const key = `${rl},${rg},${radiusM}`;
  // Saved results appear at once. If they are recent that is the answer; if they are older they
  // stay on screen while a fresh set loads behind them, and remain if that load fails.
  const saved = opts.fresh ? null : readCache(key);
  if (saved?.fresh) return saved.places;
  if (!saved && !opts.fresh) {
    // No saved results, but a ready-made city file may cover this spot. At the city's own centre
    // it is the answer; nearby, it fills the screen while the lookup for the exact spot runs.
    const ready = await readyMade(lat, lng, radiusM, signal);
    if (ready?.exact) {
      writeCache(key, ready.places, false);
      return ready.places;
    }
    if (ready) {
      opts.onProgress?.(ready.places);
      try {
        return await loadNearbyPlaces(lat, lng, radiusM, signal, { fresh: true });
      } catch (e) {
        if (signal?.aborted) throw e;
        return ready.places;
      }
    }
  }
  if (saved) {
    opts.onProgress?.(saved.places);
    try {
      return await loadNearbyPlaces(lat, lng, radiusM, signal, { fresh: true });
    } catch (e) {
      if (signal?.aborted) throw e;
      return saved.places;
    }
  }

  // Our route serves up to 5 km. Wider searches go straight to Photon, which returns the nearest
  // places of each kind however far out they are.
  const server: Promise<Loaded> =
    radiusM > SERVER_MAX_RADIUS_M
      ? Promise.reject(new Error("too wide for the server route"))
      : viaServer<{ places: Activity[] }>(`/api/discover?lat=${lat}&lng=${lng}&radius=${radiusM}`, signal).then((j) => ({ places: j.places, full: true }));
  server.catch(() => {});

  let headStart: ReturnType<typeof setTimeout> | undefined;
  const early = await Promise.race([
    server.catch(() => null),
    new Promise<"wait">((r) => (headStart = setTimeout(() => r("wait"), timing.headStartMs))),
  ]);
  clearTimeout(headStart);
  if (signal?.aborted) throw new Error("aborted");

  let result: Loaded;
  if (early && early !== "wait") {
    result = early;
  } else {
    // Our route failed or is slow: ask Photon too, and take whichever real data arrives.
    const stopBackup = new AbortController();
    const onAbort = () => stopBackup.abort();
    signal?.addEventListener("abort", onAbort);
    const backup: Promise<Loaded> = photonNearby(rl, rg, radiusM, stopBackup.signal, opts.onProgress).then((places) => ({ places, full: false }));
    backup.catch(() => {});
    try {
      result = await Promise.race([server.catch(() => backup), backup.catch(() => server)]);
    } catch (e) {
      if (signal?.aborted) throw e;
      throw new Error(FRIENDLY);
    } finally {
      stopBackup.abort();
      signal?.removeEventListener("abort", onAbort);
    }
  }
  if (signal?.aborted) throw new Error("aborted");
  writeCache(key, result.places, result.full);
  return result.places;
}

export async function loadPlaceById(id: string, signal?: AbortSignal): Promise<Activity> {
  if (id.startsWith("ovt-")) {
    // Overture places live in the city file that added them.
    const place = await overturePlaceById(id, async (path) => {
      const res = await fetch(path, { signal });
      return res.ok ? res.json() : null;
    });
    if (!place) throw Object.assign(new Error("Place not found."), { status: 404 });
    return place;
  }
  const m = id.match(/^osm-(node|way|relation)-(\d+)$/);
  if (!m) throw new Error("Unknown place id.");
  try {
    const j = await viaServer<{ place: Activity }>(`/api/place?id=${encodeURIComponent(id)}`, signal);
    return j.place;
  } catch (e) {
    // A definite "not found" from our route is final; anything else is worth a direct try.
    if (signal?.aborted || (e as { status?: number }).status === 404) throw e;
  }
  const place = await osmApiPlace(m[1] as "node" | "way" | "relation", Number(m[2]), signal);
  if (!place) throw new Error("Place not found in OpenStreetMap.");
  return place;
}
