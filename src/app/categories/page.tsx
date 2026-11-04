"use client";

import Link from "next/link";
import { useApp } from "@/components/providers/app-provider";
import { ActivityArt } from "@/components/ui/activity-art";
import { CATEGORIES, COLLECTIONS } from "@/lib/categories";
import { distanceKm } from "@/lib/geo";

export default function CategoriesPage() {
  const { activities, place } = useApp();
  const near = activities.filter((a) => distanceKm(place, a) <= 5);
  return (
    <div className="gutter mx-auto max-w-7xl pb-10 pt-8">
      <h1 className="text-4xl font-extrabold md:text-5xl">Categories</h1>
      <p className="mt-2 text-ink-soft">Everything we track around {place.label}.</p>

      <h2 className="mb-4 mt-10 text-2xl font-extrabold">Collections</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {COLLECTIONS.map((c) => (
          <Link key={c.id} href={`/explore?tag=${c.id}`} className="rounded-[20px] bg-forest p-4 text-cream transition hover:-translate-y-0.5">
            <span className="block font-display text-lg font-bold leading-tight">{c.label}</span>
            <span className="mt-1 block text-xs opacity-80">{c.blurb}</span>
          </Link>
        ))}
      </div>

      <h2 className="mb-4 mt-10 text-2xl font-extrabold">Activity types</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {CATEGORIES.map((c) => {
          const n = near.filter((a) => a.category === c.id).length;
          return (
            <Link key={c.id} href={`/explore?cat=${c.id}`} className="group overflow-hidden rounded-[22px] bg-surface shadow-card transition hover:-translate-y-0.5">
              <span className="block aspect-[16/10] overflow-hidden">
                <ActivityArt activity={{ id: `cat-${c.id}`, category: c.id, name: c.label }} className="transition duration-500 group-hover:scale-105" />
              </span>
              <span className="flex items-center justify-between gap-2 p-3.5">
                <span className="font-bold leading-tight">{c.label}</span>
                <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-extrabold tabular">{n}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
