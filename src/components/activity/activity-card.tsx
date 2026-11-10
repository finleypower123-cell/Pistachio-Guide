"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { ActivityArt } from "@/components/ui/activity-art";
import { DealBadge, PriceBadge, SourceBadge, SponsoredBadge } from "@/components/ui/badges";
import { CAT } from "@/lib/categories";
import { distanceKm, formatDistance } from "@/lib/geo";
import { openStatus } from "@/lib/hours";
import { SHOW_DEMO } from "@/lib/preview";
import type { Activity } from "@/lib/types";
import { cn, priceLabel } from "@/lib/utils";
import { SaveButton } from "./save-button";

/**
 * A place card. With `row`, phones get a compact row (small picture beside the text) so a list
 * shows several places per screen; larger screens keep the full card.
 */
export function ActivityCard({ a, className, compact = false, row = false }: { a: Activity; className?: string; compact?: boolean; row?: boolean }) {
  const { place } = useApp();
  const km = distanceKm(place, a);
  const status = a.hours ? openStatus(a.hours) : null;
  return (
    <article className={cn("group relative flex overflow-hidden rounded-[22px] bg-surface shadow-card transition hover:-translate-y-0.5", row ? "flex-row sm:flex-col" : "flex-col", className)}>
      <Link href={`/activity/${a.id}`} className="absolute inset-0 z-[1]" aria-label={a.name} />
      <div className={cn("relative overflow-hidden", row ? "w-28 shrink-0 self-stretch sm:aspect-[4/3] sm:w-auto" : compact ? "aspect-[16/10]" : "aspect-[4/3]")}>
        <ActivityArt activity={a} className="transition duration-500 group-hover:scale-[1.03]" />
        <div className={cn("absolute flex flex-wrap gap-1.5", row ? "left-2 top-2 sm:left-3 sm:top-3" : "left-3 top-3")}>
          <PriceBadge a={a} />
          {a.sponsored && <SponsoredBadge />}
          {a.deal && <DealBadge />}
        </div>
      </div>
      <SaveButton a={a} className={cn("absolute", row ? "right-2 top-2 sm:right-3 sm:top-3" : "right-3 top-3")} />
      <div className={cn("flex min-w-0 flex-1 flex-col gap-1.5", row ? "p-3 pr-14 sm:p-4" : "p-4")}>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[12px] font-bold uppercase tracking-wider text-ink-soft">
            {a.typeLabel ?? CAT[a.category].short}
          </span>
          {/* Every place on the live site is real, so only verified business listings need a badge. */}
          {(SHOW_DEMO || a.source === "business") && <SourceBadge a={a} />}
        </div>
        <h3 className={cn("font-bold", row ? "text-[1.05rem] leading-snug sm:text-[1.15rem]" : "text-[1.15rem]")}>{a.name}</h3>
        {!compact && !a.partial && <p className={cn("line-clamp-2 text-[14px] text-ink-soft", row && "max-sm:hidden")}>{a.summary}</p>}
        {a.partial && a.address && <p className="line-clamp-1 text-[14px] text-ink-soft">{a.address}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-1 text-[13px] font-semibold text-ink-soft tabular">
          {a.rating != null && (
            <span className="inline-flex items-center gap-1 text-ink">
              <Star className="size-3.5 fill-accent text-accent-ink" />
              {a.rating.toFixed(1)}
            </span>
          )}
          <span>{formatDistance(km)}</span>
          {status && status.open !== null && <span className={status.open ? "text-accent-ink" : undefined}>{status.text}</span>}
          {a.price != null && <span className="ml-auto text-ink">{priceLabel(a.price)}</span>}
        </div>
      </div>
    </article>
  );
}
