"use client";

import Link from "next/link";
import { useState } from "react";
import { ActivityCard } from "@/components/activity/activity-card";
import { DiscoveryMap } from "@/components/map/discovery-map";
import { useApp } from "@/components/providers/app-provider";
import { useUser } from "@/components/providers/user-provider";
import { cn } from "@/lib/utils";

export default function SavedPage() {
  const { saved, recent, cloud, clearRecent } = useUser();
  const { findActivity } = useApp();
  const [view, setView] = useState<"list" | "map">("list");
  const [sel, setSel] = useState<string | null>(null);
  // Prefer the live version (with current overlays); fall back to the saved snapshot
  const items = saved.map((s) => findActivity(s.id) ?? s.snapshot);
  const recents = recent.map((r) => findActivity(r.id) ?? r.snapshot).slice(0, 12);

  return (
    <div className="gutter mx-auto max-w-7xl pb-10 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-extrabold md:text-5xl">Saved</h1>
          <p className="mt-1 text-ink-soft">
            {cloud ? "Synced to your account." : (
              <>Saved on this device. <Link href="/profile" className="font-bold text-ink underline">Sign in</Link> to keep them everywhere.</>
            )}
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex rounded-full border border-line bg-surface p-1" role="group" aria-label="View">
            {(["list", "map"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn("rounded-full px-4 py-1.5 text-sm font-extrabold capitalize", view === v && "bg-primary text-on-primary")}>
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-[24px] bg-surface p-10 text-center shadow-card">
          <p className="font-display text-2xl font-bold">Nothing saved yet.</p>
          <p className="mt-2 text-ink-soft">Tap the heart on anything you like and it lands here.</p>
          <Link href="/explore" className="mt-5 inline-block rounded-full bg-primary px-6 py-3 font-extrabold text-on-primary">Start exploring</Link>
        </div>
      ) : view === "list" ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((a) => <ActivityCard key={a.id} a={a} />)}
        </div>
      ) : (
        <div className="mt-6 h-[60dvh] min-h-[360px]">
          <DiscoveryMap activities={items} selectedId={sel} onSelect={setSel} showWalkRing={false} className="h-full" />
          {sel && (
            <Link href={`/activity/${sel}`} className="mt-3 inline-block rounded-full bg-primary px-5 py-2.5 font-extrabold text-on-primary">
              Open {items.find((a) => a.id === sel)?.name}
            </Link>
          )}
        </div>
      )}

      {recents.length > 0 && (
        <section className="mt-14">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-2xl font-extrabold">Recently viewed</h2>
            <button type="button" onClick={clearRecent} className="text-sm font-extrabold underline">Clear</button>
          </div>
          <div className="rail">
            {recents.map((a) => <ActivityCard key={a.id} a={a} compact />)}
          </div>
        </section>
      )}
    </div>
  );
}
