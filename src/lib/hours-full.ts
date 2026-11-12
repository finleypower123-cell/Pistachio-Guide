/**
 * Full OpenStreetMap opening_hours support, using opening_hours.js (LGPL-3.0, used unmodified as a
 * library): month and season rules, week numbers, "sunrise", public holidays and more. It is a large
 * library, so only the server routes and the weekly city build load it; the browser uses the light
 * parser in hours.ts for the few records it reads directly.
 */
import OpeningHours from "opening_hours";
import { fromDayRanges, type ParsedHours } from "./hours";
import type { DayRanges } from "./types";

const DAY_MS = 86_400_000;

/** Rough country from coordinates, for public-holiday rules. Only Belgium and the UK are listed. */
function countryAt(lat: number, lng: number) {
  return lng > 2.5 && lat > 49.4 && lat < 51.6 ? "be" : "gb";
}

/** One week of ranges by JS weekday, starting at `from` (local midnight). Null when hours are a guess. */
function weekFrom(oh: InstanceType<typeof OpeningHours>, from: Date): DayRanges | null {
  const to = new Date(from.getTime() + 7 * DAY_MS);
  const days: DayRanges = [[], [], [], [], [], [], []];
  for (const [a, b, unknown] of oh.getOpenIntervals(from, to)) {
    // "11:00+" (open end) and "by appointment" leave the closing time unknown; we don't guess it.
    if (unknown) return null;
    let start = a.getTime();
    const end = b.getTime();
    // Split ranges at midnight, so a 24/7 place shows every day.
    while (start < end) {
      const d = new Date(start);
      const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const stop = Math.min(end, midnight + DAY_MS);
      days[d.getDay()].push([(start - midnight) / 3_600_000, (stop - midnight) / 3_600_000]);
      start = stop;
    }
  }
  // Rejoin late nights: a range that starts at midnight and closes by 06:00 belongs to the evening before.
  for (let d = 0; d < 7; d++) {
    const prev = days[(d + 6) % 7];
    const first = days[d][0];
    const last = prev[prev.length - 1];
    if (first && first[0] === 0 && first[1] <= 6 && last && last[1] === 24 && last[0] > 0) {
      last[1] = 24 + first[1];
      days[d].shift();
    }
  }
  return days;
}

/**
 * The rules for an ordinary week: public and school holiday rules are dropped ("PH off", "SH Mo-Fr
 * 10:00-16:00") and "PH" is taken out of day lists ("Sa-Su,PH 10:00-17:00" becomes "Sa-Su ...").
 * opening_hours.js has no holiday calendar for some countries, the UK included, and the usual week
 * is what the app shows anyway.
 */
export function ordinaryWeek(raw: string): string {
  return raw
    .split(";")
    .map((r) => r.trim())
    .filter((r) => r && !/(^|\s)(PH|SH)(\s|$)/.test(r.replace(/^[A-Z][a-z]{2}(-[A-Z][a-z]{2})?:?\s*/, " ")))
    .map((r) => r.replace(/,(PH|SH)\b/g, "").replace(/\b(PH|SH),/g, ""))
    .join("; ");
}

const sig = (d: [number, number][]) => d.map((r) => r.join("-")).join(",");

/**
 * The usual week for a place. Five weeks are read and each weekday takes the hours it has most
 * often, so a bank holiday (or Christmas and New Year falling on the same weekday) doesn't make
 * that day look closed every week.
 * Returns null when the hours can't be pinned down, and undefined when the string can't be read at all.
 */
export function fullHours(raw: string | undefined, lat: number, lng: number, now = new Date()): ParsedHours | null | undefined {
  if (!raw) return null;
  const week = ordinaryWeek(raw);
  if (!week) return null;
  let oh: InstanceType<typeof OpeningHours>;
  try {
    oh = new OpeningHours(week, { lat, lon: lng, address: { country_code: countryAt(lat, lng), state: "" } }, 0);
  } catch {
    return undefined;
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weeks: DayRanges[] = [];
  for (let w = 0; w < 5; w++) {
    let days: DayRanges | null;
    try {
      days = weekFrom(oh, new Date(today.getTime() + w * 7 * DAY_MS));
    } catch {
      return undefined;
    }
    if (!days) return null;
    weeks.push(days);
  }
  const usual: DayRanges = [0, 1, 2, 3, 4, 5, 6].map((d) => {
    const seen = new Map<string, { ranges: [number, number][]; n: number }>();
    for (const w of weeks) {
      const k = sig(w[d]);
      seen.set(k, { ranges: w[d], n: (seen.get(k)?.n ?? 0) + 1 });
    }
    return [...seen.values()].sort((x, y) => y.n - x.n)[0].ranges;
  });
  return fromDayRanges(usual);
}
