import { getSupabase } from "./supabase/client";
import { local } from "./storage";

export type EventKind = "view" | "save" | "booking_click" | "website_click" | "directions";

interface LocalEvent {
  id: string;
  kind: EventKind;
  at: number;
}

/** Logs a listing event to Supabase when configured, and always to this device for the demo dashboard. */
export function logEvent(activityId: string, kind: EventKind) {
  const events = local.get<LocalEvent[]>("events", []);
  events.push({ id: activityId, kind, at: Date.now() });
  local.set("events", events.slice(-2000));
  const sb = getSupabase();
  if (sb) void sb.from("listing_events").insert({ activity_id: activityId, kind }).then(() => {});
}

export interface DailyStats {
  day: string; // YYYY-MM-DD
  view: number;
  save: number;
  booking_click: number;
  website_click: number;
  directions: number;
}

export function emptyDays(n: number): DailyStats[] {
  const out: DailyStats[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    out.push({ day: d.toISOString().slice(0, 10), view: 0, save: 0, booking_click: 0, website_click: 0, directions: 0 });
  }
  return out;
}

export function bucket(rows: { kind: EventKind; at: number }[], days = 14): DailyStats[] {
  const out = emptyDays(days);
  const idx = new Map(out.map((d, i) => [d.day, i]));
  for (const r of rows) {
    const i = idx.get(new Date(r.at).toISOString().slice(0, 10));
    if (i !== undefined) out[i][r.kind] += 1;
  }
  return out;
}

/** Events recorded on this device for one listing. */
export function localEventsFor(activityId: string) {
  return local.get<LocalEvent[]>("events", []).filter((e) => e.id === activityId);
}

/** Events from Supabase (owners only, enforced by row-level security). */
export async function cloudEventsFor(activityId: string, days = 14) {
  const sb = getSupabase();
  if (!sb) return null;
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data, error } = await sb
    .from("listing_events")
    .select("kind, created_at")
    .eq("activity_id", activityId)
    .gte("created_at", since)
    .limit(5000);
  if (error) return null;
  return (data ?? []).map((r) => ({ kind: r.kind as EventKind, at: Date.parse(r.created_at as string) }));
}
