import assert from "node:assert/strict";
import { parseOsmHours, isOpenAt } from "../src/lib/hours";
import { elementToActivity, buildAroundQuery, elementsToPlaces } from "../src/lib/osm";
import { loadNearbyPlaces, loadPlaceById } from "../src/lib/discover";
import { parseQuery, applyFilters, defaultFilters } from "../src/lib/search";
import { demoActivities } from "../src/lib/demo-data";

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

// Real places: our API route first, then straight to Overpass from the browser if that fails
async function fallbackTests() {
  const realFetch = globalThis.fetch;
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const mock = (serverReply: () => Response | Promise<Response>, overpassReply: (url: string) => Response) => {
    calls.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
      return url.startsWith("/api/") ? serverReply() : overpassReply(url);
    }) as typeof fetch;
  };
  try {
    // Server route works: Overpass isn't contacted from the browser
    mock(() => json({ places: [{ id: "osm-node-1" }] }), () => json({}, 500));
    assert.equal((await loadNearbyPlaces(50.85, 4.35, 3000)).length, 1);
    assert.equal(calls.length, 1);

    // Server route fails (502, or a non-JSON timeout page): the browser asks Overpass, trying the second server if the first refuses
    for (const serverReply of [() => json({ error: "nope", places: [] }, 502), () => new Response("<html>504</html>", { status: 504 })]) {
      mock(serverReply, (url) => (url.includes("overpass-api.de") ? json({}, 429) : json({ elements: [cafeEl(7)] })));
      const got = await loadNearbyPlaces(50.85, 4.35, 3000);
      assert.equal(got[0].id, "osm-node-7");
      assert.equal(calls.length, 3);
    }

    // Everything down: one clear message rather than a parser error
    mock(() => new Response("<html>504</html>", { status: 504 }), () => json({}, 504));
    await assert.rejects(loadNearbyPlaces(50.85, 4.35, 3000), /OpenStreetMap didn't respond/);

    // A single place by id falls back the same way, but a definite 404 is final
    mock(() => json({ error: "down" }, 502), () => json({ elements: [cafeEl(9)] }));
    assert.equal((await loadPlaceById("osm-node-9")).id, "osm-node-9");
    mock(() => json({ error: "Place not found in OpenStreetMap." }, 404), () => json({ elements: [cafeEl(9)] }));
    await assert.rejects(loadPlaceById("osm-node-9"), /not found/);
    assert.equal(calls.length, 1);

    // In a browser no User-Agent header is set, so the Overpass request needs no CORS preflight
    (globalThis as { window?: unknown }).window = {};
    mock(() => json({}, 502), () => json({ elements: [] }));
    await loadNearbyPlaces(50.85, 4.35, 3000);
    assert.deepEqual(Object.keys(calls[1].headers), ["Content-Type"]);
    delete (globalThis as { window?: unknown }).window;
  } finally {
    globalThis.fetch = realFetch;
  }
}

fallbackTests().then(
  () => console.log("all logic tests passed"),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
