import type { Activity } from "./types";

/**
 * Affiliate booking architecture. A partner adapter turns a listing into a tracked outbound URL.
 * Demo listings have no real partner, so `url` is null and the UI says so instead of pretending.
 */
export interface BookingLink {
  partner: string;
  url: string | null;
  trackingPreview: string;
}

const AFF_ID = process.env.NEXT_PUBLIC_AFFILIATE_ID ?? "pistachio-demo";

export function bookingLink(a: Activity, placement: "card" | "detail" | "surprise"): BookingLink {
  const params = new URLSearchParams({
    aff: AFF_ID,
    utm_source: "pistachioguide",
    utm_medium: "affiliate",
    utm_campaign: a.category,
    utm_content: placement,
  });
  if (a.source !== "demo" && a.website) {
    const u = new URL(a.website);
    params.forEach((v, k) => u.searchParams.set(k, v));
    return { partner: "Venue website", url: u.toString(), trackingPreview: u.toString() };
  }
  return {
    partner: "Booking partner (not connected in demo)",
    url: null,
    trackingPreview: `https://partner.example/book/${a.id}?${params.toString()}`,
  };
}
