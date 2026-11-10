"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CloudRain, List, Loader2, Map as MapIcon, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityCard } from "@/components/activity/activity-card";
import { SaveButton } from "@/components/activity/save-button";
import { DiscoveryMap, MapLegend } from "@/components/map/discovery-map";
import { useApp } from "@/components/providers/app-provider";
import { ActivityArt } from "@/components/ui/activity-art";
import { SourceBadge } from "@/components/ui/badges";
import { Sheet } from "@/components/ui/sheet";
import { SHOW_DEMO } from "@/lib/preview";
import { CAT } from "@/lib/categories";
import { distanceKm, formatWalk } from "@/lib/geo";
import { applyFilters, availableDetails, defaultFilters, loadRangeKm, MOODS, parseQuery, RANGE_OPTIONS, relaxFilters, type Filters, type SortKey } from "@/lib/search";
import type { Activity, CategoryId, Tag } from "@/lib/types";
import { cn, priceLabel } from "@/lib/utils";
import { activeFilterChips, distanceOptions, FiltersPanel } from "./filters-panel";

/** "prices", "prices and ratings", "prices, ratings and group size". */
function listPhrase(items: string[]) {
  return items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const QUICK_CATS: CategoryId[] = ["indiecafe", "park", "swim", "leisure", "escape", "arcade", "museum", "art", "live", "climbing", "vintage", "market"];

function MapPreview({ a, onClose }: { a: Activity; onClose: () => void }) {
  const { place } = useApp();
  return (
    <div className="animate-pop relative flex gap-3 rounded-[20px] bg-surface p-2.5 shadow-card">
      <Link href={`/activity/${a.id}`} className="absolute inset-0 z-[1] rounded-[20px]" aria-label={`Open ${a.name}`} />
      <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl">
        <ActivityArt activity={a} />
      </div>
      <div className="min-w-0 flex-1 py-1 pr-8">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">{a.typeLabel ?? CAT[a.category].short}</span>
          <SourceBadge a={a} />
        </div>
        <h3 className="mt-0.5 truncate text-lg font-bold">{a.name}</h3>
        <p className="text-sm font-semibold text-ink-soft tabular">
          {priceLabel(a.price)} · {formatWalk(distanceKm(place, a))}
        </p>
        <span className="mt-1 inline-block text-sm font-extrabold text-accent-ink underline underline-offset-2">View details</span>
      </div>
      <div className="absolute right-2 top-2 z-10 flex flex-col gap-1.5">
        <button type="button" onClick={onClose} aria-label="Close preview" className="grid size-8 place-items-center rounded-full bg-surface-2">
          <X className="size-4" />
        </button>
        <SaveButton a={a} className="size-8" />
      </div>
    </div>
  );
}

export function ExploreView({ initialView = "list" }: { initialView?: "list" | "map" }) {
  const params = useSearchParams();
  const { activities, place, weather, filters, setFilters, understood, setUnderstood, osmStatus, osmError, osmCount, retryOsm, setLocationOpen } = useApp();
  const [view, setView] = useState<"list" | "map">(initialView);
  const [sheet, setSheet] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(24);
  const carousel = useRef<HTMLDivElement>(null);
  const mapBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (view !== "map" || window.innerWidth >= 768) return;
    const t = setTimeout(() => mapBox.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    return () => clearTimeout(t);
  }, [view]);

  // Deep links from the home page, nav and categories: /explore?cat=park&price=free&tag=weird&mood=cosy&q=...
  const paramKey = params.toString();
  useEffect(() => {
    if (!paramKey) return;
    const next: Filters = { ...defaultFilters() };
    const cat = params.get("cat");
    const tag = params.get("tag");
    const mood = MOODS.find((m) => m.id === params.get("mood"));
    const query = params.get("q");
    const labels: string[] = [];
    if (cat) next.categories = cat.split(",").filter((c): c is CategoryId => c in CAT);
    if (tag) next.tags = [tag as Tag];
    if (params.get("price") === "free") next.price = "free";
    if (params.get("max")) next.maxPrice = Number(params.get("max"));
    if (params.get("setting") === "indoor") next.setting = "indoor";
    if (params.get("sort") === "nearest") next.sort = "nearest";
    if (params.get("near")) next.maxDistKm = 1.5;
    if (mood) {
      Object.assign(next, mood.filters);
      labels.push(`Mood: ${mood.label}`);
    }
    if (query) {
      const p = parseQuery(query, activities);
      Object.assign(next, p.filters);
      labels.push(...p.understood);
      setQ(query);
    }
    setFilters(next);
    setUnderstood(labels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey]);

  // Filters the loaded places hold no data for are set aside, with a note saying so, instead of emptying the list.
  const relaxed = useMemo(() => relaxFilters(filters, activities), [filters, activities]);
  const results = useMemo(() => applyFilters(activities, relaxed.filters, place, weather), [activities, relaxed, place, weather]);
  const chips = activeFilterChips(filters);
  const selectedA = results.find((a) => a.id === selected) ?? null;

  useEffect(() => setVisible(24), [filters, place]);

  // Scroll the mobile carousel to the selected marker
  useEffect(() => {
    if (!selected || !carousel.current) return;
    carousel.current.querySelector<HTMLElement>(`[data-id="${selected}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selected]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseQuery(q, activities);
    // A new search keeps the chosen distance unless the search itself names one ("walking distance").
    setFilters({ ...defaultFilters(), sort: filters.sort, sources: filters.sources, maxDistKm: filters.maxDistKm, ...p.filters });
    setUnderstood(p.understood);
  };

  const title = filters.price === "free" && chips.length === 1 ? "Free things to do" : "Explore";

  const has = useMemo(() => availableDetails(activities), [activities]);
  const quickCats = activities.length ? QUICK_CATS.filter((c) => has.categories.has(c) || filters.categories.includes(c)) : QUICK_CATS;
  const widerKm = RANGE_OPTIONS.find((km) => km > filters.maxDistKm);
  // The five most common kinds of place loaded, offered when a search comes back empty.
  const nearbyKinds = useMemo(() => {
    const counts = new Map<CategoryId, number>();
    for (const a of activities) if (a.category !== "chaincafe") counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    return [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5);
  }, [activities]);
  // The map stays quick with a couple of hundred pins; the list holds everything.
  const onMap = useMemo(() => results.slice(0, 200), [results]);
  const mapZoom = { 5: 13.4, 10: 11.6, 25: 10.3 }[loadRangeKm(filters.maxDistKm)] ?? 13.4;

  const statusLine =
    osmStatus === "loading" ? (
      <span className="inline-flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" /> {osmCount ? "Finding more places…" : "Finding places near you…"}</span>
    ) : osmStatus === "error" ? (
      <span>
        {osmError} <button type="button" onClick={retryOsm} className="font-extrabold underline">Retry</button>
      </span>
    ) : osmStatus === "off" ? (
      <span>Preview: demo listings only. Real OpenStreetMap places load in the full app.</span>
    ) : osmStatus === "ok" && SHOW_DEMO ? (
      <span>{osmCount} real places from OpenStreetMap, plus demo listings</span>
    ) : null;

  return (
    <div className="gutter mx-auto max-w-7xl pb-10 pt-6">
      <div className="flex flex-col gap-4">
        <div className={cn("flex flex-wrap items-end justify-between gap-3", view === "map" && "max-md:hidden")}>
          <div>
            <h1 className="text-4xl font-extrabold md:text-5xl">{title}</h1>
            <p className="mt-1 text-ink-soft">
              Around{" "}
              <button type="button" onClick={() => setLocationOpen(true)} className="font-bold text-ink underline decoration-accent decoration-2 underline-offset-4">
                {place.label}
              </button>
              , within{" "}
              <label htmlFor="range" className="sr-only">Search distance</label>
              <select
                id="range"
                value={filters.maxDistKm}
                onChange={(e) => setFilters((p) => ({ ...p, maxDistKm: Number(e.target.value) }))}
                className="rounded-full border border-line bg-surface py-1 pl-2.5 pr-1 text-sm font-bold text-ink"
              >
                {distanceOptions(filters.maxDistKm).map(([km, label]) => (
                  <option key={km} value={km}>{label}</option>
                ))}
              </select>
            </p>
          </div>
          {statusLine && <p className="text-[13px] text-ink-soft" aria-live="polite">{statusLine}</p>}
        </div>

        <form onSubmit={submit} className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-1.5 pl-4 shadow-card focus-within:border-primary">
          <Search className="size-5 shrink-0 text-ink-soft" />
          <label htmlFor="explore-q" className="sr-only">Search in plain English</label>
          <input id="explore-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “quirky café nearby” or “museum for a rainy day”" className="min-w-0 flex-1 bg-transparent py-2.5 outline-none" />
          <button type="submit" className="rounded-xl bg-primary px-4 py-2.5 font-extrabold text-on-primary">Search</button>
        </form>

        {understood.length > 0 && (
          <p className="text-sm text-ink-soft">
            Understood: <span className="font-bold text-ink">{understood.join(" · ")}</span>
          </p>
        )}

        {relaxed.ignored.length > 0 && (
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-soft" role="status">
            We don&apos;t know {listPhrase(relaxed.ignored)} for places around here yet, so we&apos;ve left that out and shown everything else that fits.
          </p>
        )}

        {weather?.isWet && filters.setting !== "indoor" && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-osm-bg px-4 py-3 text-sm text-osm-ink">
            <CloudRain className="size-5" />
            <span className="font-bold">{weather.label}, {weather.tempC}°C in {place.label}. Indoor places are ranked higher.</span>
            <button type="button" onClick={() => setFilters((p) => ({ ...p, setting: "indoor" }))} className="ml-auto rounded-full bg-surface px-3 py-1.5 font-extrabold text-ink">
              Indoors only
            </button>
          </div>
        )}

        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {quickCats.map((c) => {
            const on = filters.categories.length === 1 && filters.categories[0] === c;
            return (
              <button key={c} type="button" aria-pressed={on}
                onClick={() => setFilters((p) => ({ ...p, categories: on ? [] : [c] }))}
                className={cn("shrink-0 rounded-full border px-3.5 py-2 text-sm font-bold", on ? "border-primary bg-primary text-on-primary" : "border-line bg-surface")}>
                {CAT[c].label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-[22px] bg-surface p-5 shadow-card">
            <FiltersPanel />
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <p className="mr-auto font-bold tabular" aria-live="polite">{results.length} {results.length === 1 ? "place" : "places"}</p>
            <button type="button" onClick={() => setSheet(true)} className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-extrabold lg:hidden">
              <SlidersHorizontal className="size-4" /> Filters{chips.length ? ` (${chips.length})` : ""}
            </button>
            <label htmlFor="sort" className="sr-only">Sort by</label>
            <select id="sort" value={filters.sort} onChange={(e) => setFilters((p) => ({ ...p, sort: e.target.value as SortKey }))} className="rounded-full border border-line bg-surface px-3 py-2 text-sm font-bold">
              <option value="best">Best match</option>
              <option value="nearest">Nearest</option>
              {(has.paid || filters.sort === "cheapest") && <option value="cheapest">Cheapest</option>}
              {(has.rating || filters.sort === "rating") && <option value="rating">Top rated</option>}
            </select>
            <div className="flex rounded-full border border-line bg-surface p-1" role="group" aria-label="View">
              <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-extrabold", view === "list" && "bg-primary text-on-primary")}>
                <List className="size-4" /> List
              </button>
              <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-extrabold", view === "map" && "bg-primary text-on-primary")}>
                <MapIcon className="size-4" /> Map
              </button>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button key={c.label} type="button" onClick={() => setFilters(c.clear)} className="flex items-center gap-1 rounded-full bg-surface-2 py-1.5 pl-3 pr-2 text-sm font-bold" aria-label={`Remove filter ${c.label}`}>
                  {c.label} <X className="size-3.5" />
                </button>
              ))}
              <button type="button" onClick={() => { setFilters({ ...defaultFilters(), sort: filters.sort }); setUnderstood([]); }} className="px-2 text-sm font-extrabold underline">
                Clear all
              </button>
            </div>
          )}

          {/* The map always shows, even with nothing on it, so it can be moved to search elsewhere. */}
          {view === "list" && results.length === 0 && (osmStatus === "loading" || osmStatus === "idle") ? (
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3" aria-busy="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-[22px] bg-surface-2 sm:h-[320px]" />
              ))}
            </div>
          ) : view === "list" && results.length === 0 && osmStatus === "error" && activities.length === 0 ? (
            <div className="rounded-[22px] bg-surface p-8 text-center shadow-card">
              <p className="font-display text-2xl font-bold">Couldn&apos;t load places just now.</p>
              <p className="mt-2 text-ink-soft">The free map services we use are busy. It usually works again within a minute.</p>
              <button type="button" onClick={retryOsm} className="mt-4 rounded-full bg-primary px-5 py-2.5 font-extrabold text-on-primary">Try again</button>
            </div>
          ) : view === "list" && activities.length === 0 ? (
            <div className="rounded-[22px] bg-surface p-8 text-center shadow-card">
              <p className="font-display text-2xl font-bold">No places found around {place.label}.</p>
              <p className="mt-2 text-ink-soft">Try a wider distance or a different location.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {widerKm && (
                  <button type="button" onClick={() => setFilters((p) => ({ ...p, maxDistKm: widerKm }))} className="rounded-full border border-line px-3 py-1.5 text-sm font-bold">Widen to {widerKm} km</button>
                )}
                <button type="button" onClick={() => setLocationOpen(true)} className="rounded-full border border-line px-3 py-1.5 text-sm font-bold">Change location</button>
              </div>
            </div>
          ) : view === "list" && results.length === 0 ? (
            <div className="rounded-[22px] bg-surface p-8 text-center shadow-card">
              <p className="font-display text-2xl font-bold">Nothing matches all of that.</p>
              <p className="mt-2 text-ink-soft">Try removing a filter or widening the distance.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {chips.slice(0, 4).map((c) => (
                  <button key={c.label} type="button" onClick={() => setFilters(c.clear)} className="rounded-full border border-line px-3 py-1.5 text-sm font-bold">
                    Remove “{c.label}”
                  </button>
                ))}
                {widerKm && (
                  <button type="button" onClick={() => setFilters((p) => ({ ...p, maxDistKm: widerKm }))} className="rounded-full border border-line px-3 py-1.5 text-sm font-bold">Widen to {widerKm} km</button>
                )}
              </div>
              {/* What there actually is nearby, so an empty search still leads somewhere */}
              {nearbyKinds.length > 0 && (
                <div className="mt-6 border-t border-line pt-5">
                  <p className="text-sm font-bold text-ink-soft">Or see what&apos;s around {place.label}</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {nearbyKinds.map(([c, n]) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setQ("");
                          setUnderstood([]);
                          setFilters({ ...defaultFilters(), sort: filters.sort, sources: filters.sources, maxDistKm: filters.maxDistKm, categories: [c] });
                        }}
                        className="rounded-full bg-surface-2 px-3 py-1.5 text-sm font-bold text-ink"
                      >
                        {CAT[c].label} <span className="font-semibold opacity-70">{n}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : view === "list" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                {results.slice(0, visible).map((a) => (
                  <ActivityCard key={a.id} a={a} row />
                ))}
              </div>
              {visible < results.length && (
                <div className="mt-8 text-center">
                  <button type="button" onClick={() => setVisible((v) => v + 24)} className="rounded-full border border-line bg-surface px-6 py-3 font-extrabold">
                    Show more ({results.length - visible} left)
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <div ref={mapBox} className="relative h-[calc(100dvh-230px)] min-h-[340px] scroll-mt-20 md:h-[62dvh] md:min-h-[420px] lg:h-[calc(100dvh-14rem)]">
                <DiscoveryMap activities={onMap} selectedId={selected} onSelect={setSelected} className="h-full" zoom={mapZoom} searchArea />
                {selectedA ? (
                  <div className="absolute inset-x-3 bottom-3 z-10 md:max-w-md">
                    <MapPreview a={selectedA} onClose={() => setSelected(null)} />
                  </div>
                ) : (
                  /* Swipeable cards over the map on phones; tap one to focus its marker */
                  <div ref={carousel} className="no-scrollbar absolute inset-x-0 bottom-3 z-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 md:hidden">
                    {onMap.slice(0, 40).map((a) => (
                      <button key={a.id} data-id={a.id} type="button" onClick={() => setSelected(a.id)}
                        className="flex w-[80%] shrink-0 snap-center gap-3 rounded-2xl bg-surface p-2 text-left shadow-card">
                        <span className="block size-16 shrink-0 overflow-hidden rounded-xl"><ActivityArt activity={a} /></span>
                        <span className="min-w-0 py-0.5">
                          <span className="block truncate font-bold">{a.name}</span>
                          <span className="block truncate text-xs font-semibold text-ink-soft">{a.typeLabel ?? CAT[a.category].short} · {formatWalk(distanceKm(place, a))}</span>
                          {a.price != null && <span className="block text-xs font-extrabold">{priceLabel(a.price)}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <MapLegend />
            </div>
          )}
        </section>
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filters">
        <FiltersPanel />
        <button type="button" onClick={() => setSheet(false)} className="sticky bottom-0 mt-5 w-full rounded-full bg-primary py-3.5 font-extrabold text-on-primary">
          Show {results.length} places
        </button>
      </Sheet>
    </div>
  );
}

