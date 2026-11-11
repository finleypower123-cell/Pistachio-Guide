"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CloudRain, LocateFixed, MapPin, Search, Sparkles, Store, Sun } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ActivityCard } from "@/components/activity/activity-card";
import { useLocateMe } from "@/components/dialogs/location-dialog";
import { EXAMPLE_QUERIES, useRunQuery } from "@/components/dialogs/search-dialog";
import { useApp } from "@/components/providers/app-provider";
import { ActivityArt } from "@/components/ui/activity-art";
import { CAT } from "@/lib/categories";
import { distanceKm } from "@/lib/geo";
import { SHOW_DEMO } from "@/lib/preview";
import { MOODS, applyFilters, defaultFilters, score } from "@/lib/search";
import type { Activity, CategoryId } from "@/lib/types";

const HERO_CATS: { id: CategoryId; label: string }[] = [
  { id: "escape", label: "Escape rooms" },
  { id: "arcade", label: "Arcades" },
  { id: "indiecafe", label: "Indie cafés" },
  { id: "museum", label: "Museums" },
  { id: "park", label: "Parks" },
  { id: "swim", label: "Swimming" },
];

function Section({ title, sub, href, children, id }: { title: string; sub?: string; href?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="gutter mx-auto mt-16 max-w-7xl">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[2rem] font-extrabold md:text-[2.6rem]">{title}</h2>
          {sub && <p className="mt-1 max-w-xl text-ink-soft">{sub}</p>}
        </div>
        {href && (
          <Link href={href} className="hidden shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-4 py-2 text-sm font-extrabold sm:flex">
            See all <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      {children}
      {href && (
        <Link href={href} className="mt-3 inline-flex items-center gap-1 text-sm font-extrabold underline underline-offset-4 sm:hidden">
          See all <ArrowRight className="size-4" />
        </Link>
      )}
    </section>
  );
}

/** Place types that make a less ordinary day out, used for the first rail and the hero collage. */
const UNUSUAL_CATS: CategoryId[] = ["escape", "arcade", "boardgame", "bowling", "golf", "climbing", "trampoline", "water", "themepark", "icerink", "karaoke", "zoo", "boats", "historic", "museum", "art", "market", "vintage"];

function Rail({ items }: { items: Activity[] }) {
  const { osmStatus, retryOsm } = useApp();
  if (!items.length && (osmStatus === "loading" || osmStatus === "idle"))
    return (
      <div className="rail" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-[320px] rounded-[22px]" />
        ))}
      </div>
    );
  if (!items.length && osmStatus === "error")
    return (
      <p className="rounded-2xl bg-surface-2 p-5 text-ink-soft">
        Couldn&apos;t load places just now. <button type="button" onClick={retryOsm} className="font-extrabold text-ink underline">Retry</button>
      </p>
    );
  if (!items.length) return <p className="rounded-2xl bg-surface-2 p-5 text-ink-soft">Nothing here near this location yet.</p>;
  return (
    <div className="rail stagger">
      {items.map((a, i) => (
        <ActivityCard key={a.id} a={a} priority={i < 2} />
      ))}
    </div>
  );
}

export default function Home() {
  const { activities, place, weather, setLocationOpen, osmStatus, setSurpriseOpen } = useApp();
  const run = useRunQuery();
  const router = useRouter();
  const { locate, locating } = useLocateMe();
  const [q, setQ] = useState("");

  const near = useMemo(() => activities.filter((a) => distanceKm(place, a) <= 5), [activities, place]);
  // Each rail leads with places the rails above haven't shown, so the page doesn't repeat itself.
  const shown = new Set<string>();
  const top = (fn: (a: Activity) => boolean, n = 10) => {
    const ranked = near.filter(fn).sort((a, b) => score(b, place, weather) - score(a, place, weather));
    const fresh = ranked.filter((a) => !shown.has(a.id));
    const out = [...fresh, ...ranked.filter((a) => shown.has(a.id))].slice(0, n);
    out.slice(0, 4).forEach((a) => shown.add(a.id));
    return out;
  };

  const loading = osmStatus === "loading" || osmStatus === "idle";
  const unusual = top((a) =>
    SHOW_DEMO ? a.source === "demo" && (a.tags.includes("weird") || a.tags.includes("gem")) : a.tags.includes("weird") || UNUSUAL_CATS.includes(a.category),
  );
  const free = top((a) => a.price === 0);
  const real = top((a) => a.source === "osm" && a.category !== "chaincafe", 12);
  const rainy = top((a) => a.indoor === true);
  const gems = top((a) => a.tags.includes("gem") && ["indiecafe", "vintage", "boardgame", "museum", "art", "cinema"].includes(a.category));
  const under20 = top((a) => a.price != null && a.price > 0 && a.price < 20);
  const date = top((a) => a.tags.includes("date"));
  const weird = top((a) => a.tags.includes("weird"), 5);
  const featured = near.filter((a) => a.sponsored);
  const deals = near.filter((a) => a.deal);
  const collage = SHOW_DEMO
    ? (["pixel-cellar", "lost-umbrellas", "slow-clay", "paper-moon"].map((id) => activities.find((a) => a.id === id)).filter(Boolean) as Activity[])
    : // Places with a real photo first: the collage is the first thing a visitor sees.
      [...unusual, ...real.filter((a) => !unusual.includes(a))].sort((a, b) => Number(Boolean(b.photos?.length)) - Number(Boolean(a.photos?.length))).slice(0, 4);
  // Moods and example searches that would come back empty for this area aren't offered.
  const moods = loading ? MOODS : MOODS.filter((m) => applyFilters(near, { ...defaultFilters(), ...m.filters }, place).length > 0);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="gutter mx-auto grid max-w-7xl items-center gap-10 pb-6 pt-8 md:pt-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-bold">
              <Sparkles className="size-4 text-accent-ink" /> Find the fun stuff
            </p>
            <h1 className="text-[2.9rem] font-extrabold leading-[0.98] sm:text-6xl lg:text-[5.2rem]">
              Your city has{" "}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10">more fun</span>
                <span className="absolute inset-x-[-4px] bottom-[0.08em] z-0 h-[0.36em] rounded-full bg-accent" aria-hidden />
              </span>{" "}
              than you think.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft md:text-xl">
              Find hidden gems, weird little adventures and brilliant things to do near you.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(q || "something fun");
              }}
              className="mt-7 grid gap-2 rounded-[26px] bg-surface p-2 shadow-card sm:grid-cols-[1fr_auto_auto]"
            >
              <div className="flex min-w-0 items-center gap-2 px-3">
                <Search className="size-5 shrink-0 text-ink-soft" />
                <label htmlFor="hero-q" className="sr-only">What do you fancy?</label>
                <input id="hero-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="What do you fancy? “quirky café nearby”" className="min-w-0 flex-1 bg-transparent py-3 outline-none" />
              </div>
              <button type="button" onClick={() => setLocationOpen(true)} className="flex min-w-0 items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-left font-bold" aria-label={`Location: ${place.label}. Change`}>
                <MapPin className="size-5 shrink-0 text-accent-ink" />
                <span className="truncate sm:max-w-[10rem]">{place.label}</span>
              </button>
              <button type="submit" className="rounded-2xl bg-primary px-6 py-3 font-extrabold text-on-primary">Search</button>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => locate(() => router.push("/explore?sort=nearest&near=1"))}
                className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2.5 text-sm font-extrabold text-cream"
              >
                <LocateFixed className="size-4" /> {locating ? "Locating…" : "Explore nearby"}
              </button>
              {HERO_CATS.map((c) => (
                <Link key={c.id} href={`/explore?cat=${c.id}`} className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-bold hover:border-primary">
                  {c.label}
                </Link>
              ))}
              <Link href="/categories" className="px-2 text-sm font-extrabold underline underline-offset-4">All categories</Link>
            </div>

            {weather && (
              <p className="mt-5 inline-flex items-center gap-2 text-sm text-ink-soft">
                {weather.isWet ? <CloudRain className="size-4" /> : <Sun className="size-4" />}
                {weather.label}, {weather.tempC}°C in {place.label}.{" "}
                <Link href={weather.isWet ? "/explore?setting=indoor" : "/explore?mood=air"} className="font-bold text-ink underline underline-offset-2">
                  {weather.isWet ? "See indoor ideas" : "Good day to get outside"}
                </Link>
              </p>
            )}
          </div>

          {/* Editorial collage */}
          <div className="relative mx-auto hidden aspect-square w-full max-w-[520px] sm:block" aria-hidden>
            {collage.map((a, i) => {
              const pos = [
                "left-[4%] top-[2%] w-[52%] -rotate-3",
                "right-[2%] top-[10%] w-[44%] rotate-3",
                "left-[10%] bottom-[4%] w-[44%] rotate-2",
                "right-[6%] bottom-[0%] w-[48%] -rotate-2",
              ][i];
              return (
                <Link key={a.id} href={`/activity/${a.id}`} tabIndex={-1} className={`absolute ${pos} overflow-hidden rounded-[22px] bg-surface p-2 shadow-card transition hover:z-10 hover:rotate-0`}>
                  <span className="block aspect-[4/3] overflow-hidden rounded-2xl"><ActivityArt activity={a} /></span>
                  <span className="block px-1.5 pb-1 pt-2 text-[13px] font-extrabold leading-tight">{a.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
        <div className="gutter mx-auto flex max-w-7xl flex-wrap gap-2 pb-2">
          <span className="text-sm font-bold text-ink-soft">Try:</span>
          {EXAMPLE_QUERIES.slice(0, 4).map((ex) => (
            <button key={ex} type="button" onClick={() => run(ex)} className="text-sm font-semibold underline decoration-line underline-offset-4 hover:decoration-primary">
              {ex}
            </button>
          ))}
        </div>
      </section>

      <Section title="A little bit weird, a lot of fun." sub="Arcades, escape rooms, odd little museums and markets you walk past every day." href={SHOW_DEMO ? "/explore?tag=weird" : `/explore?cat=${UNUSUAL_CATS.join(",")}`}>
        <Rail items={unusual} />
      </Section>

      <Section title="Fancy doing something different?" sub="Pick how you feel. We'll handle the rest.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {moods.map((m, i) => (
            <Link key={m.id} href={`/explore?mood=${m.id}`} className={`group flex items-center gap-3 overflow-hidden rounded-[22px] p-3 transition hover:-translate-y-0.5 ${i % 3 === 0 ? "bg-accent text-forest" : i % 3 === 1 ? "bg-surface shadow-card" : "bg-forest text-cream"}`}>
              <span className="block size-14 shrink-0 overflow-hidden rounded-2xl md:size-16">
                <ActivityArt activity={{ id: `mood-${m.id}`, category: m.icon, name: m.label }} />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-lg font-bold leading-tight">{m.label}</span>
                <span className="block text-[13px] opacity-80">{m.sub}</span>
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Get off the sofa. It's free." sub="Good times that cost nothing at all." href="/explore?price=free">
        <Rail items={free} />
      </Section>

      <Section title={SHOW_DEMO ? "Real places near you" : "Things you didn't know were around the corner"} sub={`Cafés, parks, pools and venues around ${place.label}.`} href="/explore?sort=nearest">
        {osmStatus === "off" ? (
          <p className="rounded-2xl bg-osm-bg p-5 text-osm-ink">This is a preview with demo listings. In the full app, this row fills with real cafés, parks, pools and venues from OpenStreetMap.</p>
        ) : (
          <Rail items={real} />
        )}
      </Section>

      {featured.length > 0 && (
        <section className="gutter mx-auto mt-16 max-w-7xl">
          <div className="rounded-[28px] border border-dashed border-sponsor-ink/30 bg-sponsor-bg/40 p-5 md:p-7">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl font-extrabold">Featured partners</h2>
              <p className="text-sm text-ink-soft">Sponsored. These businesses pay to appear here. It never changes our rankings elsewhere.</p>
            </div>
            <div className="rail">
              {featured.map((a) => (
                <ActivityCard key={a.id} a={a} />
              ))}
            </div>
          </div>
        </section>
      )}

      <Section title="Rainy day? Sorted." sub="Warm, dry and actually fun." href="/explore?setting=indoor">
        <Rail items={rainy} />
      </Section>

      <Section title="Hidden gems worth finding" sub="Independent cafés, small venues and one-of-a-kind shops." href="/explore?tag=gem">
        <Rail items={gems} />
      </Section>

      {/* Prices and "date" or "weird" labels come from business listings, so these appear once some exist nearby. */}
      {under20.length > 0 && (
        <Section title="Under £20" sub="Good times that won't wreck your week." href="/explore?max=19">
          <Rail items={under20} />
        </Section>
      )}

      {date.length > 0 && (
        <Section title="Date night without the boring dinner" href="/explore?tag=date">
          <Rail items={date} />
        </Section>
      )}

      {weird.length > 0 && (
      <Section title="Something weird" sub="The stuff you'll be telling people about." href="/explore?tag=weird">
        {weird.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <Link href={`/activity/${weird[0].id}`} className="group relative overflow-hidden rounded-[28px] bg-forest text-cream">
              <span className="block aspect-[16/10] overflow-hidden opacity-90"><ActivityArt activity={weird[0]} className="transition duration-700 group-hover:scale-105" /></span>
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#14231a] to-transparent p-6 pt-20">
                <span className="block text-xs font-extrabold uppercase tracking-wider text-pistachio">{CAT[weird[0].category].short}</span>
                <span className="mt-1 block font-display text-3xl font-bold">{weird[0].name}</span>
                <span className="mt-1 block max-w-md text-sm opacity-85">{weird[0].special ?? weird[0].summary}</span>
              </span>
            </Link>
            <ul className="flex flex-col gap-3">
              {weird.slice(1).map((a) => (
                <li key={a.id}>
                  <Link href={`/activity/${a.id}`} className="flex items-center gap-4 rounded-[20px] bg-surface p-3 shadow-card">
                    <span className="block size-20 shrink-0 overflow-hidden rounded-2xl"><ActivityArt activity={a} /></span>
                    <span className="min-w-0">
                      <span className="block font-bold">{a.name}</span>
                      <span className="line-clamp-2 block text-sm text-ink-soft">{a.special ?? a.summary}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
      )}

      {deals.length > 0 && (
        <Section title="Local deals" sub="Offers from local businesses, only on Pistachio Guide.">
          <div className="grid gap-3 md:grid-cols-3">
            {deals.map((a) => (
              <Link key={a.id} href={`/activity/${a.id}`} className="flex items-center gap-3 rounded-[20px] border-2 border-dashed border-accent bg-surface p-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent font-display text-lg font-extrabold text-forest">%</span>
                <span className="min-w-0">
                  <span className="block font-bold">{a.name}</span>
                  <span className="block text-sm text-ink-soft">{a.deal}</span>
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <section className="gutter mx-auto mt-16 max-w-7xl">
        <div className="grid items-center gap-6 rounded-[32px] bg-forest p-7 text-cream md:grid-cols-[1fr_auto] md:p-10">
          <div>
            <h2 className="text-3xl font-extrabold md:text-4xl">Can&apos;t decide? Crack a pistachio.</h2>
            <p className="mt-2 max-w-lg opacity-85">Surprise Me picks one thing nearby that fits your budget, your taste and the weather.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setSurpriseOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-pistachio px-6 py-3.5 font-extrabold text-forest">
              <Sparkles className="size-5" /> Surprise me
            </button>
            <Link href="/business" className="inline-flex items-center gap-2 rounded-full border border-cream/30 px-6 py-3.5 font-extrabold">
              <Store className="size-5" /> List your business
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
