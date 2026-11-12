/**
 * Builds src/data/chain-names.json from the Name Suggestion Index (https://nsi.guide, BSD-3-Clause):
 * the names of chains and brands, by OpenStreetMap tag, that trade in Belgium, the UK or Europe-wide.
 * The app uses it to tell independents from chains when a record has no brand tag.
 *
 * Run by hand, or by the weekly city-data workflow:
 *   npm i --no-save name-suggestion-index && node scripts/build-chain-names.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nsiPath = process.argv[2] ?? require.resolve("name-suggestion-index/dist/json/nsi.json");
const { nsi } = JSON.parse(readFileSync(nsiPath, "utf8"));

// The OpenStreetMap tags the app lists (see classify in src/lib/osm.ts).
const KEYS = [
  "amenity/cafe", "amenity/cinema", "amenity/theatre", "amenity/arts_centre", "amenity/karaoke_box", "amenity/boat_rental",
  "leisure/amusement_arcade", "leisure/bowling_alley", "leisure/escape_game", "leisure/trampoline_park", "leisure/sports_centre",
  "leisure/fitness_centre", "leisure/miniature_golf", "leisure/indoor_play", "leisure/water_park", "leisure/ice_rink",
  "leisure/swimming_pool", "leisure/playground", "leisure/adult_gaming_centre",
  "shop/second_hand", "shop/charity", "shop/games", "shop/art", "shop/books",
  "tourism/museum", "tourism/gallery", "tourism/attraction", "tourism/zoo", "tourism/aquarium", "tourism/theme_park",
  "craft/brewery",
];

// Worldwide, Europe, Western and Northern Europe, the EU, and the two countries the app covers.
const WIDE = new Set(["001", "150", "155", "154", "eu", "be", "gb", "uk"]);
const covers = (loc) => {
  const inc = (loc?.include ?? []).map((x) => String(x).toLowerCase());
  return inc.some((c) => WIDE.has(c) || c.startsWith("gb-") || c.startsWith("be-") || c.startsWith("gb_") || c.startsWith("be_"));
};

const plain = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Words that don't identify a business on their own. A brand made only of these ("Coffee House",
// "Coffee Lab") is left out, so an independent that happens to share the name isn't called a chain.
const GENERIC = new Set("the and of co cafe caffe coffee tea house lab time local shop espresso juice bar roasters bakery kitchen company club shop cinema cinemas gym fitness centre center play".split(" "));
const distinctive = (p) => p.split(" ").some((w) => w.length > 2 && !GENERIC.has(w));

// Sandwich, bakery and coffee chains filed under other tags, for cafés mapped as amenity=cafe.
const CAFE_LIKE = /coffee|sandwich|bakery|breakfast|bagel|juice|donut|cake|crepe|pastry|tea/;
const extraFor = {
  "amenity/cafe": [
    ...(nsi["brands/amenity/fast_food"]?.items ?? []).filter((i) => CAFE_LIKE.test(i.tags?.cuisine ?? "")),
    ...(nsi["brands/shop/bakery"]?.items ?? []),
  ],
};

const out = {};
let total = 0;
for (const key of KEYS) {
  const cat = nsi[`brands/${key}`];
  if (!cat) continue;
  const names = new Set();
  for (const item of [...cat.items, ...(extraFor[key] ?? [])]) {
    if (!covers(item.locationSet)) continue;
    for (const n of [item.tags?.name, item.tags?.brand, item.tags?.["name:en"], item.tags?.["name:fr"], item.tags?.["name:nl"], ...(item.matchNames ?? [])]) {
      const p = n && plain(n);
      if (p && p.length >= 3 && distinctive(p)) names.add(p);
    }
  }
  if (names.size) {
    out[key] = [...names].sort();
    total += names.size;
  }
}
mkdirSync("src/data", { recursive: true });
writeFileSync("src/data/chain-names.json", JSON.stringify(out) + "\n");
console.log(`chain names: ${total} across ${Object.keys(out).length} tags`);
