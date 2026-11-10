import assert from "node:assert/strict";
import { parseOsmHours, isOpenAt } from "../src/lib/hours";
import { elementToActivity, buildAroundQuery, elementsToPlaces } from "../src/lib/osm";
import { loadNearbyPlaces, loadPlaceById, timing } from "../src/lib/discover";
import { PHOTON_GROUPS, photonPacing, photonToElement } from "../src/lib/places-fallback";
import { parseQuery, applyFilters, defaultFilters, loadRangeKm } from "../src/lib/search";
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

fallbackTests().then(
  () => console.log("all logic tests passed"),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
