/**
 * Builds public/data/cities/<slug>.json for every city in src/lib/cities.ts: the same places and
 * photo matches a visitor's browser would load, fetched once here so the site can show them at
 * once. Run weekly by .github/workflows/city-data.yml (the free services it uses are reachable
 * from GitHub's runners), or by hand with `npx tsx scripts/build-city-data.ts [slug ...]`.
 *
 * A city whose lookup fails or comes back thin keeps its previous file.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CITIES, CITY_DATA_RADIUS_KM, type CityData } from "../src/lib/cities";
import { photonNearby, withFullRecords } from "../src/lib/places-fallback";
import { loadAreaPhotos, withAreaPhotos } from "../src/lib/wiki";
import { fullHours } from "../src/lib/hours-full";
import { setFullHoursParser } from "../src/lib/osm";
import { mergeOverture, type OverturePlace } from "../src/lib/overture";

setFullHoursParser(fullHours);

const OUT = "public/data/cities";
/** Written by scripts/overture_places.py earlier in the workflow; skipped when it isn't there. */
const OVERTURE_DIR = ".overture";

if (process.argv[2] === "--list") {
  // For scripts/overture_places.py: which areas to download.
  console.log(JSON.stringify(CITIES.map((c) => ({ slug: c.slug, lat: c.lat, lng: c.lng, radiusKm: CITY_DATA_RADIUS_KM }))));
  process.exit(0);
}

function overtureFor(slug: string): { release?: string; places: OverturePlace[] } | null {
  const file = `${OVERTURE_DIR}/${slug}.json`;
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}
const only = process.argv.slice(2);

async function main() {
  mkdirSync(OUT, { recursive: true });
  let failed = 0;
  for (const city of CITIES.filter((c) => !only.length || only.includes(c.slug))) {
    const started = Date.now();
    try {
      const centre = { lat: city.lat, lng: city.lng };
      const basic = await photonNearby(city.lat, city.lng, CITY_DATA_RADIUS_KM * 1000);
      if (basic.length < 20) throw new Error(`only ${basic.length} places came back`);
      // Opening hours, websites and other details, so cards and filters can use them.
      const osmPlaces = await withFullRecords(basic);
      const full = osmPlaces.filter((p) => !p.partial).length;
      // Places OpenStreetMap hasn't recorded, and websites and social pages for ones it has.
      const ovt = overtureFor(city.slug);
      const merged = ovt ? mergeOverture(osmPlaces, ovt.places, city.slug) : null;
      const places = merged?.places ?? osmPlaces;
      const photos = await loadAreaPhotos(places, centre, CITY_DATA_RADIUS_KM).catch(() => ({}));
      const data: CityData = {
        builtAt: new Date().toISOString(),
        centre,
        radiusKm: CITY_DATA_RADIUS_KM,
        places: withAreaPhotos(places, photos),
        photos,
        ...(ovt?.release ? { overtureRelease: ovt.release } : {}),
      };
      writeFileSync(`${OUT}/${city.slug}.json`, JSON.stringify(data));
      const fromOverture = merged ? `, Overture: ${merged.added} added, ${merged.enriched} given links` : ", no Overture file";
      console.log(
        `${city.slug}: ${places.length} places (${full} full OSM records, ${places.filter((p) => p.hours).length} with hours, ${places.filter((p) => p.hoursDetail).length} with breaks)${fromOverture}, ${Object.keys(photos).length} photos, ${Math.round((Date.now() - started) / 1000)}s`,
      );
    } catch (e) {
      failed++;
      console.log(`${city.slug}: FAILED, previous file kept (${String(e).slice(0, 120)})`);
    }
  }
  // Fail the run only if nothing worked, so one flaky city doesn't block the rest being saved.
  if (failed && failed === CITIES.length) process.exit(1);
}

main();
