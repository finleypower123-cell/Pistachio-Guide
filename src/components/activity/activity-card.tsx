"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { ActivityArt } from "@/components/ui/activity-art";
import { DealBadge, PriceBadge, SourceBadge, SponsoredBadge } from "@/components/ui/badges";
import { CAT } from "@/lib/categories";
import { distanceKm, formatDistance } from "@/lib/geo";
import type { Activity } from "@/lib/types";
import { cn, priceLabel } from "@/lib/utils";
import { SaveButton } from "./save-button";

export function ActivityCard({ a, className, compact = false }: { a: Activity; className?: string; compact?: boolean }) {
  const { place } = useApp();
  const km = distanceKm(place, a);
  return (
    <article className={cn("group relative flex flex-col overflow-hidden rounded-[22px] bg-surface shadow-card transition hover:-translate-y-0.5", className)}>
      <Link href={`/activity/${a.id}`} className="absolute inset-0 z-[1]" aria-label={a.name} />
      <div className={cn("relative overflow-hidden", compact ? "aspect-[16/10]" : "aspect-[4/3]")}>
        <ActivityArt activity={a} className="transition duration-500 group-hover:scale-[1.03]" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <PriceBadge a={a} />
          {a.sponsored && <SponsoredBadge />}
          {a.deal && <DealBadge />}
        </div>
        <SaveButton a={a} className="absolute right-3 top-3" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[12px] font-bold uppercase tracking-wider text-ink-soft">
            {a.typeLabel ?? CAT[a.category].short}
          </span>
          <SourceBadge a={a} />
        </div>
        <h3 className="text-[1.15rem] font-bold">{a.name}</h3>
        {!compact && <p className="line-clamp-2 text-[14px] text-ink-soft">{a.summary}</p>}
        <div className="mt-auto flex items-center gap-3 pt-2 text-[13px] font-semibold text-ink-soft tabular">
          {a.rating != null && (
            <span className="inline-flex items-center gap-1 text-ink">
              <Star className="size-3.5 fill-accent text-accent-ink" />
              {a.rating.toFixed(1)}
            </span>
          )}
          <span>{formatDistance(km)}</span>
          <span className="ml-auto text-ink">{priceLabel(a.price)}</span>
        </div>
      </div>
    </article>
  );
}
