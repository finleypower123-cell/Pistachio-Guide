"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { applyOverlay, loadOverlays, type BusinessRecord } from "@/lib/business";
import { demoActivities } from "@/lib/demo-data";
import { loadNearbyPlaces } from "@/lib/discover";
import { DEFAULT_PLACE } from "@/lib/geo";
import { defaultFilters, loadRangeKm, type Filters } from "@/lib/search";
import { withLocalName } from "@/lib/names";
import { cachedAreaPhotos, loadAreaPhotos, withAreaPhotos, type AreaPhotos } from "@/lib/wiki";
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
    const stored = local.get<Place | null>("place", null);
    setPlaceState(stored ?? DEFAULT_PLACE);
    setHydrated(true);
    // First visit: ask where they are rather than silently showing the default city.
    if (!stored && !PREVIEW && !local.get("asked-location", false)) {
      local.set("asked-location", true);
      setLocationOpen(true);
    }
  }, []);

  const setPlace = useCallback((p: Place) => {
    setPlaceState(p);
    local.set("place", p);
  }, []);

  // Real places from OpenStreetMap around the chosen location, as far out as the distance filter asks
  const rangeKm = loadRangeKm(filters.maxDistKm);
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
    setOsm([]);
    // Places are shown as they arrive; the status stays "loading" until the search is complete.
    const onProgress = (places: Activity[]) => {
      if (!ctrl.signal.aborted) setOsm(places);
    };
    loadNearbyPlaces(place.lat, place.lng, rangeKm * 1000, ctrl.signal, { fresh, onProgress })
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
  }, [place.lat, place.lng, hydrated, osmNonce, rangeKm]);

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

  // Real photos from Wikimedia for the loaded places. This starts only once the places are in,
  // and never holds them up: cards show their illustration until a photo is found.
  const [areaPhotos, setAreaPhotos] = useState<AreaPhotos>({});
  // Photos found on an earlier visit are shown with the places, without waiting for anything.
  useEffect(() => {
    if (!hydrated || PREVIEW) return;
    setAreaPhotos(cachedAreaPhotos(place, rangeKm) ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, place.lat, place.lng, rangeKm]);
  useEffect(() => {
    if (PREVIEW || osmStatus !== "ok" || !osm.length) return;
    const ctrl = new AbortController();
    loadAreaPhotos(osm, place, rangeKm, ctrl.signal)
      .then((photos) => {
        if (!ctrl.signal.aborted) setAreaPhotos(photos);
      })
      .catch(() => {});
    return () => ctrl.abort();
    // `osm` is complete whenever the status is "ok", and the location and range identify the search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osmStatus, place.lat, place.lng, rangeKm]);

  const activities = useMemo(() => {
    const byId = new Map(overlays.map((o) => [o.activityId, o]));
    // A business's own photos (from its overlay) take priority over Wikimedia ones.
    return withAreaPhotos(
      [...(SHOW_DEMO ? demoActivities(place) : []), ...osm].map((a) => applyOverlay(a, byId.get(a.id))),
      areaPhotos,
    ).map((a) => withLocalName(a));
  }, [place, osm, overlays, areaPhotos]);

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
