"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { useUser } from "@/components/providers/user-provider";
import { ActivityArt } from "@/components/ui/activity-art";
import { PistachioMark } from "@/components/ui/logo";
import { SourceBadge } from "@/components/ui/badges";
import { Sheet } from "@/components/ui/sheet";
import { CAT } from "@/lib/categories";
import { distanceKm, formatWalk } from "@/lib/geo";
import { surprisePick } from "@/lib/search";
import type { Activity } from "@/lib/types";
import { priceLabel } from "@/lib/utils";
import { SaveButton } from "@/components/activity/save-button";

export function SurpriseDialog() {
  const { surpriseOpen, setSurpriseOpen, activities, place, weather } = useApp();
  const { prefs } = useUser();
  const [pick, setPick] = useState<Activity | null>(null);
  const [cracking, setCracking] = useState(false);
  const [empty, setEmpty] = useState(false);

  const crack = (avoid?: string) => {
    setCracking(true);
    setEmpty(false);
    setTimeout(() => {
      const p = surprisePick(activities, place, prefs, weather, avoid);
      setPick(p);
      setEmpty(!p);
      setCracking(false);
    }, 900);
  };

  useEffect(() => {
    if (surpriseOpen) crack();
    else setPick(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surpriseOpen]);

  const reasons = [
    prefs.budget < 50 ? `under £${prefs.budget}` : "any budget",
    `near ${place.label}`,
    prefs.categories.length ? `you like ${prefs.categories.slice(0, 2).map((c) => CAT[c].short.toLowerCase()).join(" & ")}` : null,
    prefs.weatherSmart && weather?.isWet ? "it's wet out, so indoors" : null,
  ].filter(Boolean);

  return (
    <Sheet open={surpriseOpen} onClose={() => setSurpriseOpen(false)} title="Surprise me">
      {cracking || (!pick && !empty) ? (
        <div className="grid place-items-center py-10 text-center">
          <PistachioMark className="animate-shake size-24" />
          <p className="mt-5 font-display text-xl font-bold">Cracking a pistachio…</p>
        </div>
      ) : empty ? (
        <div className="py-8 text-center">
          <p className="font-bold">Nothing fits your budget and preferences nearby.</p>
          <p className="mt-1 text-sm text-ink-soft">Raise your budget in your profile or try another location.</p>
          <Link href="/profile" onClick={() => setSurpriseOpen(false)} className="mt-4 inline-block rounded-full bg-primary px-5 py-3 font-extrabold text-on-primary">
            Edit preferences
          </Link>
        </div>
      ) : (
        pick && (
          <div className="animate-pop">
            <div className="relative aspect-[16/10] overflow-hidden rounded-3xl">
              <ActivityArt activity={pick} />
              <SaveButton a={pick} className="absolute right-3 top-3" />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-ink-soft">{pick.typeLabel ?? CAT[pick.category].short}</span>
              <SourceBadge a={pick} />
            </div>
            <h3 className="mt-1 text-3xl font-bold">{pick.name}</h3>
            <p className="mt-2 text-ink-soft">{pick.summary}</p>
            <p className="mt-3 text-sm font-bold tabular">
              {priceLabel(pick.price)} · {formatWalk(distanceKm(place, pick))}
            </p>
            <p className="mt-3 text-xs text-ink-soft">Picked for: {reasons.join(", ")}.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => crack(pick.id)} className="flex items-center justify-center gap-2 rounded-full border border-line bg-surface py-3 font-extrabold">
                <RefreshCw className="size-4" /> Another
              </button>
              <Link href={`/activity/${pick.id}`} onClick={() => setSurpriseOpen(false)} className="rounded-full bg-primary py-3 text-center font-extrabold text-on-primary">
                Let&apos;s go
              </Link>
            </div>
          </div>
        )
      )}
    </Sheet>
  );
}
