import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreView } from "@/components/explore/explore-view";

export const metadata: Metadata = { title: "Map" };

export default function MapPage() {
  return (
    <Suspense>
      <ExploreView initialView="map" />
    </Suspense>
  );
}
