import type { DayRanges, WeeklyHours } from "./types";

/** Build weekly hours. `days` is Mon→Sun as a 7-char mask, e.g. "1111100" for weekdays. */
export function H(open: number, close: number, days = "1111111"): WeeklyHours {
  const out: WeeklyHours = [null, null, null, null, null, null, null];
  [...days].forEach((ch, i) => {
    if (ch === "1") out[(i + 1) % 7] = [open, close];
  });
  return out;
}

const DAY_CODES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function expandDays(spec: string): number[] | null {
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const [a, b] = part.split("-");
    const ia = DAY_CODES.indexOf(a);
    if (ia < 0) return null;
    if (!b) {
      out.add(ia);
      continue;
    }
    const ib = DAY_CODES.indexOf(b);
    if (ib < 0) return null;
    // walk Monday-based so "Mo-Su" and "Fr-Mo" both work
    let i = ia;
    for (let guard = 0; guard < 8; guard++) {
      out.add(i);
      if (i === ib) break;
      i = (i + 1) % 7;
    }
  }
  return [...out];
}

function toHour(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) + Number(m[2]) / 60;
}

export interface ParsedHours {
  hours: WeeklyHours;
  /** Present only when some day has more than one opening range. */
  detail?: DayRanges;
}

/** Turns per-day range lists into the summary shape plus, when needed, the detail. */
export function fromDayRanges(days: DayRanges): ParsedHours | null {
  if (!days.some((d) => d.length)) return null;
  const sorted = days.map((d) => [...d].sort((x, y) => x[0] - y[0]));
  const hours: WeeklyHours = sorted.map((d) => (d.length ? ([d[0][0], Math.max(...d.map((r) => r[1]))] as [number, number]) : null));
  return sorted.some((d) => d.length > 1) ? { hours, detail: sorted } : { hours };
}

/**
 * Parse the common subset of OSM `opening_hours` (e.g. "Mo-Fr 08:00-12:00,13:00-18:00; Sa 09:00-17:00; Su off")
 * in the browser. Returns null for anything we can't read confidently, so the UI shows the raw text
 * instead of guessing. The server and the weekly city build use the full parser in hours-full.ts.
 */
export function parseHoursLight(raw?: string): ParsedHours | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s === "24/7") return { hours: H(0, 24) };
  const out: DayRanges = [[], [], [], [], [], [], []];
  let any = false;
  for (const ruleRaw of s.split(";")) {
    const rule = ruleRaw.trim();
    if (!rule) continue;
    if (/^PH\b/.test(rule)) continue; // public-holiday rules don't affect a normal week
    const m = rule.match(/^((?:[A-Z][a-z](?:-[A-Z][a-z])?,?)+)?\s*(.*)$/);
    if (!m) return null;
    const days = m[1] ? expandDays(m[1].replace(/,$/, "")) : [0, 1, 2, 3, 4, 5, 6];
    if (!days) return null;
    const times = m[2].trim();
    if (times === "off" || times === "closed") {
      days.forEach((d) => (out[d] = []));
      any = true;
      continue;
    }
    const ranges: [number, number][] = [];
    for (const range of times.split(",")) {
      const [a, b] = range.trim().split("-");
      const ha = toHour(a ?? "");
      let hb = toHour(b ?? "");
      if (ha === null || hb === null) return null;
      if (hb <= ha) hb += 24; // past midnight
      ranges.push([ha, hb]);
    }
    days.forEach((d) => (out[d] = ranges));
    any = true;
  }
  return any ? fromDayRanges(out) : null;
}

/** Summary hours only; kept for callers that don't need lunch breaks. */
export function parseOsmHours(raw?: string): WeeklyHours | null {
  return parseHoursLight(raw)?.hours ?? null;
}

/** The opening ranges for one weekday. */
export function dayRanges(hours: WeeklyHours | null | undefined, day: number, detail?: DayRanges): [number, number][] {
  if (detail?.[day]) return detail[day];
  const r = hours?.[day];
  return r ? [r] : [];
}

/** Is it open at the given hour today? Returns null when hours are unknown. */
export function isOpenAt(hours: WeeklyHours | null | undefined, hour: number, day = new Date().getDay(), detail?: DayRanges) {
  if (!hours) return null;
  // A range from yesterday that runs past midnight
  if (dayRanges(hours, (day + 6) % 7, detail).some((r) => r[1] > 24 && hour < r[1] - 24)) return true;
  return dayRanges(hours, day, detail).some((r) => hour >= r[0] && hour < r[1]);
}

export function nowHour(d = new Date()) {
  return d.getHours() + d.getMinutes() / 60;
}

const fmt = (h: number) => {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

export function formatRange(r: [number, number] | null) {
  if (!r) return "Closed";
  if (r[0] === 0 && r[1] === 24) return "Open 24 hours";
  return `${fmt(r[0])}–${fmt(r[1])}`;
}

/** "08:00–12:00, 13:30–18:00", or "Closed". */
export function formatRanges(list: [number, number][]) {
  return list.length ? list.map(formatRange).join(", ") : "Closed";
}

export function openStatus(hours: WeeklyHours | null | undefined, detail?: DayRanges): { open: boolean | null; text: string } {
  if (!hours) return { open: null, text: "Hours not listed" };
  const now = nowHour();
  const day = new Date().getDay();
  const open = isOpenAt(hours, now, day, detail);
  const today = dayRanges(hours, day, detail);
  if (open) {
    if (today.some((r) => r[0] === 0 && r[1] === 24)) return { open, text: "Open 24 hours" };
    const current = today.find((r) => now >= r[0] && now < r[1]);
    if (current) return { open, text: `Open until ${fmt(current[1])}` };
    const late = dayRanges(hours, (day + 6) % 7, detail).find((r) => r[1] > 24 && now < r[1] - 24);
    return { open, text: late ? `Open until ${fmt(late[1])}` : "Open now" };
  }
  const next = today.find((r) => now < r[0]);
  if (next) return { open, text: `Opens at ${fmt(next[0])}` };
  return { open, text: "Closed now" };
}

/** Rows Mon→Sun for an hours table. */
export function weekRows(hours: WeeklyHours, detail?: DayRanges) {
  return [1, 2, 3, 4, 5, 6, 0].map((d) => ({ day: DAY_NAMES[d], d, range: hours[d], ranges: dayRanges(hours, d, detail) }));
}
