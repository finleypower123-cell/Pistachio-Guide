import { NextResponse } from "next/server";
import { buildAroundQuery, elementToActivity, runOverpass } from "@/lib/osm";
import type { Activity } from "@/lib/types";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  const radius = Math.min(Math.max(Number(u.searchParams.get("radius") ?? 2500), 300), 5000);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Send a valid lat and lng." }, { status: 400 });
  }
  // Round so nearby searches share the cache and we stay polite to the public Overpass servers.
  const rl = Math.round(lat * 200) / 200;
  const rg = Math.round(lng * 200) / 200;
  try {
    const els = await runOverpass(buildAroundQuery(rl, rg, radius));
    const seen = new Set<string>();
    const places: Activity[] = [];
    for (const el of els) {
      const a = elementToActivity(el);
      if (!a) continue;
      const key = `${a.name.toLowerCase()}|${a.category}`;
      if (seen.has(key)) continue;
      seen.add(key);
      places.push(a);
    }
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
