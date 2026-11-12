/**
 * Places from Overture Maps (https://overturemaps.org), merged into the weekly city files.
 *
 * Overture combines listings from Meta, Microsoft, Foursquare and others, so it knows many cafés,
 * galleries and shops that OpenStreetMap hasn't recorded yet, and often their website and social
 * pages. It is open data (CDLA Permissive 2.0 / Apache 2.0) with no OpenStreetMap content.
 *
 * Only what Overture records is used. It has no opening hours, prices or reviews, so none are shown.
 * New places are added only when they look real and open: a high confidence score, no "closed"
 * status, a source other than a company register, and a website, social page or phone number.
 * Chains aren't added; they are easy to find already and would crowd out the independents.
 */
import { blurbFor, introSentence } from "./blurbs";
import { CAT } from "./categories";
import { distanceKm } from "./geo";
import { isListedChain, plainName } from "./osm";
import { editDistance } from "./search";
import type { Activity, CategoryId, Tag } from "./types";

/** One place as scripts/overture_places.py saves it. */
export interface OverturePlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  primary: string;
  hierarchy: string[];
  confidence: number;
  status?: string | null;
  websites: string[];
  socials: string[];
  phones: string[];
  brand?: string | null;
  /** Set when the brand is a known company on Wikidata, i.e. a real chain */
  brandWikidata?: string | null;
  street?: string | null;
  locality?: string | null;
  postcode?: string | null;
  country?: string | null;
  datasets: string[];
}

/** Overture category to the app's category, the label shown, and the OSM tag used for chain lookups. */
const MAP: Record<string, { category: CategoryId; typeLabel: string; osm?: [string, string] }> = {
  cafe: { category: "indiecafe", typeLabel: "Independent café", osm: ["amenity", "cafe"] },
  coffee_shop: { category: "indiecafe", typeLabel: "Independent café", osm: ["amenity", "cafe"] },
  tea_room: { category: "indiecafe", typeLabel: "Independent café", osm: ["amenity", "cafe"] },
  coffee_roastery: { category: "indiecafe", typeLabel: "Independent café", osm: ["amenity", "cafe"] },
  cat_cafe: { category: "indiecafe", typeLabel: "Independent café", osm: ["amenity", "cafe"] },
  board_game_cafe: { category: "boardgame", typeLabel: "Board-game café", osm: ["amenity", "cafe"] },
  art_gallery: { category: "art", typeLabel: "Gallery", osm: ["tourism", "gallery"] },
  museum: { category: "museum", typeLabel: "Museum", osm: ["tourism", "museum"] },
  art_museum: { category: "museum", typeLabel: "Museum", osm: ["tourism", "museum"] },
  history_museum: { category: "museum", typeLabel: "Museum", osm: ["tourism", "museum"] },
  science_museum: { category: "museum", typeLabel: "Museum", osm: ["tourism", "museum"] },
  contemporary_art_museum: { category: "museum", typeLabel: "Museum", osm: ["tourism", "museum"] },
  modern_art_museum: { category: "museum", typeLabel: "Museum", osm: ["tourism", "museum"] },
  textile_museum: { category: "museum", typeLabel: "Museum", osm: ["tourism", "museum"] },
  community_museum: { category: "museum", typeLabel: "Museum", osm: ["tourism", "museum"] },
  childrens_museum: { category: "museum", typeLabel: "Museum", osm: ["tourism", "museum"] },
  aviation_museum: { category: "museum", typeLabel: "Museum", osm: ["tourism", "museum"] },
  natural_history_museum: { category: "museum", typeLabel: "Museum", osm: ["tourism", "museum"] },
  military_museum: { category: "museum", typeLabel: "Museum", osm: ["tourism", "museum"] },
  design_museum: { category: "museum", typeLabel: "Museum", osm: ["tourism", "museum"] },
  photography_museum: { category: "museum", typeLabel: "Museum", osm: ["tourism", "museum"] },
  planetarium: { category: "museum", typeLabel: "Planetarium" },
  movie_theater: { category: "cinema", typeLabel: "Independent cinema", osm: ["amenity", "cinema"] },
  theatre_venue: { category: "live", typeLabel: "Theatre", osm: ["amenity", "theatre"] },
  performing_arts_venue: { category: "live", typeLabel: "Theatre", osm: ["amenity", "theatre"] },
  music_venue: { category: "live", typeLabel: "Music venue" },
  comedy_club: { category: "live", typeLabel: "Comedy club" },
  escape_room: { category: "escape", typeLabel: "Escape room", osm: ["leisure", "escape_game"] },
  bowling_alley: { category: "bowling", typeLabel: "Bowling alley", osm: ["leisure", "bowling_alley"] },
  arcade: { category: "arcade", typeLabel: "Arcade", osm: ["leisure", "amusement_arcade"] },
  rock_climbing_gym: { category: "climbing", typeLabel: "Climbing", osm: ["leisure", "sports_centre"] },
  climbing_gym: { category: "climbing", typeLabel: "Climbing", osm: ["leisure", "sports_centre"] },
  bouldering_gym: { category: "climbing", typeLabel: "Climbing", osm: ["leisure", "sports_centre"] },
  miniature_golf_course: { category: "golf", typeLabel: "Mini golf", osm: ["leisure", "miniature_golf"] },
  swimming_pool: { category: "swim", typeLabel: "Swimming pool", osm: ["leisure", "swimming_pool"] },
  amusement_park: { category: "themepark", typeLabel: "Theme park", osm: ["tourism", "theme_park"] },
  water_park: { category: "water", typeLabel: "Water park", osm: ["leisure", "water_park"] },
  zoo: { category: "zoo", typeLabel: "Zoo", osm: ["tourism", "zoo"] },
  petting_zoo: { category: "zoo", typeLabel: "Zoo", osm: ["tourism", "zoo"] },
  aquarium: { category: "zoo", typeLabel: "Aquarium", osm: ["tourism", "aquarium"] },
  ice_skating_rink: { category: "icerink", typeLabel: "Ice rink", osm: ["leisure", "ice_rink"] },
  karaoke_venue: { category: "karaoke", typeLabel: "Karaoke", osm: ["amenity", "karaoke_box"] },
  indoor_playcenter: { category: "softplay", typeLabel: "Indoor play centre", osm: ["leisure", "indoor_play"] },
  trampoline_park: { category: "trampoline", typeLabel: "Trampoline park", osm: ["leisure", "trampoline_park"] },
  second_hand_store: { category: "vintage", typeLabel: "Second-hand shop", osm: ["shop", "second_hand"] },
  second_hand_clothing_store: { category: "vintage", typeLabel: "Second-hand shop", osm: ["shop", "second_hand"] },
  thrift_store: { category: "vintage", typeLabel: "Second-hand shop", osm: ["shop", "charity"] },
  vintage_store: { category: "vintage", typeLabel: "Second-hand shop", osm: ["shop", "second_hand"] },
  antique_store: { category: "vintage", typeLabel: "Antiques shop" },
  flea_market: { category: "market", typeLabel: "Market" },
  farmers_market: { category: "market", typeLabel: "Market" },
  night_market: { category: "market", typeLabel: "Market" },
  brewery: { category: "brewery", typeLabel: "Brewery", osm: ["craft", "brewery"] },
  botanical_garden: { category: "park", typeLabel: "Garden" },
  castle: { category: "historic", typeLabel: "Castle" },
  boat_rental: { category: "boats", typeLabel: "Boat hire", osm: ["amenity", "boat_rental"] },
};

const CHAIN_LABEL: Partial<Record<CategoryId, { category: CategoryId; typeLabel: string }>> = {
  indiecafe: { category: "chaincafe", typeLabel: "Chain café" },
  cinema: { category: "cinema", typeLabel: "Cinema" },
};

/** Sources that list registered companies rather than places open to the public. */
const REGISTER_ONLY = new Set(["BrightQuery"]);

const NEW_PLACE_CONFIDENCE = 0.85;

/** "La Tourelle." → "La Tourelle"; drops names that are really a web address or phone number. */
export function cleanName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
  if (name.length < 2 || name.length > 70) return null;
  if (/https?:|www\.|\.(com|be|co\.uk|org|net|eu)\b|@/i.test(name)) return null;
  if (!/[a-zà-ÿ]/i.test(name) || /^\+?[\d\s/().-]+$/.test(name)) return null;
  return name;
}

/** "Av. d'Itterbeek 201" or "201 Cheltenham Road" → the street without its house number. */
export function streetOnly(freeform?: string | null): string | undefined {
  if (!freeform) return undefined;
  const s = freeform
    .split(",")[0]
    .replace(/^\d+[a-z]?(-\d+[a-z]?)?\s+/i, "")
    .replace(/\s+\d+[a-z]?(\s*[-/]\s*\d+[a-z]?)?$/i, "")
    .trim();
  return /[a-z]{3}/i.test(s) ? s : undefined;
}

function socialLinks(urls: string[]): Activity["links"] {
  const links: NonNullable<Activity["links"]> = {};
  for (const u of urls) {
    if (!links.instagram && /instagram\.com\//i.test(u)) links.instagram = u.replace(/^http:/, "https:");
    if (!links.facebook && /facebook\.com\//i.test(u)) links.facebook = u.replace(/^http:/, "https:");
  }
  return Object.keys(links).length ? links : undefined;
}

const website = (o: OverturePlace) => o.websites.find((w) => /^https?:\/\//i.test(w) && !/facebook\.com|instagram\.com/i.test(w));

/** Shops in petrol stations and supermarkets that Overture files as cafés. */
const NOT_A_CAFE = /\b(shop ?& ?go|carrefour|delhaize|spar|shell|esso|texaco|q8|lukoil|tesco|sainsbury'?s|morrisons|asda|m&s|ikea)\b/i;

/** A chain by the Name Suggestion Index, or by a brand Overture links to Wikidata. A bare brand name isn't enough. */
function isChain(o: OverturePlace, name: string) {
  const m = MAP[o.primary];
  return Boolean(o.brandWikidata) || (m?.osm ? isListedChain({ [m.osm[0]]: m.osm[1], name }) : false);
}

/** An Overture place as an app listing, or null when it doesn't fit a section of the app. */
export function overtureToActivity(o: OverturePlace, citySlug: string): Activity | null {
  const m = MAP[o.primary];
  const name = cleanName(o.name);
  if (!m || !name) return null;
  if (m.category === "indiecafe" && NOT_A_CAFE.test(name)) return null;
  const chain = isChain(o, name);
  const { category, typeLabel } = (chain && CHAIN_LABEL[m.category]) || m;
  const street = streetOnly(o.street);
  const first = o.street?.split(",")[0]?.trim();
  const line = [first && /[a-z]/i.test(first) ? first : undefined, o.locality, o.postcode].filter(Boolean);
  const indoor = CAT[category].indoorDefault;
  const tags: Tag[] = [];
  if (indoor) tags.push("rainy");
  if (!chain && ["indiecafe", "cinema", "vintage", "boardgame", "art", "museum", "arcade"].includes(category)) tags.push("gem");
  const kind = blurbFor(typeLabel);
  const site = website(o);
  const from = o.datasets.filter((d) => !REGISTER_ONLY.has(d));
  return {
    id: `ovt-${citySlug}-${o.id}`,
    source: "overture",
    name,
    category,
    typeLabel,
    lat: o.lat,
    lng: o.lng,
    address: line.length ? line.join(", ") : undefined,
    price: null,
    indoor,
    accessible: null,
    accessNote: "Accessibility isn't recorded for this place yet. Check with the venue.",
    tags,
    hours: null,
    summary: kind ?? `${typeLabel}.`,
    about: [introSentence(name, typeLabel, street, o.locality ?? undefined), kind].filter(Boolean).join(" "),
    booking: site ? "venue" : "unknown",
    website: site,
    phone: o.phones[0],
    links: socialLinks([...o.socials, ...o.websites]),
    provenance: `Real place from Overture Maps${from.length ? `, which lists it from ${from.join(" and ")}` : ""}. Opening hours, prices and reviews aren't part of it, so we don't show them.`,
  };
}

/** Words a listing may add to or drop from a name without it being a different place. */
const FILLER = new Set(
  "cafe caffe coffee koffie bar brasserie the de le la les het l s museum musee gallery galerie shop store winkel boutique cinema theatre theater brewery brouwerij brasserie bakery bakkerij tearoom kitchen and en et co ltd bvba sprl srl brussels bruxelles brussel london".split(" "),
);

/** Are these two names the same place's name? */
export function sameName(a: string, b: string): boolean {
  const x = plainName(a).replace(/^(the|le|la|les|de|het|l) /, "");
  const y = plainName(b).replace(/^(the|le|la|les|de|het|l) /, "");
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  // "Belga" and "Café Belga" match; "Cercle" and "Cercle des Voyageurs" don't.
  if (short.length >= 4 && ` ${long} `.includes(` ${short} `)) {
    const rest = ` ${long} `.replace(` ${short} `, " ").trim().split(" ").filter(Boolean);
    if (short.includes(" ") || rest.every((w) => FILLER.has(w))) return true;
  }
  if (short.length >= 6 && editDistance(x, y, 2) <= 2) return true;
  const wx = new Set(x.split(" ").filter((w) => w.length > 2));
  const wy = new Set(y.split(" ").filter((w) => w.length > 2));
  const shared = [...wx].filter((w) => wy.has(w)).length;
  return shared >= 2 && shared / Math.min(wx.size, wy.size) >= 0.6;
}

/** Looks real, open and reachable: the bar for adding a place OpenStreetMap doesn't have. */
function addable(o: OverturePlace) {
  if (o.confidence < NEW_PLACE_CONFIDENCE || o.status === "permanently_closed" || o.status === "temporarily_closed") return false;
  if (!o.datasets.some((d) => !REGISTER_ONLY.has(d))) return false;
  return o.websites.length + o.socials.length + o.phones.length > 0;
}

export interface MergeResult {
  places: Activity[];
  added: number;
  enriched: number;
}

/**
 * Adds Overture's websites, social pages and phone numbers to the OpenStreetMap places it also
 * knows, and adds the places it knows that OpenStreetMap doesn't (up to `maxNew`, most confident
 * first). OpenStreetMap's own details are never replaced.
 */
export function mergeOverture(osm: Activity[], overture: OverturePlace[], citySlug: string, maxNew = 300): MergeResult {
  const places = osm.map((p) => ({ ...p }));
  let enriched = 0;
  const candidates: { o: OverturePlace; a: Activity }[] = [];
  const near = (a: { lat: number; lng: number }, b: { lat: number; lng: number }, km: number) =>
    Math.abs(a.lat - b.lat) < km / 100 && Math.abs(a.lng - b.lng) < km / 60 && distanceKm(a, b) <= km;

  for (const o of overture) {
    if (o.status === "permanently_closed" || o.status === "temporarily_closed") continue;
    const twin = places.find((p) => near(p, o, 0.15) && (sameName(p.fullName ?? p.name, o.name)));
    if (twin) {
      if (o.confidence < 0.6) continue;
      let changed = false;
      const site = website(o);
      if (!twin.website && site) {
        twin.website = site;
        if (twin.booking === "unknown") twin.booking = "venue";
        changed = true;
      }
      if (!twin.phone && o.phones[0]) {
        twin.phone = o.phones[0];
        changed = true;
      }
      const links = socialLinks([...o.socials, ...o.websites]);
      if (links && !twin.links) {
        twin.links = links;
        changed = true;
      }
      if (changed) enriched++;
      continue;
    }
    if (!addable(o)) continue;
    const a = overtureToActivity(o, citySlug);
    // Chains are easy to find without us, and would crowd out the independents.
    if (!a || a.category === "chaincafe" || isChain(o, a.name)) continue;
    // A listing of the same kind a few steps away is very likely the same place under another name.
    if (places.some((p) => p.category === a.category && near(p, a, 0.03))) continue;
    candidates.push({ o, a });
  }

  // Overture sometimes lists one place twice; keep the more confident record.
  candidates.sort((x, y) => y.o.confidence - x.o.confidence);
  const added: Activity[] = [];
  for (const { a } of candidates) {
    if (added.length >= maxNew) break;
    if (added.some((b) => near(a, b, 0.15) && sameName(a.name, b.name))) continue;
    added.push(a);
  }
  return { places: [...places, ...added], added: added.length, enriched };
}

/** Finds an Overture place, by its app id, in the city file that added it. */
export async function overturePlaceById(id: string, fetchJson: (path: string) => Promise<unknown>): Promise<Activity | null> {
  const m = id.match(/^ovt-([a-z-]+?)-([0-9a-f-]{36})$/);
  if (!m) return null;
  const data = (await fetchJson(`/data/cities/${m[1]}.json`)) as { places?: Activity[] } | null;
  return data?.places?.find((p) => p.id === id) ?? null;
}
