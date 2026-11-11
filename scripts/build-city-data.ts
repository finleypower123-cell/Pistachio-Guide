/**
 * Builds public/data/cities/<slug>.json for every city in src/lib/cities.ts: the same places and
 * photo matches a visitor's browser would load, fetched once here so the site can show them at
 * once. Run weekly by .github/workflows/city-data.yml (the free services it uses are reachable
 * from GitHub's runners), or by hand with `npx tsx scripts/build-city-data.ts [slug ...]`.
 *
 * A city whose lookup fails or comes back thin keeps its previous file.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { CITIES, CITY_DATA_RADIUS_KM, type CityData } from "../src/lib/cities";
import { photonNearby } from "../src/lib/places-fallback";
import { loadAreaPhotos, withAreaPhotos } from "../src/lib/wiki";

const OUT = "public/data/cities";
const only = process.argv.slice(2);

async function main() {
  mkdirSync(OUT, { recursive: true });
  let failed = 0;
  for (const city of CITIES.filter((c) => !only.length || only.includes(c.slug))) {
    const started = Date.now();
    try {
      const centre = { lat: city.lat, lng: city.lng };
      const places = await photonNearby(city.lat, city.lng, CITY_DATA_RADIUS_KM * 1000);
      if (places.length < 20) throw new Error(`only ${places.length} places came back`);
      const photos = await loadAreaPhotos(places, centre, CITY_DATA_RADIUS_KM).catch(() => ({}));
      const data: CityData = { builtAt: new Date().toISOString(), centre, radiusKm: CITY_DATA_RADIUS_KM, places: withAreaPhotos(places, photos), photos };
      writeFileSync(`${OUT}/${city.slug}.json`, JSON.stringify(data));
      console.log(`${city.slug}: ${places.length} places, ${Object.keys(photos).length} photos, ${Math.round((Date.now() - started) / 1000)}s`);
    } catch (e) {
      failed++;
      console.log(`${city.slug}: FAILED, previous file kept (${String(e).slice(0, 120)})`);
    }
  }
  // Fail the run only if nothing worked, so one flaky city doesn't block the rest being saved.
  if (failed && failed === CITIES.length) process.exit(1);
}

main();
