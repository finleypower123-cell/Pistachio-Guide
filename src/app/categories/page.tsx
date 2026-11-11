"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useApp } from "@/components/providers/app-provider";
import { ActivityArt } from "@/components/ui/activity-art";
import { CATEGORIES, COLLECTIONS } from "@/lib/categories";
import { distanceKm } from "@/lib/geo";
import { availableDetails } from "@/lib/search";

export default function CategoriesPage() {
  const { activities, place, osmStatus } = useApp();
  const loading = osmStatus === "loading" || osmStatus === "idle";
  const near = useMemo(() => activities.filter((a) => distanceKm(place, a) <= 5), [activities, place]);
  const has = useMemo(() => availableDetails(near), [near]);

  // Kinds of place found nearby come first, busiest first. Kinds with nothing nearby are listed
  // separately as plain text, so no tile leads to an empty page.
  const counted = CATEGORIES.map((c) => ({ c, n: near.filter((a) => a.category === c.id).length }));
  const found = counted.filter((x) => x.n > 0).sort((x, y) => y.n - x.n);
  const missing = counted.filter((x) => x.n === 0);
  const tiles = loading && !near.length ? counted : found;
  const collections = COLLECTIONS.filter((c) => (loading && !near.length) || has.tags.has(c.id));

  return (
    <div className="gutter mx-auto max-w-7xl pb-10 pt-8">
      <h1 className="text-4xl font-extrabold md:text-5xl">What do you fancy?</h1>
      <p className="mt-2 text-ink-soft">Everything we&apos;ve found within 5 km of {place.label}.</p>

      {collections.length > 0 && (
        <>
          <h2 className="mb-4 mt-10 text-2xl font-extrabold">Collections</h2>
          <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-4">
            {collections.map((c) => (
              <Link key={c.id} href={`/explore?tag=${c.id}`} className="rounded-[20px] bg-forest p-4 text-cream transition hover:-translate-y-0.5">
                <span className="block font-display text-lg font-bold leading-tight">{c.label}</span>
                <span className="mt-1 block text-xs opacity-80">{c.blurb}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className="mb-4 mt-10 text-2xl font-extrabold">Kinds of place</h2>
      {tiles.length > 0 ? (
        <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map(({ c, n }) => (
            <Link key={c.id} href={`/explore?cat=${c.id}`} className="tilt-on-hover group overflow-hidden rounded-[22px] bg-surface shadow-card transition hover:-translate-y-0.5">
              <span className="block aspect-[16/10] overflow-hidden">
                <ActivityArt activity={{ id: `cat-${c.id}`, category: c.id, name: c.label }} className="tilt transition duration-500 group-hover:scale-105" />
              </span>
              <span className="flex items-center justify-between gap-2 p-3.5">
                <span className="font-bold leading-tight">{c.label}</span>
                {n > 0 && <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-extrabold tabular">{n}</span>}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-surface-2 p-5 text-ink-soft">Nothing found around here yet. Try a different location.</p>
      )}

      {!loading && found.length > 0 && missing.length > 0 && (
        <p className="mt-8 text-sm text-ink-soft">
          Nothing nearby yet for: {missing.map((x) => x.c.label.toLowerCase()).join(", ")}. Widen the distance on Explore, or search another area.
        </p>
      )}
    </div>
  );
}
