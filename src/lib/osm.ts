import { CAT } from "./categories";
import { parseOsmHours } from "./hours";
import type { Activity, CategoryId, Tag } from "./types";

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

function classify(t: Record<string, string>): Mapped | null {
  const branded = Boolean(t.brand || t["brand:wikidata"]);
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
    case "sports_centre":
      return t.sport === "swimming"
        ? { category: "swim", typeLabel: "Swimming centre" }
        : { category: "leisure", typeLabel: "Leisure centre" };
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
  }
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
  const branded = Boolean(t.brand || t["brand:wikidata"]);
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

  const where = t["addr:street"] ? ` on ${t["addr:street"]}` : "";
  const summary = t.description
    ? t.description.slice(0, 180)
    : `${m.typeLabel}${where}. Details from OpenStreetMap.`;

  const website = t.website ?? t["contact:website"];
  const hoursRaw = t.opening_hours;

  return {
    id: `osm-${el.type}-${el.id}`,
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
    provenance: "Real place from OpenStreetMap. Prices, ratings and reviews aren't part of OSM, so we don't show them.",
  };
}

export async function runOverpass(query: string): Promise<OsmElement[]> {
  let lastErr: unknown;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "PistachioGuide/0.1 (+https://github.com/finleypower123-cell/Pistachio-Guide)",
        },
        body: "data=" + encodeURIComponent(query),
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = (await res.json()) as { elements?: OsmElement[] };
      return json.elements ?? [];
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Overpass unavailable");
}
