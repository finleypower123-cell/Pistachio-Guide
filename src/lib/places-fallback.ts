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

/**
 * Place types to ask Photon for. Each group is one request returning its 50 nearest matches, so
 * common types (cafés, parks) get their own group and can't crowd out rarer ones. The order is
 * the order results appear in while loading: the less ordinary places first.
 */
export const PHOTON_GROUPS: string[][] = [
  ["leisure:escape_game", "leisure:amusement_arcade", "leisure:bowling_alley", "leisure:miniature_golf", "leisure:trampoline_park", "leisure:water_park"],
  ["tourism:zoo", "tourism:aquarium", "tourism:theme_park", "leisure:ice_rink", "amenity:planetarium", "amenity:karaoke_box", "leisure:indoor_play", "amenity:boat_rental"],
  ["tourism:museum"],
  ["amenity:cafe"],
  ["leisure:park"],
  ["amenity:cinema", "amenity:theatre"],
  ["tourism:gallery", "tourism:attraction", "tourism:viewpoint"],
  ["amenity:arts_centre", "amenity:marketplace"],
  ["leisure:sports_centre", "leisure:swimming_pool"],
  ["leisure:garden"],
  ["shop:second_hand", "shop:charity", "shop:games"],
  ["historic:castle", "historic:ruins", "craft:brewery"],
  ["leisure:nature_reserve", "amenity:music_venue"],
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

/**
 * Photon blocks clients that send bursts of requests, so they go out strictly one at a time. It
 * also slows each client to about one answer a second, so no extra gap is needed by default.
 */
export const photonPacing = { gapMs: 0 };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Real places around a point from Photon, up to 25 km out. Succeeds if at least one group of
 * place types answers. `onProgress` receives the places found so far after each group, so the
 * first results can be shown within a second or two.
 */
export async function photonNearby(
  lat: number,
  lng: number,
  radiusM: number,
  signal?: AbortSignal,
  onProgress?: (places: Activity[]) => void,
): Promise<Activity[]> {
  const radiusKm = Math.max(0.3, Math.min(25, radiusM / 1000));
  const els: OsmElement[] = [];
  const collect = () => elementsToPlaces(els).map(asPartial);
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
      let added = 0;
      for (const f of j.features ?? []) {
        const el = photonToElement(f);
        if (el) added = els.push(el);
      }
      if (added && onProgress && !signal?.aborted) onProgress(collect());
    } catch {
      failed++;
      // Two failures with nothing back means the service is down or refusing us; don't keep knocking.
      if (failed >= 2 && !answered) break;
    }
    const gap = photonPacing.gapMs - (Date.now() - started);
    if (gap > 0 && group !== PHOTON_GROUPS[PHOTON_GROUPS.length - 1]) await sleep(gap);
  }
  if (!answered) throw new Error("Photon unavailable");
  return collect();
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

/**
 * Full OpenStreetMap records for many places at once, by id: one request per 150 ids of a kind.
 * Used by the weekly city-data build (never by visitors' browsers) to turn basic Photon results
 * into full records with opening hours, websites and the rest. Places whose record can't be
 * fetched come back unchanged. Coordinates are kept from the input, since a way's record has none.
 */
export async function withFullRecords(places: Activity[], signal?: AbortSignal): Promise<Activity[]> {
  const byType: Record<"node" | "way" | "relation", number[]> = { node: [], way: [], relation: [] };
  for (const p of places) if (p.osm) byType[p.osm.type].push(p.osm.id);
  const tags = new Map<string, Record<string, string>>();
  for (const type of ["node", "way", "relation"] as const) {
    const ids = byType[type];
    for (let i = 0; i < ids.length; i += 150) {
      const chunk = ids.slice(i, i + 150);
      try {
        const j = await getJson<{ elements?: OsmApiElement[] }>(`${OSM_API}/${type}s.json?${type}s=${chunk.join(",")}`, 20000, signal);
        for (const e of j.elements ?? []) if (e.tags) tags.set(`${type}-${e.id}`, e.tags);
      } catch {
        // A chunk that fails keeps its basic records; the rest still improve.
      }
    }
  }
  return places.map((p) => {
    const t = p.osm && tags.get(`${p.osm.type}-${p.osm.id}`);
    if (!t || !p.osm) return p;
    // Photon works out a street and town for places whose record has no address of its own; keep those.
    const merged = { ...t };
    if (!merged["addr:street"] && p.address) {
      const [street, city] = p.address.split(",").map((x) => x.trim());
      if (street) merged["addr:street"] = street;
      if (city && !merged["addr:city"]) merged["addr:city"] = city;
    }
    const full = elementToActivity({ type: p.osm.type, id: p.osm.id, lat: p.lat, lon: p.lng, tags: merged });
    // A record can change kind since Photon indexed it (a café that became a bar); keep only matches.
    return full && full.category === p.category ? full : p;
  });
}
