import { NextResponse } from "next/server";
import { buildIdQuery, elementToActivity, runOverpass } from "@/lib/osm";
import { osmApiPlace } from "@/lib/places-fallback";
import type { Activity } from "@/lib/types";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
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
