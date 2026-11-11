import { distanceKm } from "./geo";
import type { Activity, CategoryId, PhotoCredit, WikiRef } from "./types";

/**
 * Real photos and short descriptions from Wikimedia projects (Wikipedia, Wikidata, Commons).
 *
 * Everything here runs in the browser against Wikimedia's public APIs, which allow cross-origin
 * requests with `origin=*`. Two rules shape the code:
 *
 * - A wrong photo is worse than no photo. A place only gets a photo when OpenStreetMap links it
 *   to a Wikidata item or Commons file, or when a nearby Wikidata item has the same name and is
 *   the same kind of thing. Anything doubtful keeps its illustration.
 * - Everything is credited. Wikipedia text is CC BY-SA and Commons files carry their own licences,
 *   so every photo keeps a link to its file page and every extract a link to its article.
 *
 * Nothing here is allowed to delay or break place loading: every call has a timeout, failures
 * resolve to "no photo", and results are cached on the device.
 */

// ---- OpenStreetMap tags --------------------------------------------------------------------------

const COMMONS_URL = /^https?:\/\/(?:commons\.wikimedia\.org\/wiki\/(?:File|Image):|upload\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/)([^/?#]+)/i;

const tidyTitle = (s: string) => {
  let out = s;
  try {
    out = decodeURIComponent(s);
  } catch {
    // Not percent-encoded after all: use it as written.
  }
  return out.replace(/_/g, " ").trim();
};

/** A Commons file name from an `image` or `wikimedia_commons` tag. Other hosts are never used. */
function commonsFileFrom(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.split(";")[0].trim();
  const named = v.match(/^(?:File|Image):(.+)$/i);
  if (named) return tidyTitle(named[1]);
  const url = v.match(COMMONS_URL);
  return url ? tidyTitle(url[1]) : undefined;
}

/** The Wikimedia links an OpenStreetMap record carries, if any. */
export function wikiRefFromTags(t: Record<string, string>): WikiRef | undefined {
  const ref: WikiRef = {};
  const wp = t.wikipedia?.split(";")[0].match(/^([a-z][a-z-]{1,11}):(.+)$/);
  if (wp) ref.wikipedia = { lang: wp[1], title: tidyTitle(wp[2]) };
  const qid = t.wikidata?.split(";")[0].trim();
  if (qid && /^Q\d+$/.test(qid)) ref.wikidata = qid;
  const category = t.wikimedia_commons?.split(";")[0].trim().match(/^Category:(.+)$/i);
  if (category) ref.commonsCategory = tidyTitle(category[1]);
  const file = commonsFileFrom(t.wikimedia_commons) ?? commonsFileFrom(t.image);
  if (file) ref.commonsFile = file;
  return Object.keys(ref).length ? ref : undefined;
}

// ---- Commons files -------------------------------------------------------------------------------

/** Photographs only: logos, maps and diagrams are mostly SVG or PNG, and they misrepresent a place. */
export const isPhotoFile = (name: string) => /\.(jpe?g|webp)$/i.test(name);

const fileSlug = (file: string) => encodeURIComponent(file.replace(/ /g, "_"));

/**
 * A scaled copy of a Commons file. Wikimedia only serves a fixed set of thumbnail widths (other
 * sizes are refused), so callers choose from these three and never load the full-size original.
 */
export type ThumbWidth = 330 | 500 | 960;
export const commonsThumb = (file: string, width: ThumbWidth) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${fileSlug(file)}?width=${width}`;

export const commonsFilePage = (file: string) => `https://commons.wikimedia.org/wiki/File:${fileSlug(file)}`;

/** Responsive sources for a `commonsThumb` URL: small ones for cards, up to 960px for a hero. */
export function thumbSrcSet(url: string, hero = false): string | undefined {
  const m = url.match(/^(https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/[^?]+)\?width=\d+$/);
  if (!m) return undefined;
  const widths: ThumbWidth[] = hero ? [500, 960] : [330, 500];
  return widths.map((w) => `${m[1]}?width=${w} ${w}w`).join(", ");
}

// ---- Fetching ------------------------------------------------------------------------------------

async function getJson<T>(url: string, signal?: AbortSignal, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${new URL(url).hostname} ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

const api = (host: string, params: Record<string, string | number>) => {
  const u = new URL(`https://${host}/w/api.php`);
  for (const [k, v] of Object.entries({ format: "json", formatversion: 2, origin: "*", ...params })) u.searchParams.set(k, String(v));
  return u.toString();
};

const chunks = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

// ---- On-device cache -----------------------------------------------------------------------------

const DAY_MS = 86_400_000;

interface Cached<T> {
  key: string;
  at: number;
  value: T;
}

function cacheGet<T>(store: string, key: string, ttlMs: number): T | undefined {
  try {
    if (typeof localStorage === "undefined") return undefined;
    const all = JSON.parse(localStorage.getItem(store) ?? "[]") as Cached<T>[];
    const hit = all.find((e) => e.key === key);
    return hit && Date.now() - hit.at < ttlMs ? hit.value : undefined;
  } catch {
    return undefined;
  }
}

function cacheSet<T>(store: string, key: string, value: T, keep: number) {
  try {
    if (typeof localStorage === "undefined") return;
    const all = (JSON.parse(localStorage.getItem(store) ?? "[]") as Cached<T>[]).filter((e) => e.key !== key);
    all.unshift({ key, at: Date.now(), value });
    localStorage.setItem(store, JSON.stringify(all.slice(0, keep)));
  } catch {
    // Storage full or unavailable: the cache is only a convenience.
  }
}

// ---- Matching nearby Wikidata items to places ----------------------------------------------------

/** A Wikidata item with coordinates, as found near the search centre. */
export interface WikiItem {
  id: string;
  lat: number;
  lng: number;
  /** Labels and aliases in the languages we ask for */
  names?: string[];
  /** English description, e.g. "art museum in Brussels, Belgium" */
  desc?: string;
}

const STOP = new Set(["the", "le", "la", "les", "l", "de", "du", "des", "d", "het", "een", "der", "den", "die", "das", "el", "los", "las", "il", "lo", "of", "van", "von", "and", "et", "en", "und", "y", "e", "a", "an"]);

/** Lower-case, accent-free, punctuation-free tokens with articles and joining words removed. */
export function nameTokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w));
}

/**
 * The names a place goes by. OpenStreetMap names in bilingual areas are written as
 * "French name - Dutch name", so each side counts as a name of its own. One short word
 * ("Parc", "Cirio") is a weak name: it is only returned on request, and matching accepts it
 * only when the item is clearly the same kind of place.
 */
export function nameVariants(name: string, includeWeak = false): string[][] {
  const parts = [name, ...name.split(/\s+[-–—/|]\s+|[;()]/)];
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const p of parts) {
    const tokens = nameTokens(p);
    const key = tokens.join(" ");
    if (!key || seen.has(key) || key.length < 4) continue;
    if (!includeWeak && isWeak(tokens)) continue;
    seen.add(key);
    out.push(tokens);
  }
  return out;
}

const isWeak = (tokens: string[]) => tokens.length < 2 && tokens.join("").length < 7;

/** Things that share names with venues but are never the venue itself. */
const NOT_A_VENUE = /\b(street|road|avenue|boulevard|lane|station|stop|railway|tram|metro|bus|line|route|company|business|enterprise|brand|organi[sz]ation|association|event|tournament|festival|person|family|film|album|song|book|painting|ship)\b/i;

/** What a Wikidata item's English description must mention to count as the same kind of place. */
const KIND: Partial<Record<CategoryId, RegExp>> = {
  park: /park|garden|green|common|forest|wood|square|cemetery|nature|reserve|arboretum|meadow|heath/i,
  museum: /museum|gallery|exhibit|collection|memorial|house|palace|castle|cent(re|er)|heritage|monument|attraction|landmark|tower|fountain|sculpture|statue|site|building|church|cathedral|abbey|viewpoint|observat/i,
  art: /gallery|museum|art|exhibit|cultur/i,
  cinema: /cinema|movie|film theat|picture house|theat/i,
  live: /theat|opera|concert|hall|venue|arts|cultural|music|stage|playhouse|club|circus|auditorium/i,
  market: /market|hall|bazaar/i,
  water: /water ?park|pool|swim|aquatic|bath|lido/i,
  swim: /pool|swim|aquatic|bath|lido|leisure/i,
  leisure: /leisure|sport|pool|swim|stadium|arena|gym|recreation/i,
  indiecafe: /caf[eé]|coffee|\bbar\b|pub|restaurant|tavern|brasserie|tea ?(room|house)|bakery|patisserie|inn\b/i,
  boardgame: /caf[eé]|\bbar\b|pub|game/i,
  food: /restaurant|caf[eé]|\bbar\b|pub|food|market|brasserie|bakery/i,
  vintage: /shop|store|boutique|market/i,
};

/** Parks are large and mapped by their centre, so their coordinates can sit far apart. */
export const maxDistanceKm = (c: CategoryId) => (c === "park" ? 0.7 : 0.25);

const sameTokens = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => t === b[i]);

/** True when every word of the shorter name appears in the longer one and little else does. */
function mostlyContained(a: string[], b: string[]) {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < 2) return false;
  const set = new Set(long);
  return short.every((t) => set.has(t)) && short.length / long.length >= 0.66;
}

/** Whether a nearby Wikidata item is confidently the same place: null, or how strong the match is. */
export function matchStrength(place: Pick<Activity, "name" | "category" | "lat" | "lng">, item: WikiItem): "exact" | "close" | null {
  if (place.category === "chaincafe" || !item.names?.length || !item.desc) return null;
  if (distanceKm(place, item) > maxDistanceKm(place.category)) return null;
  if (NOT_A_VENUE.test(item.desc)) return null;
  const kind = KIND[place.category];
  const sameKind = kind ? kind.test(item.desc) : false;
  const variants = nameVariants(place.name, true);
  const names = item.names.map(nameTokens).filter((t) => t.length);
  const identical = variants.filter((v) => names.some((n) => sameTokens(v, n)));
  if (identical.length) {
    // An identical name is enough for kinds of place we have no description test for, unless the
    // name is one short word. With a test, the item must pass it: a café named after the statue
    // next door must not get the statue's photo.
    if (kind) return sameKind ? "exact" : null;
    return identical.some((v) => !isWeak(v)) ? "exact" : null;
  }
  if (sameKind && variants.some((v) => !isWeak(v) && names.some((n) => mostlyContained(v, n)))) return "close";
  return null;
}

/** The best nearby item for each place: exact names beat close ones, then the nearest wins. */
export function matchPlacesToItems(places: Activity[], items: WikiItem[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of places) {
    let best: { id: string; rank: number; km: number } | null = null;
    for (const item of items) {
      const strength = matchStrength(p, item);
      if (!strength) continue;
      const candidate = { id: item.id, rank: strength === "exact" ? 0 : 1, km: distanceKm(p, item) };
      if (!best || candidate.rank < best.rank || (candidate.rank === best.rank && candidate.km < best.km)) best = candidate;
    }
    if (best) out[p.id] = best.id;
  }
  return out;
}

// ---- Photos for a whole area (list cards) --------------------------------------------------------

/** Languages whose labels we compare place names against, plus the visitor's own. */
const NAME_LANGS = ["en", "fr", "nl", "de", "es", "it", "pt", "mul", "ca", "pl", "sv", "da", "nb", "fi", "cs", "ga"];

/**
 * Kinds of venue asked for by name, because the general search below returns at most 500 items
 * and a dense city has thousands. These are exact "instance of" values, so the list is long.
 */
const VENUE_CLASSES = ["Q33506", "Q207694", "Q22698", "Q24354", "Q41253", "Q1007870", "Q570116", "Q43501", "Q167346", "Q1107656", "Q30022", "Q200023", "Q153562", "Q1060829", "Q194195", "Q740326", "Q2190251", "Q37654", "Q11707", "Q212198"];

interface SearchPage {
  title: string;
  coordinates?: { lat: number; lon: number }[];
}

async function searchItems(query: string, signal?: AbortSignal): Promise<WikiItem[]> {
  const j = await getJson<{ query?: { pages?: SearchPage[] } }>(
    api("www.wikidata.org", { action: "query", generator: "search", gsrsearch: query, gsrlimit: 500, gsrnamespace: 0, prop: "coordinates", colimit: 500 }),
    signal,
  );
  return (j.query?.pages ?? []).flatMap((p) => (p.coordinates?.[0] ? [{ id: p.title, lat: p.coordinates[0].lat, lng: p.coordinates[0].lon }] : []));
}

/** Wikidata items that have a picture and sit within the radius of a point. Coordinates only. */
export async function itemsNear(lat: number, lng: number, radiusKm: number, signal?: AbortSignal): Promise<WikiItem[]> {
  const near = `nearcoord:${Math.max(1, Math.min(10, Math.round(radiusKm)))}km,${lat.toFixed(4)},${lng.toFixed(4)} haswbstatement:P18`;
  const results = await Promise.allSettled([
    searchItems(`${near} haswbstatement:${VENUE_CLASSES.map((c) => `P31=${c}`).join("|")}`, signal),
    searchItems(near, signal),
  ]);
  if (results.every((r) => r.status === "rejected")) throw new Error("Wikidata search unavailable");
  const byId = new Map<string, WikiItem>();
  for (const r of results) if (r.status === "fulfilled") for (const item of r.value) if (!byId.has(item.id)) byId.set(item.id, item);
  return [...byId.values()];
}

interface Entity {
  id: string;
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  descriptions?: Record<string, { value: string }>;
}

/** Adds names and the English description to items, 50 per request (the API's limit). */
export async function describeItems(items: WikiItem[], signal?: AbortSignal): Promise<WikiItem[]> {
  const out: WikiItem[] = [];
  for (const batch of chunks(items, 50)) {
    if (signal?.aborted) break;
    try {
      const j = await getJson<{ entities?: Record<string, Entity> }>(
        api("www.wikidata.org", { action: "wbgetentities", ids: batch.map((i) => i.id).join("|"), props: "labels|aliases|descriptions", languages: NAME_LANGS.join("|") }),
        signal,
      );
      for (const item of batch) {
        const e = j.entities?.[item.id];
        if (!e) continue;
        const names = [...Object.values(e.labels ?? {}).map((l) => l.value), ...Object.values(e.aliases ?? {}).flatMap((a) => a.map((x) => x.value))];
        out.push({ ...item, names: [...new Set(names)], desc: e.descriptions?.en?.value });
      }
    } catch {
      // One failed batch only means fewer photos.
    }
  }
  return out;
}

/** The picture Wikidata records for each item (its "image" statement), as a Commons file name. */
export async function itemImages(ids: string[], signal?: AbortSignal): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const batch of chunks(ids, 50)) {
    if (signal?.aborted) break;
    try {
      const j = await getJson<{ query?: { pages?: { title: string; pageimage?: string }[] } }>(
        api("www.wikidata.org", { action: "query", titles: batch.join("|"), prop: "pageimages", piprop: "name", pilimit: 50 }),
        signal,
      );
      for (const p of j.query?.pages ?? []) if (p.pageimage && isPhotoFile(p.pageimage)) out[p.title] = tidyTitle(p.pageimage);
    } catch {
      // As above.
    }
  }
  return out;
}

/** How many nearby items we look up names for, and how many photos we resolve, per area. */
const MAX_CANDIDATES = 250;
const MAX_PHOTOS = 150;

const AREA_STORE = "pg:wiki-area:v1";

export type AreaPhotos = Record<string, { file: string }>;

/**
 * Photos for the places of one search area, keyed by place id. A handful of requests in total,
 * however many places there are, and none at all when the area was looked up in the last week.
 */
export async function loadAreaPhotos(places: Activity[], centre: { lat: number; lng: number }, radiusKm: number, signal?: AbortSignal): Promise<AreaPhotos> {
  const key = `${centre.lat.toFixed(3)},${centre.lng.toFixed(3)},${radiusKm}`;
  const cached = cacheGet<AreaPhotos>(AREA_STORE, key, 7 * DAY_MS);
  if (cached) return cached;

  const wanted = places.filter((p) => !p.photos?.length && p.category !== "chaincafe");
  // Places OpenStreetMap links to Wikidata need no guessing.
  const linked: Record<string, string> = {};
  for (const p of wanted) if (p.wiki?.wikidata) linked[p.id] = p.wiki.wikidata;
  const unlinked = wanted.filter((p) => !linked[p.id]);

  let matched: Record<string, string> = {};
  if (unlinked.length) {
    const items = await itemsNear(centre.lat, centre.lng, radiusKm, signal);
    // Only items close to a place can match it; look up names for the closest ones.
    const close = items
      .map((item) => {
        let km = Infinity;
        for (const p of unlinked) {
          const d = distanceKm(p, item);
          if (d <= maxDistanceKm(p.category) && d < km) km = d;
        }
        return { item, km };
      })
      .filter((c) => Number.isFinite(c.km))
      .sort((a, b) => a.km - b.km)
      .slice(0, MAX_CANDIDATES)
      .map((c) => c.item);
    matched = matchPlacesToItems(unlinked, await describeItems(close, signal));
  }

  const itemOf = { ...matched, ...linked };
  const files = await itemImages([...new Set(Object.values(itemOf))].slice(0, MAX_PHOTOS), signal);
  const photos: AreaPhotos = {};
  for (const [placeId, itemId] of Object.entries(itemOf)) if (files[itemId]) photos[placeId] = { file: files[itemId] };
  if (!signal?.aborted) cacheSet(AREA_STORE, key, photos, 3);
  return photos;
}

/** Adds the found photos to places that have none of their own, with their credit links. */
export function withAreaPhotos(places: Activity[], photos: AreaPhotos): Activity[] {
  return places.map((p) => {
    const found = photos[p.id];
    if (!found || p.photos?.length) return p;
    return { ...p, photos: [commonsThumb(found.file, 500)], photoCredits: [{ page: commonsFilePage(found.file) }] };
  });
}

// ---- One place in full (place page) --------------------------------------------------------------

export interface WikiText {
  text: string;
  lang: string;
  title: string;
  url: string;
}

export interface PlaceMedia {
  text?: WikiText;
  /** Hero first, then other photos of the same place. `src` is 960px wide. */
  photos: { src: string; credit: PhotoCredit }[];
}

interface ImageInfoPage {
  title: string;
  imageinfo?: { mime?: string; width?: number; height?: number; extmetadata?: Record<string, { value?: string }> }[];
}

/** Commons credits come as HTML snippets; keep the words only. */
export function plainText(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return undefined;
  return text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text;
}

const creditOf = (p: ImageInfoPage): PhotoCredit => {
  const meta = p.imageinfo?.[0]?.extmetadata ?? {};
  return { page: commonsFilePage(p.title.replace(/^File:/, "")), by: plainText(meta.Artist?.value), license: plainText(meta.LicenseShortName?.value) };
};

const IMAGE_INFO = { prop: "imageinfo", iiprop: "extmetadata|mime|size", iiextmetadatafilter: "Artist|LicenseShortName", iiextmetadatalanguage: "en" };

/** A sensible gallery picture: a photograph, big enough, and not a strip or a banner. */
function galleryWorthy(p: ImageInfoPage) {
  const info = p.imageinfo?.[0];
  if (!info?.width || !info.height || !isPhotoFile(p.title)) return false;
  const ratio = info.width / info.height;
  return info.width >= 640 && ratio >= 0.6 && ratio <= 2.2;
}

const PLACE_STORE = "pg:wiki-place:v1";

/** Wikipedias we fall back to when there is no article in the visitor's language or English. */
const FALLBACK_LANGS = ["fr", "nl", "de", "es", "it", "pt"];

/**
 * The photo(s) and description for one place, from the links its OpenStreetMap record carries.
 * `langs` is the visitor's order of preference, e.g. ["nl", "en"].
 */
export async function loadPlaceMedia(ref: WikiRef, langs: string[], signal?: AbortSignal): Promise<PlaceMedia> {
  const key = `${ref.wikidata ?? ""}|${ref.wikipedia ? `${ref.wikipedia.lang}:${ref.wikipedia.title}` : ""}|${ref.commonsFile ?? ""}|${ref.commonsCategory ?? ""}|${langs[0] ?? ""}`;
  const cached = cacheGet<PlaceMedia>(PLACE_STORE, key, 7 * DAY_MS);
  if (cached) return cached;

  const wanted = [...new Set([...langs, "en"])];
  let article = ref.wikipedia;
  let category = ref.commonsCategory;
  let heroFile = ref.commonsFile;

  // 1. Which Wikipedia article to read, preferring the visitor's language.
  if (ref.wikidata) {
    try {
      const j = await getJson<{ entities?: Record<string, { sitelinks?: Record<string, { title: string }> }> }>(
        api("www.wikidata.org", { action: "wbgetentities", ids: ref.wikidata, props: "sitelinks" }),
        signal,
      );
      const links = j.entities?.[ref.wikidata]?.sitelinks ?? {};
      const order = [...wanted, ...(ref.wikipedia ? [ref.wikipedia.lang] : []), ...FALLBACK_LANGS];
      const lang = order.find((l) => links[`${l.replace(/-/g, "_")}wiki`]);
      if (lang) article = { lang, title: links[`${lang.replace(/-/g, "_")}wiki`].title };
      const commons = links.commonswiki?.title.match(/^Category:(.+)$/);
      if (commons && !category) category = commons[1];
    } catch {
      // Fall back to whatever the OpenStreetMap tags named.
    }
  } else if (ref.wikipedia && !wanted.includes(ref.wikipedia.lang)) {
    try {
      const j = await getJson<{ query?: { pages?: { langlinks?: { lang: string; title: string }[] }[] } }>(
        api(`${ref.wikipedia.lang}.wikipedia.org`, { action: "query", titles: ref.wikipedia.title, prop: "langlinks", lllimit: 500, redirects: 1 }),
        signal,
      );
      const links = j.query?.pages?.[0]?.langlinks ?? [];
      const hit = wanted.map((l) => links.find((x) => x.lang === l)).find(Boolean);
      if (hit) article = { lang: hit.lang, title: hit.title };
    } catch {
      // Keep the tagged language.
    }
  }

  // 2. The article's opening paragraph, and the picture to lead with: the file OpenStreetMap names,
  //    else the one Wikidata records (the same picture list cards use), else the article's own.
  const summary = article
    ? getJson<{ type?: string; title?: string; extract?: string; originalimage?: { source?: string }; content_urls?: { desktop?: { page?: string } } }>(
        `https://${article.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article.title.replace(/ /g, "_"))}`,
        signal,
      ).catch(() => null)
    : Promise.resolve(null);
  const itemImage =
    !heroFile && ref.wikidata
      ? getJson<{ claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } }>(api("www.wikidata.org", { action: "wbgetclaims", entity: ref.wikidata, property: "P18" }), signal)
          .then((j) => j.claims?.P18?.[0]?.mainsnak?.datavalue?.value)
          .catch(() => undefined)
      : Promise.resolve(undefined);
  const [s, p18] = await Promise.all([summary, itemImage]);

  let text: WikiText | undefined;
  if (article && s && s.type !== "disambiguation" && s.extract && s.content_urls?.desktop?.page) {
    text = { text: s.extract, lang: article.lang, title: s.title ?? article.title, url: s.content_urls.desktop.page };
  }
  if (!heroFile && p18 && isPhotoFile(p18)) heroFile = p18;
  // Only Commons files: pictures hosted on a single Wikipedia can be non-free.
  if (!heroFile && s && s.type !== "disambiguation") heroFile = commonsFileFrom(s.originalimage?.source);
  if (heroFile && !isPhotoFile(heroFile)) heroFile = undefined;

  // 3. Credits for the hero, and more photos from the place's own Commons category.
  const [heroPages, categoryPages] = await Promise.all([
    heroFile
      ? getJson<{ query?: { pages?: ImageInfoPage[] } }>(api("commons.wikimedia.org", { action: "query", titles: `File:${heroFile}`, ...IMAGE_INFO }), signal).then((j) => j.query?.pages ?? []).catch(() => [])
      : Promise.resolve([] as ImageInfoPage[]),
    category
      ? getJson<{ query?: { pages?: ImageInfoPage[] } }>(
          api("commons.wikimedia.org", { action: "query", generator: "categorymembers", gcmtitle: `Category:${category}`, gcmtype: "file", gcmlimit: 30, ...IMAGE_INFO }),
          signal,
        ).then((j) => j.query?.pages ?? []).catch(() => [])
      : Promise.resolve([] as ImageInfoPage[]),
  ]);

  const photos: PlaceMedia["photos"] = [];
  const used = new Set<string>();
  const add = (file: string, credit: PhotoCredit) => {
    const id = file.replace(/_/g, " ").toLowerCase();
    if (used.has(id) || photos.length >= 5) return;
    used.add(id);
    photos.push({ src: commonsThumb(file, 960), credit });
  };
  if (heroFile) add(heroFile, heroPages[0]?.imageinfo ? creditOf(heroPages[0]) : { page: commonsFilePage(heroFile) });
  for (const p of categoryPages.filter(galleryWorthy)) add(p.title.replace(/^File:/, ""), creditOf(p));

  const media: PlaceMedia = { text, photos };
  if (!signal?.aborted) cacheSet(PLACE_STORE, key, media, 40);
  return media;
}

/** The visitor's languages in order of preference, as Wikipedia language codes. */
export function visitorLangs(): string[] {
  if (typeof navigator === "undefined") return ["en"];
  const all = (navigator.languages?.length ? navigator.languages : [navigator.language]).map((l) => l.toLowerCase().split("-")[0]).filter(Boolean);
  return [...new Set(all)].slice(0, 3);
}
