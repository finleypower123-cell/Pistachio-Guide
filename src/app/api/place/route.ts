import { NextResponse } from "next/server";
import { buildIdQuery, elementToActivity, runOverpass, setFullHoursParser } from "@/lib/osm";
import { fullHours } from "@/lib/hours-full";
import { osmApiPlace } from "@/lib/places-fallback";
import { overturePlaceById } from "@/lib/overture";
import type { Activity } from "@/lib/types";

setFullHoursParser(fullHours);

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (id.startsWith("ovt-")) {
    // Overture places are kept in the city file that added them.
    const origin = new URL(req.url).origin;
    const place = await overturePlaceById(id, async (path) => {
      const res = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(5000) });
      return res.ok ? res.json() : null;
    }).catch(() => null);
    if (place) return NextResponse.json({ place }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
    return NextResponse.json({ error: "Place not found." }, { status: 404 });
  }
  const m = id.match(/^osm-(node|way|relation)-(\d+)$/);
  if (!m) return NextResponse.json({ error: "Unknown place id." }, { status: 400 });
  const type = m[1] as "node" | "way" | "relation";
  const num = Number(m[2]);

  let place: Activity | null | undefined;
  let answered = false;
  // Ask the OpenStreetMap API first for nodes and ways: one small, fast request. Overpass is the
  // backup, and the only route for relations.
  try {
    place = await osmApiPlace(type, num);
    answered = type !== "relation";
  } catch {}
  if (!place) {
    try {
      const limit = AbortSignal.timeout(8000);
      place = (await runOverpass(buildIdQuery(type, num), { timeoutMs: 6000, signal: limit })).map(elementToActivity).find(Boolean);
      answered = true;
    } catch {}
  }
  if (place) return NextResponse.json({ place }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
  if (answered) return NextResponse.json({ error: "Place not found in OpenStreetMap." }, { status: 404 });
  return NextResponse.json({ error: "OpenStreetMap didn't respond. Try again shortly." }, { status: 502 });
}
