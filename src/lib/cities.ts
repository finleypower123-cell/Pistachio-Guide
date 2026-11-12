/**
 * Cities offered in the location picker. Each also has a ready-made file of its places and
 * photos (public/data/cities/<slug>.json, rebuilt weekly by scripts/build-city-data.ts), so a
 * visitor who picks one, or is close to its centre, sees places at once instead of waiting for
 * the live lookup.
 */
export interface City {
  slug: string;
  label: string;
  detail: string;
  lat: number;
  lng: number;
}

export const CITIES: City[] = [
  { slug: "london", label: "London", detail: "England", lat: 51.5145, lng: -0.0875 },
  { slug: "manchester", label: "Manchester", detail: "England", lat: 53.4808, lng: -2.2426 },
  { slug: "bristol", label: "Bristol", detail: "England", lat: 51.4545, lng: -2.5879 },
  { slug: "leeds", label: "Leeds", detail: "England", lat: 53.7997, lng: -1.5492 },
  { slug: "brighton", label: "Brighton", detail: "England", lat: 50.8225, lng: -0.1372 },
  { slug: "glasgow", label: "Glasgow", detail: "Scotland", lat: 55.8617, lng: -4.2583 },
  { slug: "edinburgh", label: "Edinburgh", detail: "Scotland", lat: 55.9533, lng: -3.1883 },
  { slug: "cardiff", label: "Cardiff", detail: "Wales", lat: 51.4816, lng: -3.1791 },
  { slug: "brussels", label: "Brussels", detail: "Belgium", lat: 50.8467, lng: 4.3525 },
  { slug: "antwerp", label: "Antwerp", detail: "Belgium", lat: 51.2194, lng: 4.4025 },
  { slug: "ghent", label: "Ghent", detail: "Belgium", lat: 51.0543, lng: 3.7174 },
  { slug: "bruges", label: "Bruges", detail: "Belgium", lat: 51.2093, lng: 3.2247 },
  { slug: "leuven", label: "Leuven", detail: "Belgium", lat: 50.8798, lng: 4.7005 },
  { slug: "liege", label: "Liège", detail: "Belgium", lat: 50.6326, lng: 5.5797 },
];

/** How far out each city file reaches, in km. Matches the default search distance. */
export const CITY_DATA_RADIUS_KM = 5;

/** The shape of public/data/cities/<slug>.json. */
export interface CityData {
  builtAt: string;
  centre: { lat: number; lng: number };
  radiusKm: number;
  /** Places with their Wikimedia photos already attached. */
  places: import("./types").Activity[];
  /** Place id to Commons file, so the photo lookup isn't repeated on the device. */
  photos: Record<string, { file: string }>;
  /** The Overture Maps release merged in, when there was one. */
  overtureRelease?: string;
}
