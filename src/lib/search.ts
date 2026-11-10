import { CAT } from "./categories";
import { distanceKm } from "./geo";
import { isOpenAt, nowHour } from "./hours";
import type { Activity, CategoryId, Place, Prefs, Tag, Weather } from "./types";

export type OpenAt = "any" | "now" | "afternoon" | "evening";
export type SortKey = "best" | "nearest" | "cheapest" | "rating";

export interface Filters {
  text: string;
  categories: CategoryId[];
  tags: Tag[];
  price: "any" | "free" | "paid";
  maxPrice: number; // 50 = any
  maxDistKm: number;
  minRating: number;
  setting: "any" | "indoor" | "outdoor";
  family: boolean;
  accessible: boolean;
  maxDurationMin: number; // 0 = any
  group: number; // 0 = any
  openAt: OpenAt;
  sources: { demo: boolean; osm: boolean };
  sort: SortKey;
}

/** Search distances on offer, in km. */
export const RANGE_OPTIONS = [1, 2, 5, 10, 25] as const;

/** How far out places are loaded for a chosen distance: a few fixed steps, so nearby choices share a load. */
export function loadRangeKm(maxDistKm: number) {
  return maxDistKm > 10 ? 25 : maxDistKm > 5 ? 10 : 5;
}

/** Which optional details the loaded places actually carry, so filters that could never match aren't shown. */
export function availableDetails(list: Activity[]) {
  return {
    paid: list.some((a) => a.price != null && a.price > 0),
    rating: list.some((a) => a.rating != null),
    duration: list.some((a) => a.durationMin != null),
    group: list.some((a) => a.groupMax != null),
    family: list.some((a) => a.family || a.tags.includes("family")),
    hours: list.some((a) => a.hours != null),
    access: list.some((a) => a.accessible === true),
    tags: new Set(list.flatMap((a) => a.tags)),
    categories: new Set(list.map((a) => a.category)),
  };
}

export const defaultFilters = (): Filters => ({
  text: "",
  categories: [],
  tags: [],
  price: "any",
  maxPrice: 50,
  maxDistKm: 5,
  minRating: 0,
  setting: "any",
  family: false,
  accessible: false,
  maxDurationMin: 0,
  group: 0,
  openAt: "any",
  sources: { demo: true, osm: true },
  sort: "best",
});

const OPEN_HOUR: Record<Exclude<OpenAt, "any">, () => number> = {
  now: () => nowHour(),
  afternoon: () => 15,
  evening: () => 19.5,
};

export function applyFilters(list: Activity[], f: Filters, center: Place, weather?: Weather | null) {
  const out = list.filter((a) => {
    if (!f.sources[a.source === "osm" ? "osm" : "demo"]) return false;
    if (f.categories.length && !f.categories.includes(a.category)) return false;
    if (f.tags.length && !f.tags.every((t) => a.tags.includes(t))) return false;
    if (f.price === "free" && a.price !== 0) return false;
    if (f.price === "paid" && !(a.price && a.price > 0)) return false;
    if (f.maxPrice < 50 && (a.price == null || a.price > f.maxPrice)) return false;
    if (distanceKm(center, a) > f.maxDistKm) return false;
    if (f.minRating && (a.rating ?? 0) < f.minRating) return false;
    if (f.setting === "indoor" && a.indoor !== true) return false;
    if (f.setting === "outdoor" && a.indoor !== false) return false;
    if (f.family && !(a.family || a.tags.includes("family"))) return false;
    if (f.accessible && a.accessible !== true) return false;
    if (f.maxDurationMin && (a.durationMin == null || a.durationMin > f.maxDurationMin)) return false;
    if (f.group && (a.groupMax == null || a.groupMax < f.group)) return false;
    if (f.openAt !== "any" && isOpenAt(a.hours, OPEN_HOUR[f.openAt]()) !== true) return false;
    if (f.text) {
      const hay = `${a.name} ${a.summary} ${CAT[a.category].label} ${a.typeLabel ?? ""} ${a.address ?? ""}`.toLowerCase();
      if (!f.text.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  return sortActivities(out, f.sort, center, weather);
}

/** Ranking never boosts sponsored listings. */
export function score(a: Activity, center: Place, weather?: Weather | null) {
  const d = distanceKm(center, a);
  const rating = a.rating ?? 4.2; // neutral prior for places without ratings (OSM)
  let s = rating * 2 - d * 0.5;
  if (a.tags.includes("gem")) s += 0.4;
  if (a.tags.includes("weird")) s += 0.3;
  if (weather?.isWet) s += a.indoor ? 1.2 : a.indoor === false ? -1.5 : 0;
  if (a.source === "osm" && a.category === "chaincafe") s -= 0.8;
  return s;
}

export function sortActivities(list: Activity[], sort: SortKey, center: Place, weather?: Weather | null) {
  const arr = [...list];
  if (sort === "nearest") arr.sort((a, b) => distanceKm(center, a) - distanceKm(center, b));
  else if (sort === "cheapest") arr.sort((a, b) => (a.price ?? 999) - (b.price ?? 999));
  else if (sort === "rating") arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  else arr.sort((a, b) => score(b, center, weather) - score(a, center, weather));
  return arr;
}

const NUM: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10, twelve: 12 };

const CAT_WORDS: [RegExp, CategoryId[]][] = [
  [/\b(caf[eé]s?|coffee)(?![a-z])/, ["indiecafe", "boardgame", "chaincafe"]],
  [/\bescape\b/, ["escape"]],
  [/\b(arcades?|retro|gaming|pinball)\b/, ["arcade", "boardgame"]],
  [/\bboard ?games?\b/, ["boardgame"]],
  [/\bbowl(ing)?\b/, ["bowling"]],
  [/\b(climb|climbing|boulder(ing)?)\b/, ["climbing"]],
  [/\b(trampolin\w*|bounce)\b/, ["trampoline"]],
  [/\b(crazy golf|mini golf|golf)\b/, ["golf"]],
  [/\b(cinemas?|films?|movies?)\b/, ["cinema"]],
  [/\bmarkets?\b/, ["market"]],
  [/\b(vintage|thrift|second[- ]hand|charity shop)\b/, ["vintage"]],
  [/\bmuseums?\b/, ["museum"]],
  [/\b(art|gallery|paint|print)\b/, ["art"]],
  [/\b(walks?|stroll|wander)\b/, ["walk"]],
  [/\b(parks?|gardens?|picnic)\b/, ["park"]],
  [/\b(swim\w*|pool|lido)\b/, ["swim"]],
  [/\b(leisure centre|gym|sports)\b/, ["leisure"]],
  [/\b(workshops?|make something|class|pottery|craft)\b/, ["workshop", "art"]],
  [/\b(food|eat|dinner|tasting|dumplings?)\b/, ["food"]],
  [/\b(music|gig|comedy|show|live|theatre)\b/, ["live"]],
  [/\b(water ?park|slides)\b/, ["water"]],
];

export interface Parsed {
  filters: Partial<Filters>;
  understood: string[];
}

/** Natural-language search: turns "a weird date idea near me under £20" into filters. */
export function parseQuery(q: string): Parsed {
  const s = q.toLowerCase().trim();
  const f: Partial<Filters> = {};
  const understood: string[] = [];
  const tags = new Set<Tag>();
  const cats = new Set<CategoryId>();

  const price = s.match(/(?:under|below|less than|max|up to|<)\s*£?\s*(\d+)/) ?? s.match(/£\s*(\d+)/);
  if (price) {
    f.maxPrice = Math.min(50, Number(price[1]));
    understood.push(`Under £${price[1]}`);
  }
  if (/\b(free|no cost|skint|broke|cheap as chips)\b/.test(s)) {
    f.price = "free";
    understood.push("Free");
  }
  if (/\b(rain\w*|wet|indoors?|inside|cold)\b/.test(s)) {
    f.setting = "indoor";
    understood.push("Indoors");
  } else if (/\b(outdoors?|outside|sunny|fresh air)\b/.test(s)) {
    f.setting = "outdoor";
    understood.push("Outdoors");
  }
  if (/\b(date|romantic|couple)\b/.test(s)) tags.add("date");
  if (/\b(weird|quirky|unusual|odd|strange|bizarre)\b/.test(s)) tags.add("weird");
  if (/\b(hidden|gems?|secret|independent|indie)\b/.test(s)) tags.add("gem");
  if (/\b(solo|alone|by myself|on my own)\b/.test(s)) tags.add("solo");
  if (/\b(famil\w*|kids?|children)\b/.test(s)) {
    f.family = true;
    understood.push("Family-friendly");
  }
  const g = s.match(/group of (\w+)|(\w+) (?:people|of us|friends|mates)/);
  const gn = g ? (NUM[g[1] ?? g[2]] ?? Number(g[1] ?? g[2])) : NaN;
  if (Number.isFinite(gn) && gn > 1) {
    f.group = gn;
    understood.push(`Group of ${gn}`);
  } else if (/\b(friends|mates|group)\b/.test(s)) tags.add("friends");
  if (/\b(walking distance|nearby|near me|close by|around here)\b/.test(s)) {
    f.maxDistKm = 1.5;
    understood.push("Walking distance");
  }
  if (/\b(right now|open now|now)\b/.test(s)) {
    f.openAt = "now";
    understood.push("Open now");
  } else if (/\bafternoon\b/.test(s)) {
    f.openAt = "afternoon";
    understood.push("Open this afternoon");
  } else if (/\b(tonight|evening)\b/.test(s)) {
    f.openAt = "evening";
    understood.push("Open tonight");
  }
  if (/\b(accessible|wheelchair|step-free)\b/.test(s)) {
    f.accessible = true;
    understood.push("Accessible");
  }
  if (/\b(quick|an hour|1 hour|short)\b/.test(s)) {
    f.maxDurationMin = 60;
    understood.push("Up to 1 hour");
  } else if (/\b(couple of hours|2 hours|two hours)\b/.test(s)) {
    f.maxDurationMin = 120;
    understood.push("Up to 2 hours");
  }
  for (const [re, ids] of CAT_WORDS) if (re.test(s)) ids.forEach((c) => cats.add(c));
  // "a quirky café" means an interesting independent one, not a literally weird attraction
  if (cats.size && tags.has("weird") && !/\bweird\b/.test(s)) {
    tags.delete("weird");
    tags.add("gem");
  }

  if (tags.size) {
    f.tags = [...tags];
    tags.forEach((t) => understood.push({ date: "Date idea", weird: "Something weird", gem: "Hidden gem", solo: "Solo", friends: "With friends", family: "Family", rainy: "Rainy day" }[t]));
  }
  if (cats.size) {
    f.categories = [...cats];
    understood.push(...[...cats].map((c) => CAT[c].label));
  }
  if (!understood.length && s) {
    f.text = s.replace(/\b(something|somewhere|things?|to do|a|an|the|fun|near|me|for|in|with)\b/g, " ").replace(/\s+/g, " ").trim();
    if (f.text) understood.push(`“${f.text}”`);
  }
  return { filters: f, understood };
}

export interface Mood {
  id: string;
  label: string;
  sub: string;
  icon: CategoryId;
  filters: Partial<Filters>;
}

export const MOODS: Mood[] = [
  { id: "laugh", label: "Need a laugh", sub: "Silly, social, loud", icon: "golf", filters: { categories: ["golf", "live", "bowling", "arcade", "trampoline"] } },
  { id: "make", label: "Make something", sub: "Leave with a thing you made", icon: "workshop", filters: { categories: ["workshop", "art", "food"] } },
  { id: "compete", label: "Feeling competitive", sub: "Scores, timers, bragging rights", icon: "escape", filters: { categories: ["escape", "bowling", "golf", "arcade", "climbing"] } },
  { id: "cosy", label: "Slow & cosy", sub: "Warm drinks and soft chairs", icon: "indiecafe", filters: { categories: ["indiecafe", "boardgame", "cinema", "vintage"] } },
  { id: "adrenaline", label: "Bit of adrenaline", sub: "Climb, bounce, splash", icon: "climbing", filters: { categories: ["climbing", "trampoline", "water", "swim"] } },
  { id: "weird", label: "Something weird", sub: "You'll tell people about this", icon: "museum", filters: { tags: ["weird"] } },
  { id: "air", label: "Fresh air", sub: "Out and about", icon: "park", filters: { setting: "outdoor" } },
  { id: "broke", label: "Broke but bored", sub: "Costs nothing at all", icon: "walk", filters: { price: "free" } },
];

/** Surprise Me: weighted random pick that respects budget, preferences, distance and weather. */
export function surprisePick(list: Activity[], center: Place, prefs: Prefs, weather: Weather | null, avoid?: string) {
  const pool = list.filter((a) => {
    if (a.id === avoid) return false;
    if (distanceKm(center, a) > 3.5) return false;
    if (prefs.budget < 50 && a.price != null && a.price > prefs.budget) return false;
    if (prefs.weatherSmart && weather?.isWet && a.indoor === false) return false;
    return true;
  });
  if (!pool.length) return null;
  const weights = pool.map((a) => {
    let w = 1 + Math.max(0, score(a, center, weather));
    if (prefs.categories.includes(a.category)) w *= 2.5;
    if (a.tags.includes("weird") || a.tags.includes("gem")) w *= 1.4;
    return w;
  });
  let r = Math.random() * weights.reduce((x, y) => x + y, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
