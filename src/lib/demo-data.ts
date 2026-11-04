import { offsetKm } from "./geo";
import { H } from "./hours";
import type { Activity, BookingType, CategoryId, Place, Tag, WeeklyHours } from "./types";

/**
 * DEMO DATA — every listing below is invented for this prototype.
 * They are placed around whatever location the user searches for (using the km offsets),
 * always badged "Demo" in the UI, and never given real addresses or booking links.
 * Real places come from OpenStreetMap (see lib/osm.ts) or from claimed business listings.
 */
interface Seed {
  id: string;
  name: string;
  category: CategoryId;
  /** km east / north of the search centre */
  e: number;
  n: number;
  price: number;
  priceNote?: string;
  rating: number;
  ratingCount: number;
  indoor: boolean;
  family: boolean;
  accessible: boolean;
  durationMin: number;
  group: [number, number];
  tags: Tag[];
  hours: WeeklyHours;
  ages: string;
  summary: string;
  more: string;
  special: string;
  booking: BookingType;
  sponsored?: boolean;
  deal?: string;
}

const SEEDS: Seed[] = [
  { id: "pixel-cellar", name: "The Pixel Cellar", category: "arcade", e: -0.2, n: 0.4, price: 5, priceNote: "£5 for 20 tokens", rating: 4.7, ratingCount: 212, indoor: true, family: false, accessible: false, durationMin: 90, group: [1, 8], tags: ["weird", "gem", "friends", "solo", "date"], hours: H(14, 24), ages: "18+ after 8pm", summary: "A basement arcade behind an unmarked door, packed with 80s and 90s cabinets.", more: "Ring the bell by the green door, head down the stairs and trade a fiver for a cup of tokens. Every machine has its own high-score wall.", special: "Unmarked entrance, a monthly high-score league and a pinball corner most people never find.", booking: "walkin" },
  { id: "locksmiths-lament", name: "The Locksmith's Lament", category: "escape", e: 0.1, n: -0.5, price: 22, priceNote: "per person, 2–6 players", rating: 4.8, ratingCount: 341, indoor: true, family: true, accessible: true, durationMin: 75, group: [2, 6], tags: ["weird", "date", "friends"], hours: H(11, 22), ages: "12+ (under 16s with an adult)", summary: "Escape a Victorian locksmith's workshop before the clockwork alarm goes off.", more: "Puzzles are mechanical: real locks, gears and hidden drawers instead of padlock codes. Hints arrive through an old brass speaking tube.", special: "Hand-built mechanical puzzles and a speaking-tube hint system.", booking: "partner", sponsored: true, deal: "Weekday games £18pp (demo offer)" },
  { id: "slow-clay", name: "Slow Clay Studio", category: "workshop", e: -0.9, n: -0.1, price: 28, priceNote: "per person, clay and firing included", rating: 4.9, ratingCount: 96, indoor: true, family: false, accessible: true, durationMin: 120, group: [1, 8], tags: ["date", "solo", "gem"], hours: H(10, 21, "0111111"), ages: "14+", summary: "A two-hour wheel-throwing taster. Your pot is fired and ready to collect in two weeks.", more: "Groups of eight, one wheel each, tea on the go. Most beginners make one wonky bowl and one they're secretly proud of.", special: "Small groups, your own wheel and a proper kiln firing.", booking: "partner" },
  { id: "save-point", name: "Save Point Café", category: "boardgame", e: 0, n: 0.5, price: 6, priceNote: "table fee per person, all day", rating: 4.6, ratingCount: 188, indoor: true, family: true, accessible: true, durationMin: 180, group: [1, 10], tags: ["gem", "friends", "solo"], hours: H(11, 23), ages: "All ages", summary: "A retro gaming café with consoles at every table and 600 board games on the wall.", more: "Pay one table fee and stay as long as you like. Staff will teach you anything on the shelves.", special: "Consoles from every generation and staff who teach games.", booking: "walkin" },
  { id: "tumble-works", name: "Tumble Works", category: "trampoline", e: 1.0, n: -0.9, price: 14, priceNote: "per hour", rating: 4.4, ratingCount: 420, indoor: true, family: true, accessible: true, durationMin: 60, group: [1, 20], tags: ["friends", "family"], hours: H(9, 21), ages: "5+ (toddler sessions mornings)", summary: "An old print works turned indoor adventure park: trampolines, a ninja course and foam pits.", more: "Sessions start on the hour. Grip socks are required and sold at the desk.", special: "A warehouse-sized ninja course built around the original printing presses.", booking: "partner" },
  { id: "canal-loop", name: "Towpath Lock Loop", category: "walk", e: -0.8, n: -0.5, price: 0, rating: 4.6, ratingCount: 77, indoor: false, family: true, accessible: true, durationMin: 75, group: [1, 20], tags: ["solo", "date", "gem"], hours: H(0, 24), ages: "All ages", summary: "A flat 4 km loop past narrowboats, three locks and a floating bookshop.", more: "Follow the green waymarkers. The path is paved and step-free throughout.", special: "A floating bookshop moored at the second lock most weekends.", booking: "free" },
  { id: "moss-bean", name: "Moss & Bean", category: "indiecafe", e: 0.3, n: 1.6, price: 4, priceNote: "coffee around £3–4", rating: 4.7, ratingCount: 154, indoor: true, family: true, accessible: true, durationMin: 45, group: [1, 6], tags: ["gem", "solo"], hours: H(8, 17), ages: "All ages", summary: "A plant-filled café inside a former florist, with a window seat worth arriving early for.", more: "Beans roasted in small batches on site. Laptops welcome before noon.", special: "Hundreds of plants, all for sale, and a cardamom bun people queue for.", booking: "walkin" },
  { id: "lost-umbrellas", name: "Museum of Lost Umbrellas", category: "museum", e: 0.4, n: -0.3, price: 3, priceNote: "suggested donation", rating: 4.5, ratingCount: 63, indoor: true, family: true, accessible: false, durationMin: 45, group: [1, 10], tags: ["weird", "gem"], hours: H(11, 17, "0011111"), ages: "All ages", summary: "One room, 400 umbrellas left on buses and trains, each labelled with a guess at its story.", more: "Run by volunteers in a railway arch. Bring an umbrella to donate and get in free.", special: "Donate an umbrella and entry is free.", booking: "walkin" },
  { id: "night-market", name: "Arches Night Market", category: "market", e: 0, n: -0.6, price: 0, priceNote: "free entry", rating: 4.6, ratingCount: 290, indoor: false, family: true, accessible: true, durationMin: 120, group: [1, 20], tags: ["date", "friends"], hours: H(17, 23, "0000110"), ages: "All ages", summary: "Street food, makers and a DJ under the railway arches on Friday and Saturday nights.", more: "Around 40 stalls, from dumplings to screen prints. Covered, so it runs rain or shine.", special: "Covered by the arches, so it runs whatever the weather.", booking: "free" },
  { id: "tiny-picture-house", name: "The Tiny Picture House", category: "cinema", e: 1.6, n: 1.1, price: 9, priceNote: "per ticket", rating: 4.8, ratingCount: 205, indoor: true, family: true, accessible: true, durationMin: 130, group: [1, 24], tags: ["date", "solo", "gem"], hours: H(13, 23), ages: "Varies by film", summary: "A 24-seat cinema above a bike shop showing cult classics, new indies and Sunday double bills.", more: "Sofas instead of rows, a tiny bar and an interval for tea. Fridays sell out.", special: "Only 24 seats, sofas, and an interval tea break.", booking: "partner" },
  { id: "glowhole-golf", name: "Glowhole Crazy Golf", category: "golf", e: 0.7, n: -1.1, price: 11, priceNote: "per person, 18 holes", rating: 4.5, ratingCount: 377, indoor: true, family: true, accessible: true, durationMin: 60, group: [1, 12], tags: ["date", "friends", "weird"], hours: H(10, 23), ages: "All ages", summary: "Eighteen holes of UV crazy golf through a deep-sea world, finishing inside a giant squid.", more: "Fully indoors under blacklight. Cocktails after 6pm for over-18s.", special: "The final hole is inside a glowing squid.", booking: "partner", deal: "Two-for-one before 5pm Mon–Thu (demo offer)" },
  { id: "boulder-barn", name: "Boulder Barn", category: "climbing", e: 0.6, n: 1.5, price: 13, priceNote: "day pass, shoe hire £4", rating: 4.7, ratingCount: 260, indoor: true, family: true, accessible: false, durationMin: 120, group: [1, 10], tags: ["solo", "friends"], hours: H(7, 22), ages: "8+", summary: "A converted grain barn with bouldering walls for total beginners up to strong climbers.", more: "Free intro sessions every evening at 6pm. No ropes or harness, just crash mats.", special: "Free beginner intros every evening.", booking: "partner" },
  { id: "strike-social", name: "Strike Social Lanes", category: "bowling", e: 1.9, n: -0.6, price: 8, priceNote: "per game, per person", rating: 4.3, ratingCount: 510, indoor: true, family: true, accessible: true, durationMin: 60, group: [1, 36], tags: ["friends", "family"], hours: H(10, 24), ages: "All ages", summary: "Twelve lanes with retro décor, a karaoke booth and ramps for younger bowlers.", more: "Book a lane or take your chances walking in. Karaoke booths by the hour.", special: "Lane-side karaoke booths.", booking: "partner" },
  { id: "splash-lagoon", name: "Splash Lagoon", category: "water", e: 2.2, n: -0.9, price: 18, priceNote: "adult, under-3s free", rating: 4.2, ratingCount: 640, indoor: true, family: true, accessible: true, durationMin: 180, group: [1, 30], tags: ["family", "friends"], hours: H(9, 19), ages: "All ages", summary: "An indoor water park with four slides, a wave pool and a lazy river kept at 30°C.", more: "Lockers and a changing village on site. Quieter after 3pm on weekdays.", special: "A 30°C wave pool all year round.", booking: "partner" },
  { id: "hillside-lido", name: "Hillside Lido", category: "swim", e: 1.9, n: 1.4, price: 6, priceNote: "adult swim", rating: 4.6, ratingCount: 233, indoor: false, family: true, accessible: true, durationMin: 60, group: [1, 10], tags: ["solo", "date"], hours: H(7, 20), ages: "All ages", summary: "A heated 1930s outdoor lido with a sun terrace and a café overlooking the water.", more: "Heated to 25°C year round. Steam rises off the pool on cold mornings.", special: "Swimming outside in winter with steam coming off the water.", booking: "partner" },
  { id: "physic-garden", name: "The Walled Physic Garden", category: "park", e: 2.2, n: 1.0, price: 0, rating: 4.7, ratingCount: 89, indoor: false, family: true, accessible: true, durationMin: 60, group: [1, 20], tags: ["gem", "solo", "date"], hours: H(9, 17), ages: "All ages", summary: "A walled garden of medicinal plants with a pond, benches and a sundial ten minutes slow.", more: "Volunteer guides run free tours on the first Sunday of each month.", special: "Free first-Sunday tours and a famously slow sundial.", booking: "free" },
  { id: "rewind-rummage", name: "Rewind & Rummage", category: "vintage", e: -0.4, n: 0.1, price: 0, priceNote: "free to browse", rating: 4.4, ratingCount: 120, indoor: true, family: true, accessible: false, durationMin: 45, group: [1, 6], tags: ["gem", "solo", "friends"], hours: H(10, 18), ages: "All ages", summary: "Three floors of vintage clothes sold by weight, with a £1 rail at the very top.", more: "New stock every Thursday. The fitting rooms are old phone boxes.", special: "Clothes priced by the kilo and phone-box fitting rooms.", booking: "free" },
  { id: "fold-pleat", name: "Fold & Pleat Dumpling Supper", category: "food", e: -0.1, n: -0.1, price: 35, priceNote: "per person, dinner included", rating: 4.9, ratingCount: 74, indoor: true, family: false, accessible: true, durationMin: 150, group: [2, 12], tags: ["date", "friends"], hours: H(18, 22, "0001110"), ages: "16+", summary: "Fold four kinds of dumplings, then sit down and eat them all at one long table.", more: "Ingredients, aprons and a tea flight included. Vegetarian and vegan versions on request.", special: "You eat everything you make at a shared supper table.", booking: "partner" },
  { id: "lantern-open-mic", name: "Lantern Open Mic", category: "live", e: -1.7, n: -0.8, price: 0, priceNote: "free, drinks extra", rating: 4.4, ratingCount: 58, indoor: true, family: false, accessible: false, durationMin: 120, group: [1, 10], tags: ["solo", "weird", "friends", "gem"], hours: H(20, 24, "0110000"), ages: "18+", summary: "A candle-lit open mic in a former rope store: poetry, songs and the odd magician.", more: "Sign-up opens at 7.30pm. Five minutes each, no heckling.", special: "Anyone can play, and the line-up is never the same twice.", booking: "free" },
  { id: "riso-drop-in", name: "Riso Print Drop-in", category: "art", e: -1.6, n: -1.1, price: 15, priceNote: "per session, paper included", rating: 4.8, ratingCount: 41, indoor: true, family: true, accessible: true, durationMin: 90, group: [1, 8], tags: ["solo", "date", "gem"], hours: H(11, 18, "0000111"), ages: "10+", summary: "Design a two-colour poster and print it on a vintage risograph machine.", more: "No experience needed. You leave with ten prints of your own design.", special: "You leave with ten prints of your own design.", booking: "partner" },
  { id: "mural-trail", name: "Warehouse Mural Trail", category: "walk", e: -1.9, n: -0.6, price: 0, rating: 4.5, ratingCount: 102, indoor: false, family: true, accessible: true, durationMin: 60, group: [1, 20], tags: ["solo", "friends", "date"], hours: H(0, 24), ages: "All ages", summary: "A self-guided trail past 22 murals on old warehouse walls.", more: "Each mural has a plaque with the artist's story.", special: "Twenty-two murals in under two kilometres.", booking: "free" },
  { id: "board-meeting", name: "The Board Meeting", category: "boardgame", e: -0.7, n: 0.1, price: 5, priceNote: "table fee per person", rating: 4.5, ratingCount: 140, indoor: true, family: true, accessible: true, durationMin: 150, group: [2, 12], tags: ["friends", "date"], hours: H(12, 23), ages: "All ages", summary: "A quiet board-game café with big tables, good toasties and a games-for-two shelf.", more: "Booking recommended for groups of six or more.", special: "A whole shelf of games built for two players.", booking: "partner" },
  { id: "orbit-coffee", name: "Orbit Coffee Co.", category: "chaincafe", e: 0.2, n: 0.1, price: 3, priceNote: "coffee from £2.80", rating: 4.0, ratingCount: 830, indoor: true, family: true, accessible: true, durationMin: 30, group: [1, 6], tags: ["solo"], hours: H(7, 19), ages: "All ages", summary: "A dependable chain café with big tables, plugs and free filter refills.", more: "A fictional demo chain: good for a quick, predictable stop between plans.", special: "Plug sockets at every table and free filter refills.", booking: "walkin" },
  { id: "glasshouse-sound-bath", name: "Glasshouse Sound Bath", category: "live", e: 1.7, n: 0.8, price: 12, priceNote: "per person, mats provided", rating: 4.6, ratingCount: 67, indoor: true, family: false, accessible: true, durationMin: 60, group: [1, 20], tags: ["solo", "date", "weird"], hours: H(19, 21, "1010100"), ages: "16+", summary: "Lie under a Victorian glasshouse while gongs and singing bowls wash over you.", more: "Sessions run at dusk. Bring a blanket on cold evenings.", special: "Gongs under glass at sunset.", booking: "partner" },
  { id: "paper-moon", name: "Paper Moon Shadow Theatre", category: "live", e: -1.1, n: -0.4, price: 10, priceNote: "adult, children £6", rating: 4.7, ratingCount: 85, indoor: true, family: true, accessible: true, durationMin: 50, group: [1, 40], tags: ["family", "weird", "gem"], hours: H(11, 17, "0000011"), ages: "4+", summary: "A tiny shadow-puppet theatre on a narrowboat, with weekend shows for kids and adults.", more: "Forty seats on cushions. After the show you can try the puppets yourself.", special: "A theatre on a narrowboat, and you can try the puppets afterwards.", booking: "partner" },
  { id: "cellar-cheese", name: "Cellar Cheese Tasting", category: "food", e: 1.1, n: -1.2, price: 19, priceNote: "per person, six cheeses", rating: 4.8, ratingCount: 112, indoor: true, family: false, accessible: false, durationMin: 60, group: [2, 10], tags: ["date", "gem"], hours: H(17, 22, "0011111"), ages: "18+", summary: "A guided cheese tasting in a cool brick cellar under a deli, paired with local cider.", more: "Six cheeses, three ciders or juices, and a cheesemonger who loves questions.", special: "A working maturing cellar under the street.", booking: "partner", deal: "£4 off for two before 7pm (demo offer)" },
  { id: "kite-hill", name: "Kite Hill Meadow", category: "park", e: 2.4, n: 1.6, price: 0, rating: 4.8, ratingCount: 196, indoor: false, family: true, accessible: false, durationMin: 90, group: [1, 30], tags: ["date", "family", "solo"], hours: H(0, 24), ages: "All ages", summary: "A hilltop meadow for kites, picnics and the best free sunset around.", more: "The climb is steep but short. Kite flyers gather on windy Sunday mornings.", special: "The best free sunset in town.", booking: "free" },
  { id: "silent-disco-walk", name: "Silent Disco Walking Tour", category: "live", e: -0.1, n: -0.4, price: 16, priceNote: "per person, headphones included", rating: 4.6, ratingCount: 150, indoor: false, family: true, accessible: true, durationMin: 90, group: [1, 25], tags: ["weird", "friends", "date"], hours: H(14, 21, "0000111"), ages: "8+", summary: "A guided walk where everyone dances through the streets to the same headphone playlist.", more: "Expect strangers to stare and then join in.", special: "You dance down the high street, and strangers join in.", booking: "partner" },
  { id: "pocket-terrarium", name: "Pocket Terrarium Workshop", category: "workshop", e: 0.1, n: 1.3, price: 24, priceNote: "per person, jar and plants included", rating: 4.7, ratingCount: 58, indoor: true, family: true, accessible: true, durationMin: 90, group: [1, 10], tags: ["solo", "date", "gem"], hours: H(11, 17, "0000011"), ages: "8+", summary: "Build a tiny sealed world in a jar with moss, ferns and tiny figurines.", more: "Everything provided. Your terrarium goes home with you on the day.", special: "You take a living mini-world home the same day.", booking: "partner" },
  { id: "clatter-typewriters", name: "Clatter: Typewriter Museum", category: "museum", e: -0.5, n: 0.3, price: 0, priceNote: "free", rating: 4.6, ratingCount: 71, indoor: true, family: true, accessible: true, durationMin: 40, group: [1, 10], tags: ["weird", "gem", "solo"], hours: H(10, 16, "0111110"), ages: "All ages", summary: "A room of 150 typewriters, and you're encouraged to type on all of them.", more: "Leave a letter in the outbox and a volunteer posts a reply.", special: "Leave a typed letter and someone writes back.", booking: "free" },
  { id: "community-pool", name: "Northside Community Pool", category: "swim", e: 0.4, n: 1.8, price: 5, priceNote: "adult swim", rating: 4.1, ratingCount: 300, indoor: true, family: true, accessible: true, durationMin: 60, group: [1, 10], tags: ["family", "solo"], hours: H(6, 21), ages: "All ages", summary: "A friendly community pool with lane swims, weekend inflatable sessions and a pool hoist.", more: "Inflatable sessions on Saturday afternoons.", special: "Giant inflatable obstacle sessions on Saturdays.", booking: "venue" },
  { id: "midnight-diner", name: "Midnight Diner Mystery", category: "escape", e: -1.4, n: -0.4, price: 19, priceNote: "per person, 3–8 players", rating: 4.6, ratingCount: 198, indoor: true, family: true, accessible: true, durationMin: 60, group: [3, 8], tags: ["weird", "friends"], hours: H(12, 23), ages: "12+", summary: "Solve a murder in a 1950s diner where every jukebox song is a clue.", more: "Bigger rooms suit groups of up to eight. Free milkshakes if you escape in under 45 minutes.", special: "A working jukebox that hides the clues.", booking: "partner" },
];

/** Demo listings positioned around the given place. Always source "demo". */
export function demoActivities(center: Place): Activity[] {
  return SEEDS.map((s) => {
    const { lat, lng } = offsetKm(center, s.e, s.n);
    const tags = [...s.tags];
    if (s.indoor && !tags.includes("rainy")) tags.push("rainy");
    if (s.family && !tags.includes("family")) tags.push("family");
    return {
      id: s.id,
      source: "demo",
      name: s.name,
      category: s.category,
      lat,
      lng,
      price: s.price,
      priceNote: s.priceNote,
      rating: s.rating,
      ratingCount: s.ratingCount,
      indoor: s.indoor,
      family: s.family,
      accessible: s.accessible,
      durationMin: s.durationMin,
      groupMin: s.group[0],
      groupMax: s.group[1],
      tags,
      hours: s.hours,
      ages: s.ages,
      summary: s.summary,
      about: `${s.summary} ${s.more}`,
      special: s.special,
      accessNote: s.accessible
        ? "Step-free entrance and accessible toilet (sample information)."
        : "Reached by stairs, no step-free access (sample information).",
      booking: s.booking,
      sponsored: s.sponsored,
      deal: s.deal,
      provenance: "Sample listing written for the Pistachio Guide demo. It isn't a real venue.",
    } satisfies Activity;
  });
}

export const DEMO_IDS = new Set(SEEDS.map((s) => s.id));

/** Illustrative reviews for demo listings only — labelled as samples wherever shown. */
const REVIEW_POOL = [
  { who: "Sample reviewer A", stars: 5, text: "Exactly the kind of place I never knew was here. Went back the next week." },
  { who: "Sample reviewer B", stars: 4, text: "Great fun, a bit busy on Saturday. Go early." },
  { who: "Sample reviewer C", stars: 5, text: "Friendly staff and a really relaxed vibe. Perfect for a rainy afternoon." },
  { who: "Sample reviewer D", stars: 4, text: "Good value for what you get. Would bring friends next time." },
  { who: "Sample reviewer E", stars: 5, text: "Brilliant for a date. We stayed much longer than planned." },
];

export function sampleReviews(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return [0, 1, 2].map((i) => REVIEW_POOL[(h + i * 2) % REVIEW_POOL.length]);
}
