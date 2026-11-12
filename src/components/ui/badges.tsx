import { cn, priceLabel } from "@/lib/utils";
import type { Activity } from "@/lib/types";

const pill = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold";

export function SourceBadge({ a, className }: { a: Activity; className?: string }) {
  if (a.source === "osm")
    return <span className={cn(pill, "bg-osm-bg text-osm-ink", className)} title="Real place from OpenStreetMap">OpenStreetMap</span>;
  if (a.source === "overture")
    return <span className={cn(pill, "bg-osm-bg text-osm-ink", className)} title="Real place from Overture Maps">Overture Maps</span>;
  if (a.source === "business")
    return <span className={cn(pill, "bg-accent text-forest", className)} title="Verified by the business">Verified</span>;
  return <span className={cn(pill, "bg-demo-bg text-demo-ink", className)} title="Sample listing, not a real venue">Demo</span>;
}

export function PriceBadge({ a, className }: { a: Activity; className?: string }) {
  if (a.price === 0) return <span className={cn(pill, "bg-accent text-forest", className)}>Free</span>;
  if (a.price == null) return null;
  return <span className={cn(pill, "bg-surface text-ink", className)}>£{a.price}</span>;
}

export function SponsoredBadge({ className }: { className?: string }) {
  return <span className={cn(pill, "bg-sponsor-bg text-sponsor-ink", className)} title="A business paid for this placement">Sponsored</span>;
}

export function DealBadge({ className }: { className?: string }) {
  return <span className={cn(pill, "bg-forest text-cream", className)}>Deal</span>;
}

export { priceLabel };
