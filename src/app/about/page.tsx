import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sources & credits" };

export default function AboutPage() {
  return (
    <div className="gutter mx-auto max-w-3xl pb-10 pt-8">
      <h1 className="text-4xl font-extrabold md:text-5xl">Where our data comes from</h1>
      <div className="mt-6 space-y-6 text-[17px]">
        <section>
          <h2 className="text-2xl font-extrabold">Three kinds of listing</h2>
          <ul className="mt-3 space-y-3">
            <li><strong className="rounded-full bg-osm-bg px-2 py-0.5 text-sm text-osm-ink">OpenStreetMap</strong> Real places mapped by volunteers. We show only what OSM records: name, location, opening hours, website and accessibility. OSM has no prices, ratings or reviews, so we don&apos;t show any.</li>
            <li><strong className="rounded-full bg-accent px-2 py-0.5 text-sm text-forest">Verified</strong> Listings a business has claimed and we&apos;ve verified. Offers and events come from them.</li>
            <li><strong className="rounded-full bg-demo-bg px-2 py-0.5 text-sm text-demo-ink">Demo</strong> Sample listings written to show how Pistachio Guide works. They aren&apos;t real venues, have no real address, and their ratings and reviews are illustrative.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-2xl font-extrabold">Sponsored placements</h2>
          <p className="mt-2">Businesses on the Featured plan can appear in “Featured partners” slots, always labelled Sponsored. Paying never changes where a place ranks in search.</p>
        </section>
        <section>
          <h2 className="text-2xl font-extrabold">Credits</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Place data © <a className="underline" href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, ODbL. Queried with the Overpass API.</li>
            <li>Location search by Nominatim (OpenStreetMap).</li>
            <li>Map tiles by OpenFreeMap, rendered with MapLibre GL JS.</li>
            <li>Weather by Open-Meteo.</li>
            <li>Map components adapted from mapcn; Supabase helpers from nextjs-supabase-shadcn-boilerplate; OSM category mapping adapted from TRIP. All MIT licensed.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
