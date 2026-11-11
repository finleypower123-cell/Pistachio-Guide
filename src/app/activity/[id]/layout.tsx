import type { Metadata } from "next";
import { APP_USER_AGENT } from "@/lib/osm";

/**
 * The place's own name as the tab title and in shared links. Place details otherwise load in the
 * browser, so the name is looked up here on the server from OpenStreetMap (one small request,
 * kept for a day). If that fails or is slow, the page still works with a generic title.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const m = id.match(/^osm-(node|way|relation)-(\d+)$/);
  if (!m) return { title: "Place" };
  try {
    const res = await fetch(`https://api.openstreetmap.org/api/0.6/${m[1]}/${m[2]}.json`, {
      headers: { "User-Agent": APP_USER_AGENT },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return { title: "Place" };
    const tags = ((await res.json()) as { elements?: { tags?: Record<string, string> }[] }).elements?.[0]?.tags;
    const name = tags?.name?.trim();
    if (!name) return { title: "Place" };
    const description = tags?.description?.slice(0, 180) || `${name} on Pistachio Guide: find the fun stuff near you.`;
    return { title: name, description, openGraph: { title: name, description } };
  } catch {
    return { title: "Place" };
  }
}

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
