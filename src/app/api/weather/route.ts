import { NextResponse } from "next/server";
import type { Weather } from "@/lib/types";

const WET = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]);
function label(code: number) {
  if (code === 0) return "Clear";
  if (code <= 3) return "Cloudy";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 95) return "Thunderstorms";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if (WET.has(code)) return "Rain";
  return "Mixed";
}

/** Current weather from Open-Meteo (free, no API key). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: "Bad location" }, { status: 400 });
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&current=temperature_2m,weather_code,precipitation`;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as { current: { temperature_2m: number; weather_code: number; precipitation: number } };
    const code = j.current.weather_code;
    const weather: Weather = {
      code,
      tempC: Math.round(j.current.temperature_2m),
      isWet: WET.has(code) || j.current.precipitation > 0.1,
      isCold: j.current.temperature_2m < 8,
      label: label(code),
    };
    return NextResponse.json({ weather }, { headers: { "Cache-Control": "public, s-maxage=900" } });
  } catch {
    return NextResponse.json({ error: "Weather unavailable" }, { status: 502 });
  }
}
