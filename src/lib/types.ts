export type CategoryId =
  | "escape"
  | "water"
  | "indiecafe"
  | "chaincafe"
  | "boardgame"
  | "arcade"
  | "bowling"
  | "climbing"
  | "trampoline"
  | "golf"
  | "cinema"
  | "market"
  | "vintage"
  | "museum"
  | "art"
  | "walk"
  | "park"
  | "swim"
  | "leisure"
  | "workshop"
  | "food"
  | "live";

export type Tag = "weird" | "gem" | "date" | "family" | "solo" | "friends" | "rainy";

/**
 * Where a listing came from. This drives the badges users see:
 * - demo: sample content written for this prototype, positioned around the chosen location
 * - osm: a real place from OpenStreetMap; only fields OSM actually records are shown
 * - business: a listing a business owner has claimed and edited
 */
export type Source = "demo" | "osm" | "business";

/** Opening hours by JS weekday (0 = Sunday). Each day is [openHour, closeHour] or null when closed. */
export type WeeklyHours = ([number, number] | null)[];

export type BookingType = "partner" | "walkin" | "free" | "venue" | "unknown";

export interface Activity {
  id: string;
  source: Source;
  name: string;
  category: CategoryId;
  /** Exact place type from the source, e.g. "Swimming pool" (OSM) */
  typeLabel?: string;
  lat: number;
  lng: number;
  area?: string;
  address?: string;
  /** Price in GBP per person. 0 = free, null/undefined = unknown. */
  price?: number | null;
  priceNote?: string;
  rating?: number;
  ratingCount?: number;
  /** null = unknown (typical for OSM data) */
  indoor?: boolean | null;
  family?: boolean | null;
  accessible?: boolean | null;
  durationMin?: number;
  groupMin?: number;
  groupMax?: number;
  tags: Tag[];
  hours?: WeeklyHours | null;
  /** Raw OSM opening_hours string, shown verbatim when it can't be parsed */
  openingHoursRaw?: string;
  summary: string;
  about?: string;
  special?: string;
  ages?: string;
  accessNote?: string;
  booking: BookingType;
  website?: string;
  phone?: string;
  sponsored?: boolean;
  deal?: string;
  events?: BusinessEvent[];
  photos?: string[];
  /** OSM reference for attribution and edit links */
  osm?: { type: "node" | "way" | "relation"; id: number };
  /** Plain-language note about what the data source does and doesn't tell us */
  provenance?: string;
  /** True when only name, type and location are known; the full record is loaded when the place is opened. */
  partial?: boolean;
}

export interface BusinessEvent {
  id: string;
  kind: "offer" | "event";
  title: string;
  details: string;
  date?: string;
}

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

export interface Prefs {
  categories: CategoryId[];
  budget: number; // max £ per person; 50 = any
  weatherSmart: boolean;
}

export interface SavedItem {
  id: string;
  savedAt: number;
  /** Snapshot so OSM places can be shown even when not in the current search area */
  snapshot: Activity;
}

export interface RecentItem {
  id: string;
  viewedAt: number;
  snapshot: Activity;
}

export interface Weather {
  code: number;
  tempC: number;
  isWet: boolean;
  isCold: boolean;
  label: string;
}
