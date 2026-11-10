import { APP_USER_AGENT, elementToActivity, elementsToPlaces, type OsmElement } from "./osm";
import type { Activity } from "./types";

/**
 * Backup sources of real places for when the public Overpass servers don't answer, which in
 * practice is often. Both are OpenStreetMap data, need no key and allow browser requests.
 *
 * - Photon (photon.komoot.io) finds places of given types around a point. It returns name, type,
 *   address and location only, so these places are marked `partial`.
 * - The OpenStreetMap API returns the full record for one place by id, used to fill in opening
 *   hours, website, phone and accessibility when a place is opened.
 */

const PHOTON = "https://photon.komoot.io/reverse";
const OSM_API = "https://api.openstreetmap.org/api/0.6";

/** Place types to ask Photon for, grouped so that common types can't crowd out rare ones. */
export const PHOTON_GROUPS: string[][] = [
  ["amenity:cafe"],
  ["leisure:park", "leisure:garden"],
  ["leisure:water_park", "leisure:bowling_alley", "leisure:miniature_golf", "leisure:amusement_arcade", "leisure:escape_game", "leisure:trampoline_park", "leisure:sports_centre", "leisure:swimming_pool"],
  ["amenity:cinema", "amenity:theatre", "amenity:arts_centre", "amenity:marketplace"],
  ["tourism:museum", "tourism:gallery", "tourism:attraction", "tourism:viewpoint"],
  ["shop:second_hand", "shop:charity", "shop:games"],
];

const serverHeaders = (): Record<string, string> => (typeof window === "undefined" ? { "User-Agent": APP_USER_AGENT } : {});

async function getJson<T>(url: string, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, { headers: serverHeaders(), cache: "no-store", signal: ctrl.signal });
    if (!res.ok) throw new Error(`${new URL(url).hostname} ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    postcode?: string;
  };
}

const OSM_TYPE: Record<string, OsmElement["type"]> = { N: "node", W: "way", R: "relation" };

/** Rebuilds the handful of OSM tags Photon exposes, so the normal OSM mapping can be reused. */
export function photonToElement(f: PhotonFeature): OsmElement | null {
  const p = f.properties ?? {};
  const c = f.geometry?.coordinates;
  const type = OSM_TYPE[p.osm_type ?? ""];
  if (!type || !p.osm_id || !p.osm_key || !p.osm_value || !p.name || !c) return null;
  const tags: Record<string, string> = { [p.osm_key]: p.osm_value, name: p.name };
  if (p.street) tags["addr:street"] = p.street;
  if (p.housenumber) tags["addr:housenumber"] = p.housenumber;
  if (p.city) tags["addr:city"] = p.city;
  else if (p.district) tags["addr:suburb"] = p.district;
  if (p.postcode) tags["addr:postcode"] = p.postcode;
  return { type, id: p.osm_id, lat: c[1], lon: c[0], tags };
}

function asPartial(a: Activity): Activity {
  return {
    ...a,
    partial: true,
    accessNote: "Open the place for accessibility details, or check with the venue.",
    provenance: "Real place from OpenStreetMap. Opening hours, website and other details load when you open it, where OpenStreetMap has them.",
  };
}

/** Photon blocks clients that send bursts of requests, so they go out one at a time, at most one a second. */
export const photonPacing = { gapMs: 1000 };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Real places around a point from Photon. Each group of place types is one request (Photon
 * returns the 50 nearest matches per request). Succeeds if at least one group answers.
 */
export async function photonNearby(lat: number, lng: number, radiusM: number, signal?: AbortSignal): Promise<Activity[]> {
  const radiusKm = Math.max(0.3, Math.min(5, radiusM / 1000));
  const els: OsmElement[] = [];
  let answered = 0;
  let failed = 0;
  for (const group of PHOTON_GROUPS) {
    if (signal?.aborted) throw new Error("aborted");
    const started = Date.now();
    const u = new URL(PHOTON);
    u.searchParams.set("lat", lat.toFixed(5));
    u.searchParams.set("lon", lng.toFixed(5));
    u.searchParams.set("radius", String(radiusKm));
    u.searchParams.set("limit", "50");
    for (const t of group) u.searchParams.append("osm_tag", t);
    try {
      const j = await getJson<{ features?: PhotonFeature[] }>(u.toString(), 8000, signal);
      answered++;
      for (const f of j.features ?? []) {
        const el = photonToElement(f);
        if (el) els.push(el);
      }
    } catch {
      failed++;
      // Two failures with nothing back means the service is down or refusing us; don't keep knocking.
      if (failed >= 2 && !answered) break;
    }
    if (group !== PHOTON_GROUPS[PHOTON_GROUPS.length - 1]) await sleep(Math.max(0, photonPacing.gapMs - (Date.now() - started)));
  }
  if (!answered) throw new Error("Photon unavailable");
  return elementsToPlaces(els).map(asPartial);
}

interface OsmApiElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

/** The full OpenStreetMap record for one place. Ways are centred on the average of their points. */
export async function osmApiPlace(type: "node" | "way" | "relation", id: number, signal?: AbortSignal): Promise<Activity | null> {
  if (type === "relation") return null; // a relation's shape can be very large; not worth fetching for a detail page
  const url = type === "node" ? `${OSM_API}/node/${id}.json` : `${OSM_API}/way/${id}/full.json`;
  const j = await getJson<{ elements?: OsmApiElement[] }>(url, 9000, signal);
  const els = j.elements ?? [];
  const main = els.find((e) => e.type === type && e.id === id);
  if (!main) return null;
  let lat = main.lat;
  let lon = main.lon;
  if (type === "way") {
    const pts = els.filter((e) => e.type === "node" && e.lat != null && e.lon != null);
    if (!pts.length) return null;
    lat = pts.reduce((s, e) => s + e.lat!, 0) / pts.length;
    lon = pts.reduce((s, e) => s + e.lon!, 0) / pts.length;
  }
  return elementToActivity({ type, id, lat, lon, tags: main.tags });
}
