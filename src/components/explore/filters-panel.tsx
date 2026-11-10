"use client";

import { useApp } from "@/components/providers/app-provider";
import { CATEGORIES, COLLECTIONS } from "@/lib/categories";
import { SHOW_DEMO } from "@/lib/preview";
import { defaultFilters, type Filters } from "@/lib/search";
import type { CategoryId, Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

function Seg<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-extrabold uppercase tracking-wider text-ink-soft">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([v, l]) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-bold transition",
              value === v ? "border-primary bg-primary text-on-primary" : "border-line bg-surface hover:border-ink-soft",
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ label, checked, onChange, id }: { label: string; checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 py-1 font-bold">
      {label}
      <span className="relative">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="block h-7 w-12 rounded-full bg-line transition peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
        <span className="absolute left-1 top-1 size-5 rounded-full bg-surface shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function FiltersPanel() {
  const { filters: f, setFilters } = useApp();
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((p) => ({ ...p, [k]: v }));
  const toggleCat = (c: CategoryId) =>
    setFilters((p) => ({ ...p, categories: p.categories.includes(c) ? p.categories.filter((x) => x !== c) : [...p.categories, c] }));
  const toggleTag = (t: Tag) => setFilters((p) => ({ ...p, tags: p.tags.includes(t) ? p.tags.filter((x) => x !== t) : [...p.tags, t] }));

  return (
    <div className="flex flex-col gap-6">
      <Seg label="Price" value={f.price} options={[["any", "Any"], ["free", "Free"], ["paid", "Paid"]]} onChange={(v) => set("price", v)} />
      <div>
        <label htmlFor="f-maxprice" className="mb-2 flex justify-between text-[13px] font-extrabold uppercase tracking-wider text-ink-soft">
          Budget per person <span className="text-ink tabular">{f.maxPrice >= 50 ? "Any" : `Up to £${f.maxPrice}`}</span>
        </label>
        <input id="f-maxprice" type="range" min={0} max={50} step={1} value={f.maxPrice} onChange={(e) => set("maxPrice", Number(e.target.value))} className="w-full accent-[var(--primary)]" />
      </div>
      <div>
        <label htmlFor="f-dist" className="mb-2 flex justify-between text-[13px] font-extrabold uppercase tracking-wider text-ink-soft">
          Distance <span className="text-ink tabular">Within {f.maxDistKm} km</span>
        </label>
        <input id="f-dist" type="range" min={0.5} max={5} step={0.5} value={f.maxDistKm} onChange={(e) => set("maxDistKm", Number(e.target.value))} className="w-full accent-[var(--primary)]" />
      </div>
      <Seg label="When" value={f.openAt} options={[["any", "Any time"], ["now", "Open now"], ["afternoon", "This afternoon"], ["evening", "Tonight"]]} onChange={(v) => set("openAt", v)} />
      <Seg label="Time available" value={f.maxDurationMin} options={[[0, "Any"], [60, "≤ 1 hr"], [120, "≤ 2 hrs"], [180, "≤ 3 hrs"]]} onChange={(v) => set("maxDurationMin", v)} />
      <Seg label="Setting" value={f.setting} options={[["any", "Either"], ["indoor", "Indoors"], ["outdoor", "Outdoors"]]} onChange={(v) => set("setting", v)} />
      <Seg label="Group size" value={f.group} options={[[0, "Any"], [2, "2"], [4, "4"], [6, "6"], [8, "8+"]]} onChange={(v) => set("group", v)} />
      <Seg label="Rating" value={f.minRating} options={[[0, "Any"], [4, "4.0+"], [4.5, "4.5+"]]} onChange={(v) => set("minRating", v)} />
      <div className="flex flex-col gap-1">
        <Toggle id="f-family" label="Family-friendly" checked={f.family} onChange={(v) => set("family", v)} />
        <Toggle id="f-access" label="Wheelchair accessible" checked={f.accessible} onChange={(v) => set("accessible", v)} />
      </div>
      <fieldset>
        <legend className="mb-2 text-[13px] font-extrabold uppercase tracking-wider text-ink-soft">Collections</legend>
        <div className="flex flex-wrap gap-1.5">
          {COLLECTIONS.map((c) => (
            <button key={c.id} type="button" aria-pressed={f.tags.includes(c.id)} onClick={() => toggleTag(c.id)}
              className={cn("rounded-full border px-3 py-1.5 text-sm font-bold", f.tags.includes(c.id) ? "border-primary bg-primary text-on-primary" : "border-line bg-surface")}>
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-[13px] font-extrabold uppercase tracking-wider text-ink-soft">Activity type</legend>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" aria-pressed={f.categories.includes(c.id)} onClick={() => toggleCat(c.id)}
              className={cn("rounded-full border px-3 py-1.5 text-sm font-bold", f.categories.includes(c.id) ? "border-primary bg-primary text-on-primary" : "border-line bg-surface")}>
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>
      {SHOW_DEMO && (
        <fieldset>
          <legend className="mb-2 text-[13px] font-extrabold uppercase tracking-wider text-ink-soft">Sources</legend>
          <div className="flex flex-col gap-1">
            <Toggle id="f-osm" label="Real places (OpenStreetMap)" checked={f.sources.osm} onChange={(v) => set("sources", { ...f.sources, osm: v })} />
            <Toggle id="f-demo" label="Demo listings" checked={f.sources.demo} onChange={(v) => set("sources", { ...f.sources, demo: v })} />
          </div>
        </fieldset>
      )}
      <button type="button" onClick={() => setFilters({ ...defaultFilters(), sort: f.sort })} className="rounded-full border border-line py-3 font-extrabold">
        Reset filters
      </button>
    </div>
  );
}

/** Short labels for the active filters, each with a way to clear it. */
export function activeFilterChips(f: Filters): { label: string; clear: (p: Filters) => Filters }[] {
  const d = defaultFilters();
  const out: { label: string; clear: (p: Filters) => Filters }[] = [];
  if (f.text) out.push({ label: `“${f.text}”`, clear: (p) => ({ ...p, text: "" }) });
  if (f.price !== "any") out.push({ label: f.price === "free" ? "Free" : "Paid", clear: (p) => ({ ...p, price: "any" }) });
  if (f.maxPrice < 50) out.push({ label: `Under £${f.maxPrice}`, clear: (p) => ({ ...p, maxPrice: 50 }) });
  if (f.maxDistKm !== d.maxDistKm) out.push({ label: `Within ${f.maxDistKm} km`, clear: (p) => ({ ...p, maxDistKm: d.maxDistKm }) });
  if (f.openAt !== "any") out.push({ label: { now: "Open now", afternoon: "This afternoon", evening: "Tonight" }[f.openAt], clear: (p) => ({ ...p, openAt: "any" }) });
  if (f.maxDurationMin) out.push({ label: `≤ ${f.maxDurationMin / 60} hr`, clear: (p) => ({ ...p, maxDurationMin: 0 }) });
  if (f.setting !== "any") out.push({ label: f.setting === "indoor" ? "Indoors" : "Outdoors", clear: (p) => ({ ...p, setting: "any" }) });
  if (f.group) out.push({ label: `Group of ${f.group}`, clear: (p) => ({ ...p, group: 0 }) });
  if (f.minRating) out.push({ label: `${f.minRating}+ stars`, clear: (p) => ({ ...p, minRating: 0 }) });
  if (f.family) out.push({ label: "Family", clear: (p) => ({ ...p, family: false }) });
  if (f.accessible) out.push({ label: "Accessible", clear: (p) => ({ ...p, accessible: false }) });
  f.tags.forEach((t) => out.push({ label: COLLECTIONS.find((c) => c.id === t)!.label, clear: (p) => ({ ...p, tags: p.tags.filter((x) => x !== t) }) }));
  f.categories.forEach((c) => out.push({ label: CATEGORIES.find((x) => x.id === c)!.label, clear: (p) => ({ ...p, categories: p.categories.filter((x) => x !== c) }) }));
  if (SHOW_DEMO && !f.sources.osm) out.push({ label: "No OSM places", clear: (p) => ({ ...p, sources: { ...p.sources, osm: true } }) });
  if (SHOW_DEMO && !f.sources.demo) out.push({ label: "No demo listings", clear: (p) => ({ ...p, sources: { ...p.sources, demo: true } }) });
  return out;
}
