import { blurbFor } from "./blurbs";
import { CAT } from "./categories";
import { parseOsmHours } from "./hours";
import type { Activity, CategoryId, Tag } from "./types";
import { wikiRefFromTags } from "./wiki";

/**
 * OpenStreetMap discovery via the Overpass API.
 * The OSM-tag → category mapping is adapted from TRIP's OpenStreetMapProvider
 * (https://github.com/itskovacs/TRIP, MIT License, Copyright (c) 2026 Kovacs),
 * narrowed to the kinds of places Pistachio Guide is about.
 *
 * Only facts OSM records are surfaced: name, location, opening_hours, website, phone,
 * wheelchair access, address and fee=no. No prices, ratings or reviews are invented.
 */

export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function buildAroundQuery(lat: number, lng: number, radiusM: number, limit = 250) {
  const a = `(around:${Math.round(radiusM)},${lat.toFixed(5)},${lng.toFixed(5)})`;
  return `[out:json][timeout:25];
(
  nwr${a}["amenity"="cafe"]["name"];
  nwr${a}["leisure"~"^(park|garden|water_park|bowling_alley|miniature_golf|amusement_arcade|escape_game|trampoline_park|sports_centre)$"]["name"];
  nwr${a}["leisure"="swimming_pool"]["name"]["access"!~"^(private|no|customers)$"];
  nwr${a}["amenity"~"^(cinema|theatre|arts_centre|marketplace)$"]["name"];
  nwr${a}["tourism"~"^(museum|gallery|attraction|viewpoint)$"]["name"];
  nwr${a}["shop"~"^(second_hand|charity|games)$"]["name"];
  nwr${a}["sport"="climbing"]["name"];
  nwr${a}["tourism"~"^(zoo|aquarium|theme_park)$"]["name"];
  nwr${a}["leisure"~"^(ice_rink|indoor_play|nature_reserve)$"]["name"];
  nwr${a}["amenity"~"^(planetarium|karaoke_box|boat_rental|music_venue)$"]["name"];
  nwr${a}["historic"~"^(castle|ruins)$"]["name"];
  nwr${a}["craft"="brewery"]["name"];
);
out center tags ${limit};`;
}

export function buildIdQuery(type: string, id: number) {
  return `[out:json][timeout:15];${type}(${id});out center tags;`;
}

interface Mapped {
  category: CategoryId;
  typeLabel: string;
}

/** Common café chains, for records that carry no brand tag. */
const CHAIN_NAME =
  /^(starbucks|costa( coffee)?|pret( a manger)?|caff[eè] nero|mccaf[eé]|tim hortons|dunkin\b.*|greggs|exki|panos|paul|le pain quotidien|coffee fellows|espresso house|coffee island|segafredo.*|second cup|gloria jean'?s.*|black sheep coffee|coffee ?#?1|joe ?& ?the juice|bagels ?& ?beans|coffee company|tchibo|columbus caf[eé].*)$/i;

const isBranded = (t: Record<string, string>) => Boolean(t.brand || t["brand:wikidata"] || CHAIN_NAME.test((t.name ?? "").trim()));

function classify(t: Record<string, string>): Mapped | null {
  const branded = isBranded(t);
  if (t.sport === "climbing") return { category: "climbing", typeLabel: "Climbing" };
  switch (t.leisure) {
    case "park":
      return { category: "park", typeLabel: "Park" };
    case "garden":
      return { category: "park", typeLabel: "Garden" };
    case "water_park":
      return { category: "water", typeLabel: "Water park" };
    case "bowling_alley":
      return { category: "bowling", typeLabel: "Bowling alley" };
    case "miniature_golf":
      return { category: "golf", typeLabel: "Mini golf" };
    case "amusement_arcade":
      return { category: "arcade", typeLabel: "Arcade" };
    case "escape_game":
      return { category: "escape", typeLabel: "Escape room" };
    case "trampoline_park":
      return { category: "trampoline", typeLabel: "Trampoline park" };
    case "swimming_pool":
      return { category: "swim", typeLabel: "Swimming pool" };
    case "ice_rink":
      return { category: "icerink", typeLabel: "Ice rink" };
    case "indoor_play":
      return { category: "softplay", typeLabel: "Indoor play centre" };
    case "nature_reserve":
      return { category: "walk", typeLabel: "Nature reserve" };
    case "sports_centre": {
      // The sport tag says what a centre is for. Basic records don't carry it, so a name that
      // plainly says "pool" or "climbing" (in English, French, Dutch or German) counts too.
      const name = (t.name ?? "").toLowerCase();
      if (t.sport === "swimming" || /\b(swimming|pool|piscine|zwembad|schwimmbad|hallenbad|lido|baths)\b/.test(name))
        return { category: "swim", typeLabel: "Swimming centre" };
      if (t.sport === "climbing" || /\b(climbing|boulder\w*|escalade|klim\w*|kletter\w*)\b/.test(name)) return { category: "climbing", typeLabel: "Climbing" };
      return { category: "leisure", typeLabel: "Leisure centre" };
    }
  }
  switch (t.amenity) {
    case "cafe":
      if (t.cafe === "board_games" || /board ?game/i.test(t.name ?? ""))
        return { category: "boardgame", typeLabel: "Board-game café" };
      return branded
        ? { category: "chaincafe", typeLabel: "Chain café" }
        : { category: "indiecafe", typeLabel: "Independent café" };
    case "cinema":
      return { category: "cinema", typeLabel: branded ? "Cinema" : "Independent cinema" };
    case "theatre":
      return { category: "live", typeLabel: "Theatre" };
    case "arts_centre":
      return { category: "art", typeLabel: "Arts centre" };
    case "marketplace":
      return { category: "market", typeLabel: "Market" };
    case "planetarium":
      return { category: "museum", typeLabel: "Planetarium" };
    case "karaoke_box":
      return { category: "karaoke", typeLabel: "Karaoke" };
    case "boat_rental":
      return { category: "boats", typeLabel: "Boat hire" };
    case "music_venue":
      return { category: "live", typeLabel: "Music venue" };
  }
  switch (t.tourism) {
    case "museum":
      return { category: "museum", typeLabel: "Museum" };
    case "gallery":
      return { category: "art", typeLabel: "Gallery" };
    case "attraction":
      return { category: "museum", typeLabel: "Local attraction" };
    case "viewpoint":
      return { category: "walk", typeLabel: "Viewpoint" };
    case "zoo":
      return { category: "zoo", typeLabel: "Zoo" };
    case "aquarium":
      return { category: "zoo", typeLabel: "Aquarium" };
    case "theme_park":
      return { category: "themepark", typeLabel: "Theme park" };
  }
  switch (t.historic) {
    case "castle":
      return { category: "historic", typeLabel: "Castle" };
    case "ruins":
      return { category: "historic", typeLabel: "Ruins" };
  }
  if (t.craft === "brewery") return { category: "brewery", typeLabel: "Brewery" };
  switch (t.shop) {
    case "second_hand":
    case "charity":
      return { category: "vintage", typeLabel: t.shop === "charity" ? "Charity shop" : "Second-hand shop" };
    case "games":
      return { category: "boardgame", typeLabel: "Games shop" };
  }
  return null;
}

function address(t: Record<string, string>) {
  const line = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  const parts = [line, t["addr:city"] ?? t["addr:suburb"], t["addr:postcode"]].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

export function elementToActivity(el: OsmElement): Activity | null {
  const t = el.tags ?? {};
  if (!t.name) return null;
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  const m = classify(t);
  if (!m) return null;

  const isPublicPark = t.leisure === "park";
  const free = t.fee === "no" || isPublicPark;
  const branded = isBranded(t);
  const tags: Tag[] = [];
  const indoorDefault = CAT[m.category].indoorDefault;
  const indoor = t.indoor === "yes" ? true : t.indoor === "no" ? false : indoorDefault;
  if (indoor) tags.push("rainy");
  if (!branded && ["indiecafe", "cinema", "vintage", "boardgame", "art", "museum", "arcade"].includes(m.category))
    tags.push("gem");

  const wheel = t.wheelchair;
  const accessible = wheel === "yes" ? true : wheel === "no" ? false : null;
  const accessNote =
    wheel === "yes"
      ? "Wheelchair accessible, according to OpenStreetMap."
      : wheel === "limited"
        ? "Limited wheelchair access, according to OpenStreetMap."
        : wheel === "no"
          ? "Not wheelchair accessible, according to OpenStreetMap."
          : "Accessibility isn't recorded in OpenStreetMap yet. Check with the venue.";

  // The place's own description when OpenStreetMap has one; otherwise a line about this kind of place.
  const id = `osm-${el.type}-${el.id}`;
  const where = t["addr:street"] ? ` on ${t["addr:street"]}` : "";
  const summary = t.description ? t.description.slice(0, 180) : (blurbFor(m.typeLabel, id) ?? `${m.typeLabel}${where}.`);

  const website = t.website ?? t["contact:website"];
  const hoursRaw = t.opening_hours;

  return {
    id,
    source: "osm",
    name: t.name,
    category: m.category,
    typeLabel: m.typeLabel,
    lat,
    lng,
    address: address(t),
    price: free ? 0 : null,
    priceNote: t.fee === "no" ? "Free (fee=no in OpenStreetMap)" : isPublicPark ? "Public park, free to enter" : undefined,
    indoor,
    accessible,
    accessNote,
    tags,
    hours: parseOsmHours(hoursRaw),
    openingHoursRaw: hoursRaw,
    summary,
    booking: free ? "free" : website ? "venue" : "unknown",
    website,
    phone: t.phone ?? t["contact:phone"],
    osm: { type: el.type, id: el.id },
    wiki: wikiRefFromTags(t),
    provenance: "Real place from OpenStreetMap. Prices, ratings and reviews aren't part of OSM, so we don't show them.",
  };
}

/** Turns raw Overpass elements into activities, dropping duplicates of the same name and category. */
export function elementsToPlaces(els: OsmElement[]): Activity[] {
  const seen = new Set<string>();
  const places: Activity[] = [];
  for (const el of els) {
    const a = elementToActivity(el);
    if (!a) continue;
    const key = `${a.name.toLowerCase()}|${a.category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push(a);
  }
  return places;
}

/** Round so nearby searches share a cache entry and we stay polite to the public Overpass servers. */
export const roundCoord = (n: number) => Math.round(n * 200) / 200;

/**
 * Runs a query against each Overpass endpoint in turn. The public servers are often overloaded
 * or refuse requests outright, so callers should have a fallback (see places-fallback.ts).
 */
export const APP_USER_AGENT = "PistachioGuide/0.1 (+https://github.com/finleypower123-cell/Pistachio-Guide)";

export async function runOverpass(query: string, opts: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<OsmElement[]> {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  // Browsers send their own User-Agent; setting one there would force a CORS preflight.
  if (typeof window === "undefined") headers["User-Agent"] = APP_USER_AGENT;
  let lastErr: unknown;
  for (const url of OVERPASS_ENDPOINTS) {
    if (opts.signal?.aborted) break;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
    const onAbort = () => ctrl.abort();
    opts.signal?.addEventListener("abort", onAbort);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: "data=" + encodeURIComponent(query),
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = (await res.json()) as { elements?: OsmElement[] };
      return json.elements ?? [];
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Overpass unavailable");
}
