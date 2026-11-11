import { createHash } from "node:crypto";
import { directThumb, md5 } from "../src/lib/wiki";
import assert from "node:assert/strict";
import { parseOsmHours, isOpenAt } from "../src/lib/hours";
import { elementToActivity, buildAroundQuery, elementsToPlaces } from "../src/lib/osm";
import { loadNearbyPlaces, loadPlaceById, timing } from "../src/lib/discover";
import { blurbFor } from "../src/lib/blurbs";
import { PHOTON_GROUPS, photonPacing, photonToElement } from "../src/lib/places-fallback";
import { parseQuery, applyFilters, defaultFilters, loadRangeKm, editDistance, fixTypos, matchesText, relaxFilters } from "../src/lib/search";
import { demoActivities } from "../src/lib/demo-data";
import {
  commonsThumb, isPhotoFile, loadAreaPhotos, loadPlaceMedia, matchStrength, matchPlacesToItems, nameVariants, plainText, thumbSrcSet, wikiRefFromTags, withAreaPhotos,
  type WikiItem,
} from "../src/lib/wiki";
import type { Activity } from "../src/lib/types";

// Hours
const h = parseOsmHours("Mo-Fr 08:00-18:00; Sa 09:00-17:00; Su off")!;
assert.deepEqual(h[1], [8, 18]);
assert.deepEqual(h[6], [9, 17]);
assert.equal(h[0], null);
assert.deepEqual(parseOsmHours("24/7")![3], [0, 24]);
assert.deepEqual(parseOsmHours("Fr-Sa 18:00-02:00")![5], [18, 26]);
assert.equal(isOpenAt(parseOsmHours("Fr-Sa 18:00-02:00"), 1, 6), true); // Sat 1am, carried over from Fri
assert.equal(parseOsmHours("sunrise-sunset"), null);
assert.deepEqual(parseOsmHours("Mo-Fr 08:00-12:00,13:00-17:00")![2], [8, 17]);

// OSM mapping
const indie = elementToActivity({ type: "node", id: 1, lat: 51.5, lon: -0.1, tags: { amenity: "cafe", name: "Bean There", opening_hours: "Mo-Su 08:00-17:00", wheelchair: "yes" } })!;
assert.equal(indie.category, "indiecafe");
assert.equal(indie.price, null, "no invented price");
assert.equal(indie.rating, undefined, "no invented rating");
assert.equal(indie.accessible, true);
assert.ok(indie.tags.includes("gem"));
const chain = elementToActivity({ type: "node", id: 2, lat: 51.5, lon: -0.1, tags: { amenity: "cafe", name: "Costa", brand: "Costa Coffee" } })!;
assert.equal(chain.category, "chaincafe");
const park = elementToActivity({ type: "way", id: 3, center: { lat: 51.5, lon: -0.1 }, tags: { leisure: "park", name: "Victoria Park" } })!;
assert.equal(park.price, 0);
assert.equal(park.booking, "free");
const pool = elementToActivity({ type: "way", id: 4, center: { lat: 51.5, lon: -0.1 }, tags: { leisure: "sports_centre", sport: "swimming", name: "Aquatics" } })!;
assert.equal(pool.category, "swim");
assert.equal(elementToActivity({ type: "node", id: 5, lat: 1, lon: 1, tags: { amenity: "cafe" } }), null, "unnamed skipped");
assert.ok(buildAroundQuery(51.5, -0.1, 2000).includes("around:2000"));

// Natural language
const p1 = parseQuery("Something fun to do for under £15");
assert.equal(p1.filters.maxPrice, 15);
const p2 = parseQuery("A weird date idea near me");
assert.deepEqual(p2.filters.tags?.sort(), ["date", "weird"]);
assert.equal(p2.filters.maxDistKm, 1.5);
assert.equal(parseQuery("Somewhere to go when it's raining").filters.setting, "indoor");
assert.equal(parseQuery("A fun activity for a group of six").filters.group, 6);
const p5 = parseQuery("Free things to do this afternoon");
assert.equal(p5.filters.price, "free");
assert.equal(p5.filters.openAt, "afternoon");
const p6 = parseQuery("A quirky café within walking distance");
assert.ok(p6.filters.categories?.includes("indiecafe"));
assert.equal(p6.filters.maxDistKm, 1.5);

// Every example query returns at least one demo result around London
const center = { label: "London", lat: 51.5145, lng: -0.0875 };
const all = demoActivities(center);
for (const q of ["Something fun to do for under £15", "A weird date idea near me", "Somewhere to go when it's raining", "A fun activity for a group of six", "Free things to do this afternoon", "A quirky café within walking distance"]) {
  const res = applyFilters(all, { ...defaultFilters(), ...parseQuery(q).filters, openAt: "any" }, center);
  assert.ok(res.length > 0, `no results for "${q}"`);
  console.log(`${res.length.toString().padStart(2)} results  ${q}`);
}

// Duplicates of the same name and category collapse to one place
const cafeEl = (id: number) => ({ type: "node" as const, id, lat: 50.85, lon: 4.35, tags: { amenity: "cafe", name: "Bean There" } });
assert.equal(elementsToPlaces([cafeEl(1), cafeEl(2)]).length, 1);

// Chains are recognised by name when the record has no brand tag
assert.equal(elementToActivity({ type: "node", id: 6, lat: 1, lon: 1, tags: { amenity: "cafe", name: "Starbucks" } })!.category, "chaincafe");
assert.equal(elementToActivity({ type: "node", id: 6, lat: 1, lon: 1, tags: { amenity: "cafe", name: "Paul's Corner" } })!.category, "indiecafe");

// Photon results map onto the same OSM categories
const photonCafe = (id: number, name = "Aksum") => ({
  geometry: { coordinates: [4.3552, 50.8479] as [number, number] },
  properties: { osm_id: id, osm_type: "N", osm_key: "amenity", osm_value: "cafe", name, street: "Galerie du Roi", city: "Bruxelles", postcode: "1000" },
});
const pe = photonToElement(photonCafe(11))!;
assert.equal(pe.type, "node");
assert.equal(pe.lat, 50.8479);
assert.equal(elementToActivity(pe)!.address, "Galerie du Roi, Bruxelles, 1000");
assert.equal(photonToElement({ properties: { osm_id: 1, osm_type: "N", osm_key: "amenity", osm_value: "cafe" } }), null, "unnamed skipped");

// ---- search that copes with typos, accents and other wording ----
{
  const mk = (id: number, tags: Record<string, string>, dLat = 0) => elementToActivity({ type: "node", id, lat: 50.85 + dLat, lon: 4.35, tags })!;
  const real = [
    mk(1, { tourism: "museum", name: "Musée Magritte" }),
    mk(2, { amenity: "cafe", name: "Café Parc Royal" }, 0.001),
    mk(3, { amenity: "cafe", name: "Kaffabar" }, 0.002),
    mk(4, { amenity: "cafe", name: "Bean There" }, 0.003),
    mk(5, { leisure: "escape_game", name: "Quest Room" }, 0.02),
    mk(6, { leisure: "park", name: "Parc de Bruxelles" }, 0.004),
  ];
  const centre = { label: "x", lat: 50.85, lng: 4.35 };
  const run = (q: string) => applyFilters(real, { ...defaultFilters(), ...parseQuery(q, real).filters }, centre);

  assert.equal(editDistance("musuem", "museum"), 1, "a swap of neighbouring letters is one edit");
  assert.equal(editDistance("cofee", "coffee"), 1);
  assert.equal(fixTypos("Musuem near me"), "museum near me");
  assert.equal(fixTypos("art"), "art", "short words are never changed");

  assert.deepEqual(run("musuem").map((a) => a.id), ["osm-node-1"], "typo fixed");
  assert.equal(parseQuery("musuem").corrected, "museum", "read as the category when no loaded place matches the text");
  assert.deepEqual(parseQuery("cofee shop").filters.categories, ["indiecafe", "boardgame", "chaincafe"]);
  assert.deepEqual(run("musée").map((a) => a.id), ["osm-node-1"], "accents and French understood");
  assert.equal(run("cofee").length, 3);
  assert.equal(run("zwembad").length, 0, "understood as swimming; none loaded");
  assert.deepEqual(parseQuery("zwembad", real).filters.categories, ["swim"]);

  // A real place name wins over a "correction", with or without accents and small slips
  assert.deepEqual(run("Kaffabar").map((a) => a.id), ["osm-node-3"]);
  assert.equal(parseQuery("Kaffabar", real).corrected, undefined);
  assert.deepEqual(run("magrite").map((a) => a.id), ["osm-node-1"], "typo in a name");
  assert.ok(matchesText(real[0], "musee magritte"));
  assert.ok(!matchesText(real[0], "louvre"));

  // "Something unusual" works for real places through the kind of place
  assert.deepEqual(run("something weird").map((a) => a.id), ["osm-node-5"]);

  // Filters with no data behind them are set aside and named, not allowed to empty the list
  const kids = { ...defaultFilters(), ...parseQuery("something fun for kids under £10", real).filters };
  assert.equal(applyFilters(real, kids, centre).length, 0);
  const relaxed = relaxFilters(kids, real);
  assert.deepEqual(relaxed.ignored, ["family-friendly", "prices"]);
  assert.equal(applyFilters(real, relaxed.filters, centre).length, real.length);
  assert.deepEqual(relaxFilters({ ...defaultFilters(), setting: "indoor" }, real).ignored, [], "filters with data are kept");
  assert.deepEqual(relaxFilters(kids, []).ignored, [], "nothing is dropped before places have loaded");

  // Best match mixes kinds of place: the three cafés don't take the first three slots
  const best = applyFilters(real, defaultFilters(), centre).map((a) => a.category);
  assert.ok(new Set(best.slice(0, 3)).size >= 2, "top of the list is mixed: " + best.join(","));
}

// ---- kinds of place worked out from names when the record is basic ----
{
  const sc = (name: string, extra: Record<string, string> = {}) => elementToActivity({ type: "node", id: 77, lat: 1, lon: 1, tags: { leisure: "sports_centre", name, ...extra } })!;
  assert.equal(sc("Piscine communale d'Ixelles").category, "swim");
  assert.equal(sc("Zwembad Neptunus").category, "swim");
  assert.equal(sc("Petite Île Escalade").category, "climbing");
  assert.equal(sc("Basic-Fit").category, "leisure");
  assert.equal(sc("Aqua Centre", { sport: "swimming" }).category, "swim", "the sport tag still decides when present");
  // A games shop is findable but does not count as an unusual outing or lead the list
  const shop = elementToActivity({ type: "node", id: 78, lat: 1, lon: 1, tags: { shop: "games", name: "Dice Shop" } })!;
  const esc = elementToActivity({ type: "node", id: 79, lat: 1, lon: 1, tags: { leisure: "escape_game", name: "Locked" } })!;
  const c0 = { label: "x", lat: 1, lng: 1 };
  assert.deepEqual(applyFilters([shop, esc], { ...defaultFilters(), tags: ["weird"] }, c0).map((a) => a.name), ["Locked"]);
  assert.equal(applyFilters([shop, esc], defaultFilters(), c0)[0].name, "Locked");
}

// ---- the newer kinds of place ----
{
  const el = (tags: Record<string, string>) => elementToActivity({ type: "node", id: 90, lat: 1, lon: 1, tags: { name: "X", ...tags } })!;
  const kinds: [Record<string, string>, string, string][] = [
    [{ tourism: "zoo" }, "zoo", "Zoo"], [{ tourism: "aquarium" }, "zoo", "Aquarium"], [{ tourism: "theme_park" }, "themepark", "Theme park"],
    [{ leisure: "ice_rink" }, "icerink", "Ice rink"], [{ amenity: "planetarium" }, "museum", "Planetarium"], [{ amenity: "karaoke_box" }, "karaoke", "Karaoke"],
    [{ leisure: "indoor_play" }, "softplay", "Indoor play centre"], [{ amenity: "boat_rental" }, "boats", "Boat hire"], [{ historic: "castle" }, "historic", "Castle"],
    [{ historic: "ruins" }, "historic", "Ruins"], [{ craft: "brewery" }, "brewery", "Brewery"], [{ leisure: "nature_reserve" }, "walk", "Nature reserve"],
    [{ amenity: "music_venue" }, "live", "Music venue"],
  ];
  for (const [tags, category, label] of kinds) {
    const a = el(tags);
    assert.equal(a.category, category, JSON.stringify(tags));
    assert.equal(a.typeLabel, label);
    assert.ok(blurbFor(label, a.id), `a line of copy exists for ${label}`);
    // every kind the fallback asks for is one the mapping understands
  }
  for (const tag of PHOTON_GROUPS.flat()) {
    const [k, v] = tag.split(":");
    assert.ok(el({ [k]: v }), `Photon tag ${tag} maps to a kind of place`);
  }
  assert.deepEqual(parseQuery("ice skating").filters.categories, ["icerink"]);
  assert.deepEqual(parseQuery("a castle to visit").filters.categories, ["historic"]);
  assert.deepEqual(parseQuery("karaoke with friends").filters.categories, ["karaoke"]);
  assert.deepEqual(parseQuery("zoo").filters.categories, ["zoo"]);
  assert.deepEqual(parseQuery("theme park").filters.categories, ["themepark"], "not parks and gardens as well");
  assert.deepEqual(parseQuery("a park for a picnic").filters.categories, ["park"]);
}

// ---- places with a real photo come first among otherwise equal places ----
{
  const m = (id: number, photo: boolean) => ({ ...elementToActivity({ type: "node", id, lat: 1, lon: 1, tags: { tourism: "museum", name: "M" + id } })!, ...(photo ? { photos: ["https://upload.wikimedia.org/x.jpg"] } : {}) });
  const order = applyFilters([m(1, false), m(2, true), m(3, false)], defaultFilters(), { label: "x", lat: 1, lng: 1 }).map((a) => a.name);
  assert.equal(order[0], "M2");
}

// ---- photos fetched straight from the image server ----
{
  assert.equal(md5(""), "d41d8cd98f00b204e9800998ecf8427e");
  assert.equal(md5("The quick brown fox jumps over the lazy dog"), createHash("md5").update("The quick brown fox jumps over the lazy dog").digest("hex"));
  assert.equal(md5("Musée_é.jpg"), createHash("md5").update("Musée_é.jpg").digest("hex"), "non-ASCII names hash as UTF-8");
  assert.equal(md5("x".repeat(200)), createHash("md5").update("x".repeat(200)).digest("hex"), "more than one block");
  const viaRedirect = commonsThumb("Example.jpg", 330);
  assert.equal(directThumb(viaRedirect), "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Example.jpg/330px-Example.jpg");
  assert.equal(directThumb(viaRedirect, 960), "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Example.jpg/960px-Example.jpg");
  assert.equal(directThumb(commonsThumb("Tour Eiffel (été).jpg", 500))!.split("/thumb/")[1].split("/").slice(2).join("/"), "Tour_Eiffel_(%C3%A9t%C3%A9).jpg/500px-Tour_Eiffel_(%C3%A9t%C3%A9).jpg");
  assert.equal(directThumb(commonsThumb("x".repeat(170) + ".jpg", 330)), undefined, "very long names keep the redirecting address");
  assert.equal(directThumb("https://example.org/a.jpg"), undefined);
}

// ---- friendly descriptions ----
{
  const cafe = elementToActivity({ type: "node", id: 42, lat: 1, lon: 1, tags: { amenity: "cafe", name: "Bean There" } })!;
  assert.equal(cafe.summary, blurbFor("Independent café", "osm-node-42"), "a line about the kind of place when there is no description");
  assert.equal(cafe.summary, elementToActivity({ type: "node", id: 42, lat: 1, lon: 1, tags: { amenity: "cafe", name: "Bean There" } })!.summary, "same line every time");
  const own = elementToActivity({ type: "node", id: 43, lat: 1, lon: 1, tags: { amenity: "cafe", name: "X", description: "Cat café with twelve resident cats." } })!;
  assert.equal(own.summary, "Cat café with twelve resident cats.", "the place's own description wins");
  assert.equal(blurbFor("Something unknown", "osm-node-1"), null);
  // The stock line is not searched: "coffee" in it must not turn a category search into a text match
  assert.ok(!matchesText(cafe, "sweet") && !matchesText(cafe, "chair") && !matchesText(cafe, "people-watching"));
  assert.ok(matchesText(own, "resident cats"), "a real description is searched");
}

// Real places: our API route first, then Photon straight from the browser
async function fallbackTests() {
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const mock = (serverReply: () => Response | Promise<Response>, otherReply: (url: string) => Response) => {
    calls.length = 0;
    maxInFlight = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.startsWith("/api/")) return serverReply();
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await wait(2);
      inFlight--;
      return otherReply(url);
    }) as typeof fetch;
  };
  const photonCalls = () => calls.filter((u) => u.includes("photon.komoot.io")).length;
  const cafesOnly = (url: string) =>
    url.includes("amenity%3Acafe") ? json({ features: [photonCafe(7), photonCafe(8)] }) : url.includes("leisure%3Apark") ? json({}, 500) : json({ features: [] });
  timing.headStartMs = 30;
  photonPacing.gapMs = 0;
  try {
    // Our route answers quickly: nothing else is contacted
    mock(() => json({ places: [{ id: "osm-node-1" }] }), () => json({}, 500));
    assert.equal((await loadNearbyPlaces(50.85, 4.35, 3000)).length, 1);
    assert.equal(calls.length, 1);

    // Our route fails (502, or a non-JSON timeout page): the browser asks Photon, one group of place types at a time
    for (const serverReply of [() => json({ error: "nope", places: [] }, 502), () => new Response("<html>504</html>", { status: 504 })]) {
      mock(serverReply, cafesOnly);
      const got = await loadNearbyPlaces(50.85, 4.35, 3000);
      assert.equal(got.length, 1, "duplicates collapsed, failed groups ignored");
      assert.equal(got[0].id, "osm-node-7");
      assert.equal(got[0].partial, true);
      assert.equal(got[0].hours, null, "no invented hours");
      assert.equal(photonCalls(), PHOTON_GROUPS.length);
      assert.equal(maxInFlight, 1, "Photon requests never overlap");
      assert.ok(!calls.some((u) => u.includes("overpass")), "the browser never calls Overpass");
    }

    // Our route is slow: Photon is asked after the head start and whichever finishes first is used
    mock(async () => (await wait(300), json({ places: [{ id: "osm-node-1" }] })), cafesOnly);
    assert.equal((await loadNearbyPlaces(50.85, 4.35, 3000))[0].id, "osm-node-7");
    mock(async () => (await wait(40), json({ places: [{ id: "osm-node-1" }] })), cafesOnly);
    photonPacing.gapMs = 60;
    assert.equal((await loadNearbyPlaces(50.85, 4.35, 3000))[0].id, "osm-node-1", "full records win when they arrive first");
    await wait(80);
    assert.ok(photonCalls() < PHOTON_GROUPS.length, "Photon is stopped once full records arrive");
    photonPacing.gapMs = 0;

    // Wide searches skip our route, show places as they arrive, and ask for the wider radius
    mock(() => json({ places: [{ id: "osm-node-1" }] }), cafesOnly);
    const seen: number[] = [];
    const wide = await loadNearbyPlaces(50.85, 4.35, 25000, undefined, { onProgress: (p) => seen.push(p.length) });
    assert.equal(wide[0].id, "osm-node-7");
    assert.deepEqual(seen, [1]);
    assert.ok(!calls.some((u) => u.startsWith("/api/")), "the 5 km server route is skipped");
    assert.ok(calls.every((u) => u.includes("radius=25")));
    assert.equal(loadRangeKm(1.5), 5);
    assert.equal(loadRangeKm(10), 10);
    assert.equal(loadRangeKm(25), 25);

    // Photon refusing everything: stop after two tries, and show one clear message
    mock(() => new Response("<html>504</html>", { status: 504 }), () => json({}, 504));
    await assert.rejects(loadNearbyPlaces(50.85, 4.35, 3000), /Couldn't load real places/);
    assert.equal(photonCalls(), 2);

    // Saved results: recent ones are the answer; older ones show at once and are refreshed behind
    {
      const store = new Map<string, string>();
      (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
      mock(() => json({ places: [{ id: "osm-node-1" }] }), cafesOnly);
      await loadNearbyPlaces(50.85, 4.35, 3000);
      assert.equal(calls.length, 1);
      await loadNearbyPlaces(50.85, 4.35, 3000);
      assert.equal(calls.length, 1, "a recent saved result needs no request");
      // age the saved entry by two days
      const key = [...store.keys()][0];
      const aged = JSON.parse(store.get(key)!);
      aged[0].at -= 2 * 86_400_000;
      store.set(key, JSON.stringify(aged));
      mock(() => json({ places: [{ id: "osm-node-2" }] }), cafesOnly);
      const shown: string[] = [];
      const refreshed = await loadNearbyPlaces(50.85, 4.35, 3000, undefined, { onProgress: (p) => shown.push(p[0].id) });
      assert.deepEqual(shown, ["osm-node-1"], "the older result is shown straight away");
      assert.equal(refreshed[0].id, "osm-node-2", "then replaced by the fresh one");
      // if the refresh fails, the older result stays
      aged[0].places = [{ id: "osm-node-2" }];
      store.set(key, JSON.stringify(aged));
      mock(() => new Response("<html>504</html>", { status: 504 }), () => json({}, 504));
      assert.equal((await loadNearbyPlaces(50.85, 4.35, 3000))[0].id, "osm-node-2");
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }

    // A ready-made city file: the answer at the city's own centre, a first screen nearby
    {
      const store = new Map<string, string>();
      (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
      (globalThis as { window?: unknown }).window = {};
      const file = { builtAt: new Date().toISOString(), centre: { lat: 50.8467, lng: 4.3525 }, radiusKm: 5, places: [{ id: "osm-node-55" }], photos: { "osm-node-55": { file: "X.jpg" } } };
      const withFile = (url: string) => (url.includes("/data/cities/brussels.json") ? json(file) : cafesOnly(url));
      mock(() => json({ places: [{ id: "osm-node-1" }] }), withFile);
      assert.equal((await loadNearbyPlaces(50.8467, 4.3525, 5000))[0].id, "osm-node-55");
      assert.deepEqual(calls, ["/data/cities/brussels.json"], "at the centre nothing else is asked");
      assert.ok([...store.values()].some((v) => v.includes("X.jpg")), "its photo matches are kept for the photo lookup");
      store.clear();
      const seen: string[] = [];
      const near = await loadNearbyPlaces(50.856, 4.3525, 5000, undefined, { onProgress: (p) => seen.push(p[0].id) });
      assert.equal(seen[0], "osm-node-55", "a kilometre away the file fills the screen first");
      assert.equal(near[0].id, "osm-node-1", "then the lookup for the exact spot replaces it");
      store.clear();
      mock(() => json({ places: [{ id: "osm-node-1" }] }), withFile);
      await loadNearbyPlaces(48.85, 2.35, 5000);
      assert.ok(!calls.some((u) => u.includes("/data/cities/")), "far from any listed city no file is fetched");
      store.clear();
      mock(() => json({ places: [{ id: "osm-node-1" }] }), (url) => (url.includes("/data/cities/") ? json({ ...file, builtAt: "2020-01-01T00:00:00Z" }) : cafesOnly(url)));
      assert.equal((await loadNearbyPlaces(50.8467, 4.3525, 5000))[0].id, "osm-node-1", "a long-out-of-date file is ignored");
      delete (globalThis as { window?: unknown }).window;
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }

    // A single place falls back to the OpenStreetMap API: nodes directly, ways centred on their points
    mock(() => json({ error: "down" }, 502), () => json({ elements: [{ type: "node", id: 9, lat: 50.85, lon: 4.35, tags: { amenity: "cafe", name: "Bean There", opening_hours: "Mo-Su 08:00-17:00" } }] }));
    const full = await loadPlaceById("osm-node-9");
    assert.equal(full.id, "osm-node-9");
    assert.deepEqual(full.hours?.[1], [8, 17]);
    assert.equal(full.partial, undefined);
    mock(() => json({ error: "down" }, 502), () =>
      json({ elements: [{ type: "node", id: 1, lat: 50, lon: 4 }, { type: "node", id: 2, lat: 52, lon: 6 }, { type: "way", id: 5, tags: { leisure: "park", name: "Parc" } }] }));
    const way = await loadPlaceById("osm-way-5");
    assert.equal(way.lat, 51);
    assert.equal(way.lng, 5);
    assert.ok(calls[1].endsWith("/way/5/full.json"));

    // A definite 404 from our route is final
    mock(() => json({ error: "Place not found in OpenStreetMap." }, 404), () => json({ elements: [] }));
    await assert.rejects(loadPlaceById("osm-node-9"), /not found/);
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ---- Wikimedia photos and descriptions ---------------------------------------------------------

// OpenStreetMap tags → links. Only Commons files are accepted as images, never other hosts.
assert.deepEqual(wikiRefFromTags({ wikipedia: "fr:Musée_de_la_ville_de_Bruxelles", wikidata: "Q968055" }), {
  wikipedia: { lang: "fr", title: "Musée de la ville de Bruxelles" },
  wikidata: "Q968055",
});
assert.deepEqual(wikiRefFromTags({ wikimedia_commons: "Category:British Museum", image: "File:British Museum from NE 2.JPG" }), {
  commonsCategory: "British Museum",
  commonsFile: "British Museum from NE 2.JPG",
});
assert.equal(wikiRefFromTags({ image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/British_Museum_from_NE_2.JPG/500px-British_Museum_from_NE_2.JPG" })?.commonsFile, "British Museum from NE 2.JPG");
assert.equal(wikiRefFromTags({ image: "https://commons.wikimedia.org/wiki/File:Caf%C3%A9_X.jpg" })?.commonsFile, "Café X.jpg");
assert.equal(wikiRefFromTags({ image: "https://example.com/photo.jpg", wikidata: "not-an-id" }), undefined, "other hosts and bad ids are ignored");
assert.equal(elementToActivity({ type: "node", id: 3, lat: 1, lon: 1, tags: { tourism: "museum", name: "M", wikidata: "Q1;Q2" } })!.wiki?.wikidata, "Q1");
assert.equal(elementToActivity({ type: "node", id: 3, lat: 1, lon: 1, tags: { tourism: "museum", name: "M" } })!.wiki, undefined);

// Photographs only, at the widths Wikimedia serves
assert.ok(isPhotoFile("Broodhuis Bruxelles.jpg") && isPhotoFile("x.JPEG") && !isPhotoFile("Bupa-logo 2022.png") && !isPhotoFile("map.svg"));
assert.equal(commonsThumb("Café X.jpg", 500), "https://commons.wikimedia.org/wiki/Special:FilePath/Caf%C3%A9_X.jpg?width=500");
assert.equal(thumbSrcSet(commonsThumb("a b.jpg", 500)), "https://commons.wikimedia.org/wiki/Special:FilePath/a_b.jpg?width=330 330w, https://commons.wikimedia.org/wiki/Special:FilePath/a_b.jpg?width=500 500w");
assert.ok(thumbSrcSet(commonsThumb("a.jpg", 960), true)!.endsWith("width=960 960w"));
assert.equal(thumbSrcSet("data:image/png;base64,xx"), undefined, "a venue's own upload is left alone");
assert.equal(plainText('<a href="//commons.wikimedia.org/wiki/User:X">Jane &amp; Co</a>'), "Jane & Co");

// Bilingual OpenStreetMap names count as two names; one short word is not a name
assert.deepEqual(nameVariants("Musée de la ville de Bruxelles - Museum van de Stad Brussel").map((v) => v.join(" ")), [
  "musee ville bruxelles museum stad brussel",
  "musee ville bruxelles",
  "museum stad brussel",
]);
assert.deepEqual(nameVariants("Parc"), []);

// Matching a nearby Wikidata item to a place: same name, close by, and the same kind of thing
const spot = (name: string, category: Activity["category"], lat = 50.8467, lng = 4.3525) => ({ id: `osm-node-${name}`, name, category, lat, lng }) as Activity;
const item = (id: string, names: string[], desc: string | undefined, lat = 50.8468, lng = 4.3526): WikiItem => ({ id, lat, lng, names, desc });
const cityMuseum = item("Q968055", ["Brussels City Museum", "Musée de la ville de Bruxelles", "Museum van de Stad Brussel"], "museum in Brussels, Belgium");
assert.equal(matchStrength(spot("Musée de la ville de Bruxelles - Museum van de Stad Brussel", "museum"), cityMuseum), "exact");
assert.equal(matchStrength(spot("Musée Magritte Museum", "museum"), item("Q1", ["Musée Magritte", "Magritte Museum"], "art museum in Brussels")), "close", "a bilingual name written without a separator");
assert.equal(matchStrength(spot("Museum van de Stad Brussel", "museum", 50.86, 4.3525), cityMuseum), null, "over a kilometre away");
assert.equal(matchStrength(spot("Museum van de Stad Brussel", "museum"), { ...cityMuseum, desc: undefined }), null, "no description, no match");
// The cases that would put the wrong picture on a real business
const statue = item("Q2", ["Manneken Pis"], "sculpture and fountain in Brussels, Belgium");
assert.equal(matchStrength(spot("Manneken Pis", "museum"), statue), "exact", "the attraction itself");
assert.equal(matchStrength(spot("Manneken Pis", "indiecafe"), statue), null, "a café named after the statue next door");
assert.equal(matchStrength(spot("Le Cirio", "indiecafe"), item("Q3", ["Le Cirio"], "café in Brussels, Belgium")), "exact");
assert.equal(matchStrength(spot("Théâtre Royal du Parc", "live"), item("Q4", ["Parc Royal", "Brussels Park"], "park in Brussels, Belgium")), null, "a theatre is not the park it stands in");
assert.equal(matchStrength(spot("Parc", "park"), item("Q5", ["Parc", "Park"], "metro station in Brussels")), null, "a station is never a venue");
assert.equal(matchStrength(spot("Atomium", "walk"), item("Q5b", ["Atomium"], "building in Brussels")), "exact", "a distinctive single word");
assert.equal(matchStrength(spot("Palace", "walk"), item("Q5c", ["Palace"], "building in Brussels")), null, "one short word with no way to check the kind");
assert.equal(matchStrength(spot("Botanique", "park"), item("Q6", ["Botanique"], "Brussels metro station")), null);
assert.equal(matchStrength(spot("Starbucks", "chaincafe"), item("Q7", ["Starbucks"], "American coffeehouse chain")), null, "chains never get a photo this way");
assert.equal(matchStrength(spot("Parc de Bruxelles", "park", 50.8445, 4.3635), item("Q8", ["Parc de Bruxelles"], "park in Brussels", 50.8449, 4.3672)), "exact", "parks may be a few hundred metres off");
// Exact names beat close ones, then the nearest wins
assert.deepEqual(
  matchPlacesToItems(
    [spot("Musée Magritte Museum", "museum")],
    [item("Q10", ["Magritte Museum Shop Museum"], "museum shop"), item("Q11", ["Musée Magritte", "Magritte Museum"], "art museum", 50.847, 4.353), item("Q12", ["Musée Magritte Museum"], "art museum", 50.8475, 4.3535)],
  ),
  { "osm-node-Musée Magritte Museum": "Q12" },
);

async function wikiTests() {
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const param = (url: string, k: string) => new URL(url).searchParams.get(k) ?? "";
  try {
    // Area photos: a linked place needs no guessing; an unlinked one is matched by name; a logo is never used
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (param(url, "generator") === "search")
        return json({ query: { pages: [{ title: "Q968055", coordinates: [{ lat: 50.8468, lon: 4.3526 }] }, { title: "Q99", coordinates: [{ lat: 50.9, lon: 4.5 }] }, { title: "Q50", coordinates: [{ lat: 50.8467, lon: 4.3524 }] }] } });
      if (param(url, "action") === "wbgetentities")
        return json({ entities: {
          Q968055: { id: "Q968055", labels: { fr: { value: "Musée de la ville de Bruxelles" } }, aliases: { nl: [{ value: "Museum van de Stad Brussel" }] }, descriptions: { en: { value: "museum in Brussels, Belgium" } } },
          Q50: { id: "Q50", labels: { en: { value: "Grand-Place" } }, descriptions: { en: { value: "central square of Brussels" } } },
        } });
      if (param(url, "prop") === "pageimages")
        return json({ query: { pages: [{ title: "Q968055", pageimage: "Broodhuis_Bruxelles.jpg" }, { title: "Q777", pageimage: "Logo.png" }, { title: "Q888", pageimage: "Theatre front.jpg" }] } });
      return json({}, 500);
    }) as typeof fetch;
    const places = [
      spot("Museum van de Stad Brussel", "museum"),
      { ...spot("Some Theatre", "live"), wiki: { wikidata: "Q888" } },
      { ...spot("Logo Place", "museum"), wiki: { wikidata: "Q777" } },
      spot("Grand Place Coffee", "indiecafe"),
      spot("Starbucks", "chaincafe"),
    ];
    const photos = await loadAreaPhotos(places, { lat: 50.8467, lng: 4.3525 }, 5);
    assert.deepEqual(photos, { "osm-node-Museum van de Stad Brussel": { file: "Broodhuis Bruxelles.jpg" }, "osm-node-Some Theatre": { file: "Theatre front.jpg" } });
    assert.ok(calls.filter((u) => param(u, "generator") === "search").every((u) => param(u, "gsrsearch").startsWith("nearcoord:5km,50.8467,4.3525 haswbstatement:P18")));
    assert.ok(!param(calls.find((u) => param(u, "action") === "wbgetentities")!, "ids").includes("Q99"), "names are only looked up for items near a place");
    const shown = withAreaPhotos(places, photos);
    assert.equal(shown[0].photos?.[0], commonsThumb("Broodhuis Bruxelles.jpg", 500));
    assert.equal(shown[0].photoCredits?.[0]?.page, "https://commons.wikimedia.org/wiki/File:Broodhuis_Bruxelles.jpg");
    assert.equal(shown[3].photos, undefined);
    assert.equal(withAreaPhotos([{ ...places[0], photos: ["own.jpg"] }], photos)[0].photos?.[0], "own.jpg", "a venue's own photo is kept");

    // Everything down: no photos, and no exception that could disturb the page
    globalThis.fetch = (async () => json({}, 503)) as typeof fetch;
    await assert.rejects(loadAreaPhotos([spot("Elsewhere Museum", "museum")], { lat: 1, lng: 1 }, 5));
    assert.deepEqual(await loadPlaceMedia({ wikidata: "Q1", wikipedia: { lang: "fr", title: "X" } }, ["en"]), { text: undefined, photos: [] });

    // Place page: article in the visitor's language, Wikidata's picture first, gallery from the place's own category
    calls.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (param(url, "props") === "sitelinks")
        return json({ entities: { Q968055: { sitelinks: { frwiki: { title: "Musée de la ville de Bruxelles" }, nlwiki: { title: "Museum van de Stad Brussel" }, enwiki: { title: "Brussels City Museum" }, commonswiki: { title: "Category:Museum of the City of Brussels" } } } } });
      if (url.includes("/api/rest_v1/page/summary/"))
        return json({ type: "standard", title: "Museum van de Stad Brussel", extract: "Het Museum van de Stad Brussel is een museum.", originalimage: { source: "https://upload.wikimedia.org/wikipedia/commons/8/8f/Other.jpg" }, content_urls: { desktop: { page: "https://nl.wikipedia.org/wiki/Museum_van_de_Stad_Brussel" } } });
      if (param(url, "action") === "wbgetclaims") return json({ claims: { P18: [{ mainsnak: { datavalue: { value: "Broodhuis Bruxelles.jpg" } } }] } });
      if (param(url, "generator") === "categorymembers")
        return json({ query: { pages: [
          { title: "File:Broodhuis Bruxelles.jpg", imageinfo: [{ width: 1924, height: 2560 }] },
          { title: "File:Hall.jpg", imageinfo: [{ width: 2000, height: 1500, extmetadata: { Artist: { value: "<a>Ann</a>" }, LicenseShortName: { value: "CC BY 4.0" } } }] },
          { title: "File:Plan.svg", imageinfo: [{ width: 2000, height: 1500 }] },
          { title: "File:Tiny.jpg", imageinfo: [{ width: 300, height: 200 }] },
          { title: "File:Banner.jpg", imageinfo: [{ width: 4000, height: 600 }] },
        ] } });
      if (param(url, "titles") === "File:Broodhuis Bruxelles.jpg")
        return json({ query: { pages: [{ title: "File:Broodhuis Bruxelles.jpg", imageinfo: [{ extmetadata: { Artist: { value: "Ben" }, LicenseShortName: { value: "CC BY-SA 3.0" } } }] }] } });
      return json({}, 500);
    }) as typeof fetch;
    const media = await loadPlaceMedia({ wikidata: "Q968055", wikipedia: { lang: "fr", title: "Musée de la ville de Bruxelles" } }, ["nl", "en"]);
    assert.equal(media.text?.lang, "nl");
    assert.equal(media.text?.url, "https://nl.wikipedia.org/wiki/Museum_van_de_Stad_Brussel");
    assert.ok(calls.some((u) => u.startsWith("https://nl.wikipedia.org/api/rest_v1/page/summary/Museum_van_de_Stad_Brussel")));
    assert.deepEqual(media.photos.map((p) => p.src), [commonsThumb("Broodhuis Bruxelles.jpg", 960), commonsThumb("Hall.jpg", 960)], "hero once, then gallery photos that are real photos of a sensible shape");
    assert.deepEqual(media.photos[0].credit, { page: "https://commons.wikimedia.org/wiki/File:Broodhuis_Bruxelles.jpg", by: "Ben", license: "CC BY-SA 3.0" });
    assert.deepEqual(media.photos[1].credit, { page: "https://commons.wikimedia.org/wiki/File:Hall.jpg", by: "Ann", license: "CC BY 4.0" });

    // A disambiguation page is not a description, and a picture hosted outside Commons is not used
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/page/summary/")) return json({ type: "disambiguation", extract: "X may refer to", originalimage: { source: "https://upload.wikimedia.org/wikipedia/en/1/11/Nonfree.jpg" }, content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/X" } } });
      return json({ query: { pages: [] } });
    }) as typeof fetch;
    assert.deepEqual(await loadPlaceMedia({ wikipedia: { lang: "en", title: "X" } }, ["en"]), { text: undefined, photos: [] });
  } finally {
    globalThis.fetch = realFetch;
  }
}

fallbackTests()
  .then(wikiTests)
  .then(
    () => console.log("all logic tests passed"),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
