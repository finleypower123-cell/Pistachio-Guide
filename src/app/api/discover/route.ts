import { NextResponse } from "next/server";
import { buildAroundQuery, elementsToPlaces, roundCoord, runOverpass, setFullHoursParser } from "@/lib/osm";
import { fullHours } from "@/lib/hours-full";

setFullHoursParser(fullHours);

/**
 * Full OpenStreetMap records around a point, via Overpass. The public Overpass servers are often
 * overloaded or refuse requests, so this gives up after a few seconds; the app then falls back to
 * Photon from the browser (see src/lib/discover.ts).
 */
const OVERPASS_LIMIT_MS = 7000;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  const radius = Math.min(Math.max(Number(u.searchParams.get("radius") ?? 2500), 300), 5000);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Send a valid lat and lng." }, { status: 400 });
  }
  try {
    // Round so nearby searches share the cache and we stay polite to the public Overpass servers.
    const query = buildAroundQuery(roundCoord(lat), roundCoord(lng), radius);
    const places = elementsToPlaces(await runOverpass(query, { timeoutMs: OVERPASS_LIMIT_MS, signal: AbortSignal.timeout(OVERPASS_LIMIT_MS) }));
    return NextResponse.json(
      { places, source: "overpass", attribution: "© OpenStreetMap contributors (ODbL)" },
      { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } },
    );
  } catch {
    return NextResponse.json(
      { error: "OpenStreetMap's Overpass service didn't respond. Try again in a minute.", places: [] },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
