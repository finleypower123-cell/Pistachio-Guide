import { NextResponse } from "next/server";
import { buildIdQuery, elementToActivity, runOverpass } from "@/lib/osm";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const m = id.match(/^osm-(node|way|relation)-(\d+)$/);
  if (!m) return NextResponse.json({ error: "Unknown place id." }, { status: 400 });
  try {
    const els = await runOverpass(buildIdQuery(m[1], Number(m[2])));
    const place = els.map(elementToActivity).find(Boolean);
    if (!place) return NextResponse.json({ error: "Place not found in OpenStreetMap." }, { status: 404 });
    return NextResponse.json({ place }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
  } catch {
    return NextResponse.json({ error: "OpenStreetMap didn't respond. Try again shortly." }, { status: 502 });
  }
}
