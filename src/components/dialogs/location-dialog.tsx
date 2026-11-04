"use client";

import { Loader2, LocateFixed, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";

type Result = { label: string; detail: string; lat: number; lng: number };

export function useGeocode(q: string) {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const j = await r.json();
        setResults(j.results ?? []);
        setError(r.ok ? null : j.error);
      } catch {
        if (!ctrl.signal.aborted) setError("Location search is unavailable right now.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);
  return { results, loading, error };
}

export function useLocateMe() {
  const { setPlace } = useApp();
  const toast = useToast();
  const [locating, setLocating] = useState(false);
  const locate = (onDone?: () => void) => {
    if (!("geolocation" in navigator)) {
      toast("Your browser can't share location. Search for a place instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPlace({ label: "Near you", lat: pos.coords.latitude, lng: pos.coords.longitude });
        onDone?.();
      },
      () => {
        setLocating(false);
        toast("Couldn't get your location. Check permissions or search instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };
  return { locate, locating };
}

export function LocationDialog() {
  const { locationOpen, setLocationOpen, setPlace, place } = useApp();
  const [q, setQ] = useState("");
  const { results, loading, error } = useGeocode(q);
  const { locate, locating } = useLocateMe();
  const close = () => {
    setLocationOpen(false);
    setQ("");
  };
  return (
    <Sheet open={locationOpen} onClose={close} title="Where are you exploring?">
      <label htmlFor="loc-q" className="mb-1.5 block text-sm font-bold text-ink-soft">City, postcode or neighbourhood</label>
      <div className="relative">
        <input
          id="loc-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Bristol, M1 1AE, Shoreditch"
          autoComplete="off"
          className="w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-base outline-none focus:border-primary"
        />
        {loading && <Loader2 className="absolute right-4 top-4 size-5 animate-spin text-ink-soft" />}
      </div>
      <button
        type="button"
        onClick={() => locate(close)}
        className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3.5 text-left font-bold"
      >
        {locating ? <Loader2 className="size-5 animate-spin" /> : <LocateFixed className="size-5 text-accent-ink" />}
        Use my current location
      </button>
      {error && <p className="mt-3 text-sm text-warn">{error}</p>}
      <ul className="mt-3 divide-y divide-line">
        {results.map((r) => (
          <li key={`${r.lat},${r.lng}`}>
            <button
              type="button"
              className="flex w-full items-start gap-3 py-3 text-left"
              onClick={() => {
                setPlace({ label: r.label, lat: r.lat, lng: r.lng });
                close();
              }}
            >
              <MapPin className="mt-0.5 size-5 shrink-0 text-ink-soft" />
              <span className="min-w-0">
                <span className="block font-bold">{r.label}</span>
                <span className="block truncate text-sm text-ink-soft">{r.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-ink-soft">
        Now showing: <strong>{place.label}</strong>. Location search by OpenStreetMap Nominatim.
      </p>
    </Sheet>
  );
}
