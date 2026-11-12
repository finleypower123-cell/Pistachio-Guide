/**
 * Words for places that come without a description of their own.
 *
 * Two parts, kept apart on purpose:
 * - A line about the KIND of place (what an escape room is, what to expect at a market). It is
 *   written plainly, like a local guide, and never claims anything about the particular venue.
 * - Facts about the venue itself, taken only from its OpenStreetMap record: street, opening
 *   hours, cuisine, free entry, outdoor seating, step-free access. Nothing is guessed.
 */
import { dayRanges, formatRange } from "./hours";
import type { DayRanges, WeeklyHours } from "./types";

const KIND: Record<string, string> = {
  "Escape room": "A themed room where your group solves puzzles against the clock, usually in about an hour. Most are booked ahead.",
  Arcade: "Video games, pinball and coin-op machines you pay for by the go.",
  "Bowling alley": "Lanes, hired shoes and a scoreboard. Easy for groups and any age.",
  "Mini golf": "Short putting holes with obstacles. Quick to pick up and good with children.",
  "Trampoline park": "Wall-to-wall trampolines, usually booked in timed sessions.",
  Climbing: "Walls with routes graded for different levels. Shoes can usually be hired, and bouldering needs no rope.",
  "Water park": "Pools and slides. Bring swimwear and a towel.",
  "Swimming pool": "A public pool for lengths or a swim about. Session times vary through the week.",
  "Swimming centre": "A public pool for lengths or a swim about. Session times vary through the week.",
  "Leisure centre": "Sports halls, a gym or classes, usually pay-as-you-go or by membership.",
  "Board-game café": "A café with shelves of board games to play at your table.",
  "Games shop": "A shop for board games, card games and miniatures.",
  "Independent café": "A locally run café for coffee and something to eat.",
  "Chain café": "A branch of a café chain.",
  "Independent cinema": "An independent cinema. Check the listings for what's showing.",
  Cinema: "A cinema. Check the listings for what's showing.",
  Theatre: "A theatre with live performances through the season.",
  "Arts centre": "A venue for exhibitions, performances and classes.",
  Market: "A market with stalls. Days and times vary, so check before you go.",
  Museum: "A museum with permanent collections and changing exhibitions. Allow an hour or two.",
  Gallery: "A gallery showing art, usually with exhibitions that change through the year.",
  "Local attraction": "One of the local sights, worth a look if you're nearby.",
  Viewpoint: "A spot with a view out over the area.",
  Park: "A public park with open space, paths and somewhere to sit.",
  Garden: "A planted garden with paths and quiet places to sit.",
  "Charity shop": "Second-hand clothes, books and homeware, sold to raise money for a charity.",
  "Second-hand shop": "Second-hand and vintage clothes and things for the home.",
  Zoo: "Animals from around the world. Plan on a few hours.",
  Aquarium: "Tanks of fish and other sea life, all indoors.",
  "Theme park": "Rides and attractions, usually a full day out.",
  "Ice rink": "Public skating sessions on ice. Skates are usually for hire.",
  Planetarium: "Shows about space and the night sky, projected on a dome overhead.",
  Karaoke: "Private rooms or a stage for singing, usually booked by the hour.",
  "Indoor play centre": "Soft play and climbing frames for young children.",
  "Boat hire": "Rowing boats, pedalos or small boats to take out on the water.",
  "Comedy club": "Stand-up comedy nights. Check the listings for who's on.",
  "Antiques shop": "Old furniture, objects and curiosities to browse.",
  "Music venue": "Live music. Check the listings for who's playing.",
  "Nature reserve": "Protected land with walking paths and wildlife.",
  Castle: "A historic castle. Some have tours, exhibitions or grounds to walk.",
  Ruins: "The remains of a historic building.",
  Brewery: "Where beer is brewed. Some have a taproom or run tours.",
};

/** A plain line about this kind of place, or null when there is nothing useful to say. */
export function blurbFor(typeLabel: string): string | null {
  return KIND[typeLabel] ?? null;
}

const CUISINE: Record<string, string> = {
  coffee_shop: "coffee",
  cake: "cake",
  ice_cream: "ice cream",
  breakfast: "breakfast",
  brunch: "brunch",
  sandwich: "sandwiches",
  tea: "tea",
  bubble_tea: "bubble tea",
  crepe: "crêpes",
  waffle: "waffles",
  pastry: "pastries",
  bagel: "bagels",
  juice: "juices",
  donut: "doughnuts",
  vegan: "vegan food",
  vegetarian: "vegetarian food",
};

const list = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/**
 * Short facts about the venue from its OpenStreetMap tags, as a sentence or two.
 * Returns "" when the record says nothing useful.
 */
export function venueFacts(t: Record<string, string>): string {
  const out: string[] = [];
  const serves = (t.cuisine ?? "")
    .split(";")
    .map((c) => CUISINE[c.trim().toLowerCase()])
    .filter((c): c is string => Boolean(c));
  if (serves.length) out.push(`Serves ${list([...new Set(serves)].slice(0, 3))}.`);
  const extras: string[] = [];
  if (t.outdoor_seating === "yes") extras.push("outdoor seating");
  if (t.amenity === "cafe" && (t.internet_access === "wlan" || t.internet_access === "yes")) extras.push("wifi");
  if (t.wheelchair === "yes") extras.push("step-free access");
  if (extras.length) out.push(`${list(extras)[0].toUpperCase()}${list(extras).slice(1)}.`);
  if (t.fee === "no") out.push("Free to get in.");
  return out.join(" ");
}

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Open every day, 08:00 to 18:00." or "Open Tuesday to Sunday, 10:00 to 17:00." when the hours are that simple. */
export function hoursSentence(hours: WeeklyHours | null | undefined, detail?: DayRanges): string {
  if (!hours) return "";
  const order = [1, 2, 3, 4, 5, 6, 0];
  const spoken = (list: [number, number][]) => list.map((r) => formatRange(r).replace("–", " to ")).join(" and ");
  const days = order.map((d) => dayRanges(hours, d, detail));
  const sigs = days.map((d) => (d.length ? spoken(d) : ""));
  const openIdx = sigs.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
  if (!openIdx.length) return "";
  const distinct = [...new Set(openIdx.map((i) => sigs[i]))];
  if (distinct.length > 1) {
    // Open every day with one day different reads better spelled out than "see below".
    if (openIdx.length === 7 && distinct.length === 2) {
      const [x, y] = distinct;
      const countX = sigs.filter((s) => s === x).length;
      const [usual, odd] = countX === 6 ? [x, y] : countX === 1 ? [y, x] : [null, null];
      if (usual && odd) return `Open every day, ${usual}, except ${DAY[order[sigs.indexOf(odd)]]}, ${odd}.`;
    }
    return "Opening hours vary through the week; see below.";
  }
  const span = distinct[0];
  if (span === "Open 24 hours") return openIdx.length === 7 ? "Open 24 hours, every day." : `Open 24 hours on ${list(openIdx.map((i) => DAY[order[i]]))}.`;
  if (openIdx.length === 7) return `Open every day, ${span}.`;
  const first = openIdx[0];
  const last = openIdx[openIdx.length - 1];
  if (openIdx.length > 2 && last - first + 1 === openIdx.length) return `Open ${DAY[order[first]]} to ${DAY[order[last]]}, ${span}.`;
  return `Open ${list(openIdx.map((i) => DAY[order[i]]))}, ${span}.`;
}

/** "Waffelin is an independent café on Rue de la Madeleine, Brussels." */
export function introSentence(name: string, typeLabel: string, street?: string, city?: string): string {
  const kind = typeLabel.toLowerCase().replace(/^(independent|chain) cinema$/, "$1 cinema");
  const article = /^[aeiou]/i.test(kind) ? "an" : "a";
  const where = street ? ` on ${street}${city ? `, ${city}` : ""}` : city ? ` in ${city}` : "";
  return `${name} is ${article} ${kind}${where}.`;
}
