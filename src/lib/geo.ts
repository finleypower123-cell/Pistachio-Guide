import type { Place } from "./types";

export const DEFAULT_PLACE: Place = { label: "London", lat: 51.5145, lng: -0.0875 };

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Move a point east/north by a number of kilometres. */
export function offsetKm(origin: { lat: number; lng: number }, eastKm: number, northKm: number) {
  const lat = origin.lat + (northKm / R) * (180 / Math.PI);
  const lng = origin.lng + ((eastKm / R) * (180 / Math.PI)) / Math.cos(rad(origin.lat));
  return { lat, lng };
}

export const walkMinutes = (km: number) => Math.max(1, Math.round((km / 4.8) * 60));

export function formatDistance(km: number) {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function formatWalk(km: number) {
  const m = walkMinutes(km);
  return m <= 45 ? `${m} min walk` : `${formatDistance(km)} away`;
}
