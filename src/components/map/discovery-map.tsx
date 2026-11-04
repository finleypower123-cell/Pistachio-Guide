"use client";

import { useEffect, useMemo } from "react";
import { Heart } from "lucide-react";
import { Map, MapControls, MapGeoJSON, MapMarker, MarkerContent, useMap } from "@/components/map/map";
import { useApp } from "@/components/providers/app-provider";
import { useUser } from "@/components/providers/user-provider";
import { offsetKm } from "@/lib/geo";
import type { Activity, Place } from "@/lib/types";
import { cn } from "@/lib/utils";

function circle(center: Place, km: number) {
  const coords: [number, number][] = [];
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    const p = offsetKm(center, Math.cos(t) * km, Math.sin(t) * km);
    coords.push([p.lng, p.lat]);
  }
  return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [coords] } };
}

/** Keeps the camera in step with the chosen location and the selected marker. */
function CameraSync({ center, selected }: { center: Place; selected?: Activity | null }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded) return;
    map.flyTo({ center: [center.lng, center.lat], zoom: 13.4, duration: 900, essential: true });
  }, [map, isLoaded, center.lat, center.lng]);
  useEffect(() => {
    if (!map || !isLoaded || !selected) return;
    const b = map.getBounds();
    if (!b.contains([selected.lng, selected.lat])) map.easeTo({ center: [selected.lng, selected.lat], duration: 600 });
  }, [map, isLoaded, selected]);
  return null;
}

export function DiscoveryMap({
  activities,
  selectedId,
  onSelect,
  showWalkRing = true,
  className,
  interactive = true,
}: {
  activities: Activity[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  showWalkRing?: boolean;
  className?: string;
  interactive?: boolean;
}) {
  const { place, setPlace } = useApp();
  const { isSaved } = useUser();
  const ring = useMemo(() => circle(place, 1.2), [place]);
  const selected = activities.find((a) => a.id === selectedId) ?? null;

  return (
    <div className={cn("relative overflow-hidden rounded-[22px] bg-surface-2", className)}>
      <Map
        center={[place.lng, place.lat]}
        zoom={13.4}
        className="h-full w-full"
        attributionControl={{ compact: true }}
        cooperativeGestures={false}
        dragRotate={false}
        interactive={interactive}
      >
        <CameraSync center={place} selected={selected} />
        {showWalkRing && (
          <MapGeoJSON
            id="walk-ring"
            data={{ type: "FeatureCollection", features: [ring] }}
            fillPaint={{ "fill-color": "#A8C686", "fill-opacity": 0.14 }}
            linePaint={{ "line-color": "#254C38", "line-width": 1.5, "line-dasharray": [2, 2], "line-opacity": 0.6 }}
          />
        )}
        <MapMarker longitude={place.lng} latitude={place.lat}>
          <MarkerContent className="pointer-events-none">
            <span className="block size-4 rounded-full border-[3px] border-white bg-[#2b7de9] shadow-[0_0_0_6px_rgb(43_125_233/0.2)]" aria-hidden />
          </MarkerContent>
        </MapMarker>
        {activities.map((a) => {
          const on = a.id === selectedId;
          const saved = isSaved(a.id);
          return (
            <MapMarker key={a.id} longitude={a.lng} latitude={a.lat} anchor="bottom" onClick={() => onSelect?.(on ? null : a.id)}>
              <MarkerContent>
                <span className={cn("flex flex-col items-center", on && "z-10")}>
                  {on && (
                    <span className="mb-1 max-w-[160px] truncate rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-bg shadow">{a.name}</span>
                  )}
                  <span
                    role="button"
                    aria-label={`${a.name}, show preview`}
                    className={cn(
                      "grid place-items-center rounded-full border-2 border-white shadow-md transition-transform",
                      on ? "size-9 scale-110" : "size-7 hover:scale-110",
                      a.source === "osm" ? "bg-[#2f6f8a]" : "bg-[#254C38]",
                      a.price === 0 && a.source !== "osm" && "bg-[#7da35a]",
                    )}
                  >
                    {saved ? <Heart className="size-3.5 fill-white text-white" /> : <span className="size-2 rounded-full bg-white/90" />}
                  </span>
                </span>
              </MarkerContent>
            </MapMarker>
          );
        })}
        <MapControls
          position="top-right"
          showZoom
          showLocate
          onLocate={(c) => setPlace({ label: "Near you", lat: c.latitude, lng: c.longitude })}
        />
      </Map>
    </div>
  );
}

export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-semibold text-ink-soft">
      <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-[#2f6f8a]" /> OpenStreetMap</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-[#254C38]" /> Demo listing</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-[#7da35a]" /> Demo, free</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full border border-dashed border-[#254C38] bg-[#A8C686]/30" /> ~15 min walk</span>
    </div>
  );
}
