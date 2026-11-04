import type { WeeklyHours } from "./types";

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

/**
 * Parse the common subset of OSM `opening_hours` (e.g. "Mo-Fr 08:00-18:00; Sa 09:00-17:00; Su off").
 * Returns null for anything we can't read confidently, so the UI shows the raw text instead of guessing.
 * Multiple ranges in one day (lunch breaks) are merged into first-open → last-close.
 */
export function parseOsmHours(raw?: string): WeeklyHours | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s === "24/7") return H(0, 24);
  const out: WeeklyHours = [null, null, null, null, null, null, null];
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
      days.forEach((d) => (out[d] = null));
      any = true;
      continue;
    }
    let open = Infinity;
    let close = -Infinity;
    for (const range of times.split(",")) {
      const [a, b] = range.trim().split("-");
      const ha = toHour(a ?? "");
      let hb = toHour(b ?? "");
      if (ha === null || hb === null) return null;
      if (hb <= ha) hb += 24; // past midnight
      open = Math.min(open, ha);
      close = Math.max(close, hb);
    }
    days.forEach((d) => (out[d] = [open, close]));
    any = true;
  }
  return any ? out : null;
}

/** Is it open at the given hour today? Returns null when hours are unknown. */
export function isOpenAt(hours: WeeklyHours | null | undefined, hour: number, day = new Date().getDay()) {
  if (!hours) return null;
  const today = hours[day];
  const yesterday = hours[(day + 6) % 7];
  if (yesterday && yesterday[1] > 24 && hour < yesterday[1] - 24) return true;
  if (!today) return false;
  return hour >= today[0] && hour < today[1];
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

export function openStatus(hours: WeeklyHours | null | undefined): { open: boolean | null; text: string } {
  const open = isOpenAt(hours, nowHour());
  if (open === null) return { open: null, text: "Hours not listed" };
  if (!hours) return { open: null, text: "Hours not listed" };
  const today = hours[new Date().getDay()];
  if (open) {
    if (today && today[0] === 0 && today[1] === 24) return { open, text: "Open 24 hours" };
    return { open, text: today ? `Open until ${fmt(today[1])}` : "Open now" };
  }
  if (today && nowHour() < today[0]) return { open, text: `Opens at ${fmt(today[0])}` };
  return { open, text: "Closed now" };
}

/** Rows Mon→Sun for an hours table. */
export function weekRows(hours: WeeklyHours) {
  return [1, 2, 3, 4, 5, 6, 0].map((d) => ({ day: DAY_NAMES[d], d, range: hours[d] }));
}
