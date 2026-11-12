/**
 * Extra details for the weekly city build (scripts/build-city-data.ts), fetched once a week on
 * GitHub's runners rather than on every visitor's phone:
 *
 * - a real description of each place: the opening of its Wikipedia article when OpenStreetMap or
 *   Wikidata links one, otherwise the short description the venue's own website gives of itself;
 * - a tiny blurred copy of each place's photo, so cards show a picture straight away and the
 *   sharp photo fades in over it.
 *
 * Nothing is written by us: a place with neither source keeps its plain line about the kind of place.
 */
import { blurbFor } from "./blurbs";
import { loadPlaceMedia, directThumb } from "./wiki";
import type { Activity, PlaceDescription } from "./types";

const UA = "PistachioGuide/0.1 (+https://github.com/finleypower123-cell/Pistachio-Guide)";

/** Runs `fn` over `items`, a few at a time. */
async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function fetchWithTimeout(url: string, ms: number, init: RequestInit = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": UA, ...(init.headers ?? {}) } });
  } finally {
    clearTimeout(timer);
  }
}

// ---- Descriptions ---------------------------------------------------------------------------------

/** The first sentences of `text`, up to about `max` characters, ending on a full stop. */
export function firstSentences(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  // Split after . ! ? followed by a space and a capital, not after "St." or "e.g."
  const parts = clean.split(/(?<=[.!?])\s+(?=[A-ZÀ-Þ"“(])/);
  let out = "";
  for (const p of parts) {
    if ((out + " " + p).trim().length > max) break;
    out = (out + " " + p).trim();
  }
  if (out) return out;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", ndash: "–", mdash: "—", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", ecirc: "ê", euml: "ë", ouml: "ö", uuml: "ü" };
export const decodeEntities = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

/** Pulls a page's own description (meta description, else og:description) and language out of its HTML. */
export function metaDescription(html: string): { text: string; lang?: string } | null {
  const head = html.slice(0, 200_000);
  const tag = (re: RegExp) => {
    for (const m of head.matchAll(re)) {
      const content = m[0].match(/content\s*=\s*("([^"]*)"|'([^']*)')/i);
      const v = content?.[2] ?? content?.[3];
      if (v?.trim()) return v;
    }
    return undefined;
  };
  const raw = tag(/<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*>/gi) ?? tag(/<meta\b[^>]*\bproperty\s*=\s*["']og:description["'][^>]*>/gi);
  if (!raw) return null;
  const lang = head.match(/<html\b[^>]*\blang\s*=\s*["']?([a-z]{2})/i)?.[1]?.toLowerCase();
  return { text: decodeEntities(raw).replace(/\s+/g, " ").trim(), lang };
}

const JUNK =
  /cookie|javascript|wordpress|just another|coming soon|under construction|page not found|\b404\b|log ?in\b|sign ?in\b|lorem ipsum|for sale|parked|welcome to (our|my|the) (new )?(web)?site|default description|squarespace|wix\.com|shopify|this website|our website|click here|\bbuy now\b|free shipping|%%|\{\{/i;

/** Is a website's description worth showing? It must read as a sentence about the place, not boilerplate or a keyword list. */
export function usableSiteText(text: string, placeName: string): boolean {
  if (text.length < 50 || text.length > 500) return false;
  if (JUNK.test(text)) return false;
  if ((text.match(/[,|•·]/g) ?? []).length > 8) return false; // keyword lists
  if ((text.match(/[A-Z]/g) ?? []).length > text.length * 0.4) return false; // SHOUTING
  if (!/\s\S+\s\S+\s/.test(text)) return false;
  return text.toLowerCase().replace(/[^a-z]/g, "") !== placeName.toLowerCase().replace(/[^a-z]/g, "");
}

/** Drops "Book now!"-style sentences, keeping the ones that say what the place is. */
export function withoutSalesPitch(text: string): string {
  const PITCH = /^(book|reserve|buy|order|sign up|subscribe|get in touch|contact us|find (a|your)|discover more|learn more|réservez|commandez|inscrivez|boek|bestel|reserveer)\b|\b(book (your|now|online|tickets)|réservez (vos|votre|dès|maintenant)|en ligne maintenant)\b/i;
  const parts = text.split(/(?<=[.!?])\s+/);
  const kept = parts.filter((p) => !PITCH.test(p.trim()));
  return (kept.length ? kept : parts).join(" ").trim();
}

async function siteDescription(url: string, name: string): Promise<PlaceDescription | null> {
  if (/facebook\.com|instagram\.com|linktr\.ee|google\.[a-z.]+\/maps/i.test(url)) return null;
  try {
    const res = await fetchWithTimeout(url, 7000, { headers: { Accept: "text/html", "Accept-Language": "en,fr;q=0.8,nl;q=0.7" } });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    // A site that now redirects to another business (a rebrand, a parked domain) isn't this place's.
    const host = (u: string) => new URL(u).hostname.replace(/^www\./, "");
    if (res.url && host(res.url) !== host(url)) return null;
    const meta = metaDescription((await res.text()).slice(0, 300_000));
    if (!meta) return null;
    const text = withoutSalesPitch(meta.text);
    if (!usableSiteText(text, name)) return null;
    return { text: firstSentences(text, 320), lang: meta.lang, source: "website", url: res.url || url };
  } catch {
    return null;
  }
}

async function wikiDescription(a: Activity): Promise<PlaceDescription | null> {
  if (!a.wiki || (!a.wiki.wikipedia && !a.wiki.wikidata)) return null;
  try {
    const media = await loadPlaceMedia(a.wiki, ["en"]);
    const t = media.text;
    // English, or one of Belgium's languages; an article only in, say, German isn't much use here.
    if (!t || t.text.length < 40 || !["en", "fr", "nl"].includes(t.lang)) return null;
    return { text: firstSentences(t.text, 600), lang: t.lang, source: "wikipedia", url: t.url, title: t.title };
  } catch {
    return null;
  }
}

/**
 * Gives places a real description where one exists. Wikipedia comes first; the venue's website is
 * used otherwise. A website text used by several places (a chain, or a web agency's template) is dropped.
 */
export async function withDescriptions(places: Activity[]): Promise<{ places: Activity[]; wikipedia: number; website: number }> {
  const found = await pool(places, 10, async (a) => {
    if (a.description) return a.description;
    if (a.category === "chaincafe") return null;
    return (await wikiDescription(a)) ?? (a.website ? await siteDescription(a.website, a.name) : null);
  });
  const seen = new Map<string, number>();
  for (const d of found) if (d?.source === "website") seen.set(d.text, (seen.get(d.text) ?? 0) + 1);
  let wikipedia = 0;
  let website = 0;
  const out = places.map((a, i) => {
    const d = found[i];
    if (!d || (d.source === "website" && (seen.get(d.text) ?? 0) > 1)) return a;
    if (d.source === "wikipedia") wikipedia++;
    else website++;
    // Cards lead with the real description; the place's own OSM description, if any, still wins.
    const generic = blurbFor(a.typeLabel ?? "") ?? `${a.typeLabel}.`;
    const ownWords = a.summary && !a.summary.startsWith(generic);
    return { ...a, description: d, summary: ownWords ? a.summary : firstSentences(d.text, 170) };
  });
  return { places: out, wikipedia, website };
}

// ---- Blurred photo placeholders -------------------------------------------------------------------

/** A ~12px-wide WebP of the photo as a data URL (a couple of hundred bytes), or undefined. */
async function blurFor(photo: string): Promise<string | undefined> {
  // The card size, which Wikimedia has usually made already, so it comes back quickly.
  const small = directThumb(photo, 330);
  if (!small) return undefined;
  try {
    let res = await fetchWithTimeout(small, 10000);
    // Wikimedia slows down busy callers; wait and try once more.
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 3000));
      res = await fetchWithTimeout(small, 10000);
    }
    if (!res.ok) return undefined;
    const { default: sharp } = await import("sharp");
    const buf = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(12, 12, { fit: "inside" })
      .webp({ quality: 40 })
      .toBuffer();
    return `data:image/webp;base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/**
 * Adds blurred previews. Wikimedia limits how fast images can be fetched, so previews made in
 * earlier weeks are reused (`known`, by photo address) and new ones are fetched one at a time
 * until `budgetMs` runs out; the rest are picked up in the following weeks.
 */
export async function withPhotoBlurs(places: Activity[], known: Map<string, string> = new Map(), budgetMs = 45_000): Promise<{ places: Activity[]; blurred: number }> {
  const stop = Date.now() + budgetMs;
  const blurs = await pool(places, 1, async (a) => {
    const photo = a.photos?.[0];
    if (!photo) return undefined;
    if (a.photoBlur) return a.photoBlur;
    if (known.has(photo)) return known.get(photo);
    if (Date.now() > stop) return undefined;
    return blurFor(photo);
  });
  let blurred = 0;
  const out = places.map((a, i) => {
    if (!blurs[i]) return a;
    blurred++;
    return { ...a, photoBlur: blurs[i] };
  });
  return { places: out, blurred };
}
