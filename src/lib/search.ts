import { blurbFor } from "./blurbs";
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
    tags: new Set<Tag>([...list.flatMap((a) => a.tags), ...(list.some((a) => EXPERIENCES.has(a.category)) ? (["weird"] as Tag[]) : [])]),
    categories: new Set(list.map((a) => a.category)),
  };
}

/**
 * Kinds of place that count as "unusual" on their own (an escape room, crazy golf), so the
 * "something different" filter works for real places, which carry no hand-picked "weird" label.
 */
const EXPERIENCES = new Set<CategoryId>(["escape", "arcade", "boardgame", "golf", "trampoline", "climbing", "water"]);

const hasTag = (a: Activity, t: Tag) => a.tags.includes(t) || (t === "weird" && EXPERIENCES.has(a.category));

/** Lower-case with accents removed, so "Musée" matches "musee" and "café" matches "cafe". */
export const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Edit distance, counting a swap of neighbouring letters as one edit. Stops early once past `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** How many typos a word of this length is allowed: none for short words, where any change makes a different word. */
const typosAllowed = (w: string) => (w.length >= 8 ? 2 : w.length >= 5 ? 1 : 0);

/** Free-text match on name, type and address: every word must appear, allowing accents and small typos. */
export function matchesText(a: Activity, text: string) {
  // The stock line written for a kind of place isn't about this venue, so it isn't searched.
  const ownWords = a.summary === blurbFor(a.typeLabel ?? "", a.id) ? "" : a.summary;
  const hay = plain(`${a.name} ${ownWords} ${CAT[a.category].label} ${a.typeLabel ?? ""} ${a.address ?? ""}`);
  const hayWords = hay.split(/[^a-z0-9]+/).filter(Boolean);
  return plain(text)
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w) || (typosAllowed(w) > 0 && hayWords.some((h) => editDistance(w, h, typosAllowed(w)) <= typosAllowed(w))));
}

/**
 * Drops filters the loaded places hold no data for at all. Real map data has no family, group,
 * duration, rating or price details, so those filters could only ever return nothing; better to
 * show the rest and say what was ignored. Returns the labels of what was dropped.
 */
export function relaxFilters(f: Filters, list: Activity[]): { filters: Filters; ignored: string[] } {
  if (!list.length) return { filters: f, ignored: [] };
  const has = availableDetails(list);
  const out = { ...f };
  const ignored: string[] = [];
  const drop = (label: string, change: Partial<Filters>) => {
    Object.assign(out, change);
    ignored.push(label);
  };
  if (f.family && !has.family) drop("family-friendly", { family: false });
  if (f.group && !has.group) drop("group size", { group: 0 });
  if (f.maxDurationMin && !has.duration) drop("how long it takes", { maxDurationMin: 0 });
  if (f.minRating && !has.rating) drop("ratings", { minRating: 0 });
  if ((f.maxPrice < 50 || f.price === "paid") && !has.paid) drop("prices", { maxPrice: 50, price: f.price === "paid" ? "any" : f.price });
  if (f.openAt !== "any" && !has.hours) drop("opening hours", { openAt: "any" });
  if (f.accessible && !has.access) drop("wheelchair access", { accessible: false });
  const tags = f.tags.filter((t) => has.tags.has(t));
  if (tags.length !== f.tags.length) {
    const names: Partial<Record<Tag, string>> = { date: "date ideas", friends: "group outings", solo: "solo picks", family: "family picks", weird: "unusual picks" };
    ignored.push(...f.tags.filter((t) => !has.tags.has(t)).map((t) => names[t] ?? t));
    out.tags = tags;
  }
  return { filters: out, ignored };
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
    if (f.tags.length && !f.tags.every((t) => hasTag(a, t))) return false;
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
    if (f.text && !matchesText(a, f.text)) return false;
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
  if (hasTag(a, "weird")) s += 0.3;
  if (weather?.isWet) s += a.indoor ? 1.2 : a.indoor === false ? -1.5 : 0;
  if (a.source === "osm" && a.category === "chaincafe") s -= 0.8;
  return s;
}

export function sortActivities(list: Activity[], sort: SortKey, center: Place, weather?: Weather | null) {
  const arr = [...list];
  if (sort === "nearest") arr.sort((a, b) => distanceKm(center, a) - distanceKm(center, b));
  else if (sort === "cheapest") arr.sort((a, b) => (a.price ?? 999) - (b.price ?? 999));
  else if (sort === "rating") arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  else return diversify(arr, (a) => score(a, center, weather));
  return arr;
}

/**
 * "Best match" order: highest score first, but each further place of a kind already shown counts
 * for a little less, so the top of the list is a mix and not twenty cafés in a row.
 */
function diversify(list: Activity[], scoreOf: (a: Activity) => number): Activity[] {
  const pool = list.map((a) => ({ a, s: scoreOf(a) })).sort((x, y) => y.s - x.s);
  const seen = new Map<CategoryId, number>();
  const out: Activity[] = [];
  while (pool.length) {
    // Only the front of the queue can win, since the penalty is capped: keeps this fast for long lists.
    let best = 0;
    let bestVal = -Infinity;
    for (let i = 0; i < Math.min(pool.length, 40); i++) {
      const v = pool[i].s - Math.min(3, seen.get(pool[i].a.category) ?? 0) * 0.35;
      if (v > bestVal) {
        bestVal = v;
        best = i;
      }
    }
    const [picked] = pool.splice(best, 1);
    seen.set(picked.a.category, (seen.get(picked.a.category) ?? 0) + 1);
    out.push(picked.a);
  }
  return out;
}

const NUM: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10, twelve: 12 };

const CAT_WORDS: [RegExp, CategoryId[]][] = [
  // Queries are matched with accents removed, and include common French, Dutch and German words.
  [/\b(cafes?|coffee|koffie|kaffee|tea ?rooms?)(?![a-z])/, ["indiecafe", "boardgame", "chaincafe"]],
  [/\bescape\b/, ["escape"]],
  [/\b(arcades?|retro|gaming|pinball)\b/, ["arcade", "boardgame"]],
  [/\bboard ?games?\b/, ["boardgame"]],
  [/\bbowl(ing)?\b/, ["bowling"]],
  [/\b(climb|climbing|boulder(ing)?|escalade|klimmen|klimhal)\b/, ["climbing"]],
  [/\b(trampolin\w*|bounce)\b/, ["trampoline"]],
  [/\b(crazy golf|mini golf|golf)\b/, ["golf"]],
  [/\b(cinemas?|films?|movies?|bioscoop|kino)\b/, ["cinema"]],
  [/\b(markets?|marche|markt)\b/, ["market"]],
  [/\b(vintage|thrift|second[- ]hand|charity shop)\b/, ["vintage"]],
  [/\b(museums?|musees?|musea|exhibitions?)\b/, ["museum"]],
  [/\b(art|gallery|galleries|galerie|kunst|paint|print)\b/, ["art"]],
  [/\b(walks?|stroll|wander)\b/, ["walk"]],
  [/\b(parks?|parcs?|gardens?|jardins?|tuin|picnic)\b/, ["park"]],
  [/\b(swim\w*|pool|lido|piscine|zwembad|schwimmbad)\b/, ["swim"]],
  [/\b(leisure centre|gym|sports)\b/, ["leisure"]],
  [/\b(workshops?|make something|class|pottery|craft)\b/, ["workshop", "art"]],
  [/\b(food|eat|dinner|tasting|dumplings?)\b/, ["food"]],
  [/\b(music|gig|comedy|show|live|theatres?|theaters?)\b/, ["live"]],
  [/\b(water ?park|slides)\b/, ["water"]],
];

export interface Parsed {
  filters: Partial<Filters>;
  understood: string[];
  /** Set when the search was read with a typo fixed, e.g. "musuem" as "museum". */
  corrected?: string;
}

/** Words the search understands, used to fix near-miss spellings. */
const VOCAB = [
  "cafe", "coffee", "escape", "arcade", "retro", "pinball", "board", "games", "bowling", "climbing", "bouldering",
  "trampoline", "golf", "cinema", "films", "movies", "market", "vintage", "thrift", "museum", "gallery", "exhibition",
  "walks", "stroll", "parks", "garden", "picnic", "swimming", "leisure", "sports", "workshop", "pottery", "craft",
  "dinner", "music", "comedy", "theatre", "theater", "slides", "cheap", "rainy", "indoor", "outdoor", "outside",
  "inside", "romantic", "weird", "quirky", "unusual", "strange", "hidden", "secret", "independent", "family", "children",
  "friends", "tonight", "afternoon", "evening", "accessible", "wheelchair", "quick", "nearby", "piscine", "zwembad",
  "bioscoop", "galerie", "jardin", "musee",
];

/** Replaces near-miss spellings of words the search understands ("musuem" becomes "museum"). */
export function fixTypos(q: string) {
  return plain(q)
    .trim()
    .split(/\s+/)
    .map((w) => {
      const allowed = typosAllowed(w);
      if (!allowed || VOCAB.includes(w)) return w;
      let best = w;
      let bestD = allowed + 1;
      for (const v of VOCAB) {
        const d = editDistance(w, v, allowed);
        if (d < bestD) {
          bestD = d;
          best = v;
        }
      }
      return best;
    })
    .join(" ");
}

/**
 * Natural-language search: turns "a weird date idea near me under £20" into filters.
 *
 * When nothing in the search is recognised it becomes a text search on names and addresses. If
 * the loaded places (`list`) hold no such name, a near-miss spelling is tried before giving up,
 * so a real place name is never "corrected" away.
 */
export function parseQuery(q: string, list: Activity[] = []): Parsed {
  const first = parseExact(q);
  const text = first.filters.text;
  if (!text || Object.keys(first.filters).length > 1) return first;
  if (list.some((a) => matchesText(a, text))) return first;
  const fixed = fixTypos(q);
  if (fixed === plain(q).trim()) return first;
  const second = parseExact(fixed);
  return second.filters.text ? first : { ...second, corrected: fixed };
}

function parseExact(q: string): Parsed {
  const s = plain(q).trim();
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
