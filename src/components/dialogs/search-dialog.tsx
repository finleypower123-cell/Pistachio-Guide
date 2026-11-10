"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { Sheet } from "@/components/ui/sheet";
import { defaultFilters, parseQuery } from "@/lib/search";

/** Searches that real OpenStreetMap places can answer (they carry no prices, group sizes or "date" labels). */
export const EXAMPLE_QUERIES = [
  "Somewhere to go when it's raining",
  "A quirky café within walking distance",
  "Free things to do outside",
  "A museum near me",
  "Somewhere to swim",
  "A park for a picnic",
];

export function useRunQuery() {
  const { setFilters, setUnderstood, activities, filters: current } = useApp();
  const router = useRouter();
  return (q: string) => {
    const { filters, understood } = parseQuery(q, activities);
    // Keep the chosen search distance unless the search itself names one ("walking distance").
    setFilters({ ...defaultFilters(), maxDistKm: current.maxDistKm, ...filters });
    setUnderstood(understood);
    router.push("/explore");
  };
}

export function SearchDialog() {
  const { searchOpen, setSearchOpen } = useApp();
  const [q, setQ] = useState("");
  const run = useRunQuery();
  const go = (text: string) => {
    run(text);
    setSearchOpen(false);
    setQ("");
  };
  return (
    <Sheet open={searchOpen} onClose={() => setSearchOpen(false)} title="What do you fancy?">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) go(q);
        }}
        className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-1.5 pl-4 focus-within:border-primary"
      >
        <Search className="size-5 shrink-0 text-ink-soft" />
        <label htmlFor="search-q" className="sr-only">Describe what you want to do</label>
        <input
          id="search-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try “cosy café for a rainy afternoon”"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none"
        />
        <button type="submit" className="rounded-xl bg-primary px-4 py-2.5 font-extrabold text-on-primary">Go</button>
      </form>
      <p className="mb-2 mt-5 text-sm font-bold text-ink-soft">Try asking</p>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUERIES.map((ex) => (
          <button key={ex} type="button" onClick={() => go(ex)} className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-semibold hover:border-primary">
            {ex}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
