"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { applyOverlay, loadOverlays, type BusinessRecord } from "@/lib/business";
import { demoActivities } from "@/lib/demo-data";
import { loadNearbyPlaces } from "@/lib/discover";
import { DEFAULT_PLACE } from "@/lib/geo";
import { defaultFilters, type Filters } from "@/lib/search";
import { PREVIEW, SHOW_DEMO } from "@/lib/preview";
import { local } from "@/lib/storage";
import type { Activity, Place, Weather } from "@/lib/types";

type OsmStatus = "idle" | "loading" | "ok" | "error" | "off";

interface AppState {
  place: Place;
  setPlace: (p: Place) => void;
  weather: Weather | null;
  activities: Activity[];
  osmStatus: OsmStatus;
  osmError: string | null;
  osmCount: number;
  retryOsm: () => void;
  filters: Filters;
  setFilters: (f: Filters | ((prev: Filters) => Filters)) => void;
  understood: string[];
  setUnderstood: (u: string[]) => void;
  findActivity: (id: string) => Activity | undefined;
  refreshOverlays: () => void;
  surpriseOpen: boolean;
  setSurpriseOpen: (v: boolean) => void;
  locationOpen: boolean;
  setLocationOpen: (v: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  hydrated: boolean;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [place, setPlaceState] = useState<Place>(DEFAULT_PLACE);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [osm, setOsm] = useState<Activity[]>([]);
  const [osmStatus, setOsmStatus] = useState<OsmStatus>("idle");
  const [osmError, setOsmError] = useState<string | null>(null);
  const [osmNonce, setOsmNonce] = useState(0);
  const lastNonce = useRef(0);
  const [overlays, setOverlays] = useState<BusinessRecord[]>([]);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [understood, setUnderstood] = useState<string[]>([]);
  const [surpriseOpen, setSurpriseOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [overlayNonce, setOverlayNonce] = useState(0);

  useEffect(() => {
    setPlaceState(local.get("place", DEFAULT_PLACE));
    setHydrated(true);
  }, []);

  const setPlace = useCallback((p: Place) => {
    setPlaceState(p);
    local.set("place", p);
  }, []);

  // Real places from OpenStreetMap around the chosen location
  useEffect(() => {
    if (!hydrated) return;
    if (PREVIEW) {
      setOsmStatus("off");
      return;
    }
    const ctrl = new AbortController();
    setOsmStatus("loading");
    setOsmError(null);
    // Retry skips the on-device cache; a plain reload or location change may use it.
    const fresh = osmNonce !== lastNonce.current;
    lastNonce.current = osmNonce;
    loadNearbyPlaces(place.lat, place.lng, 3000, ctrl.signal, { fresh })
      .then((places) => {
        if (ctrl.signal.aborted) return;
        setOsm(places);
        setOsmStatus("ok");
      })
      .catch((e: Error) => {
        if (ctrl.signal.aborted) return;
        setOsm([]);
        setOsmStatus("error");
        setOsmError(e.message);
      });
    return () => ctrl.abort();
  }, [place.lat, place.lng, hydrated, osmNonce]);

  // Current weather for weather-smart suggestions
  useEffect(() => {
    if (!hydrated || PREVIEW) return;
    setWeather(null);
    fetch(`/api/weather?lat=${place.lat}&lng=${place.lng}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setWeather(j.weather))
      .catch(() => {});
  }, [place.lat, place.lng, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    loadOverlays().then(setOverlays).catch(() => {});
  }, [hydrated, overlayNonce]);

  const activities = useMemo(() => {
    const byId = new Map(overlays.map((o) => [o.activityId, o]));
    return [...(SHOW_DEMO ? demoActivities(place) : []), ...osm].map((a) => applyOverlay(a, byId.get(a.id)));
  }, [place, osm, overlays]);

  const findActivity = useCallback((id: string) => activities.find((a) => a.id === id), [activities]);

  const value: AppState = {
    place,
    setPlace,
    weather,
    activities,
    osmStatus,
    osmError,
    osmCount: osm.length,
    retryOsm: () => setOsmNonce((n) => n + 1),
    filters,
    setFilters,
    understood,
    setUnderstood,
    findActivity,
    refreshOverlays: () => setOverlayNonce((n) => n + 1),
    surpriseOpen,
    setSurpriseOpen,
    locationOpen,
    setLocationOpen,
    searchOpen,
    setSearchOpen,
    hydrated,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}
