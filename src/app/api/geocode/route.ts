import { NextResponse } from "next/server";

/** Location search via Nominatim (OpenStreetMap). Usage policy: identify the app, cache, low volume. */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "PistachioGuide/0.1 (+https://github.com/finleypower123-cell/Pistachio-Guide)",
        "Accept-Language": "en-GB,en",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { display_name: string; lat: string; lon: string; name?: string }[];
    const results = data.map((d) => ({
      label: d.name || d.display_name.split(",")[0],
      detail: d.display_name,
      lat: Number(d.lat),
      lng: Number(d.lon),
    }));
    return NextResponse.json({ results }, { headers: { "Cache-Control": "public, s-maxage=604800" } });
  } catch {
    return NextResponse.json({ error: "Location search is unavailable right now.", results: [] }, { status: 502 });
  }
}
