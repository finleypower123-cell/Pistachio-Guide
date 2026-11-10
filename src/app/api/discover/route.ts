import { NextResponse } from "next/server";
import { buildAroundQuery, elementsToPlaces, roundCoord, runOverpass } from "@/lib/osm";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  const radius = Math.min(Math.max(Number(u.searchParams.get("radius") ?? 2500), 300), 5000);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Send a valid lat and lng." }, { status: 400 });
  }
  try {
    const places = elementsToPlaces(await runOverpass(buildAroundQuery(roundCoord(lat), roundCoord(lng), radius)));
    return NextResponse.json(
      { places, attribution: "© OpenStreetMap contributors (ODbL)" },
      { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } },
    );
  } catch {
    return NextResponse.json(
      { error: "OpenStreetMap's Overpass service didn't respond. Try again in a minute.", places: [] },
      { status: 502 },
    );
  }
}
