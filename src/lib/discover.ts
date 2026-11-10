import { buildAroundQuery, buildIdQuery, elementToActivity, elementsToPlaces, roundCoord, runOverpass } from "./osm";
import type { Activity } from "./types";

/**
 * Client-side loaders for real OpenStreetMap places.
 *
 * Each one asks our own API route first, because its answers are cached at the CDN. If that
 * route fails or is slow (the public Overpass servers often refuse or throttle requests coming
 * from hosting providers), the browser asks Overpass directly instead.
 */

const SERVER_WAIT_MS = 12000;

async function viaServer<T>(path: string, signal?: AbortSignal): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SERVER_WAIT_MS);
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

const FRIENDLY = "OpenStreetMap didn't respond. Try again in a minute.";

export async function loadNearbyPlaces(lat: number, lng: number, radiusM: number, signal?: AbortSignal): Promise<Activity[]> {
  try {
    const j = await viaServer<{ places: Activity[] }>(`/api/discover?lat=${lat}&lng=${lng}&radius=${radiusM}`, signal);
    return j.places;
  } catch (e) {
    if (signal?.aborted) throw e;
  }
  try {
    return elementsToPlaces(await runOverpass(buildAroundQuery(roundCoord(lat), roundCoord(lng), radiusM), { signal }));
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error(FRIENDLY);
  }
}

export async function loadPlaceById(id: string, signal?: AbortSignal): Promise<Activity> {
  const m = id.match(/^osm-(node|way|relation)-(\d+)$/);
  if (!m) throw new Error("Unknown place id.");
  try {
    const j = await viaServer<{ place: Activity }>(`/api/place?id=${encodeURIComponent(id)}`, signal);
    return j.place;
  } catch (e) {
    // A definite "not found" from our route is final; anything else is worth a direct try.
    if (signal?.aborted || (e as { status?: number }).status === 404) throw e;
  }
  const els = await runOverpass(buildIdQuery(m[1], Number(m[2])), { signal, timeoutMs: 15000 });
  const place = els.map(elementToActivity).find(Boolean);
  if (!place) throw new Error("Place not found in OpenStreetMap.");
  return place;
}
