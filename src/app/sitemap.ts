import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";
import { SITE_URL } from "@/lib/site";

/** The fixed pages. Place pages depend on where the visitor is looking, so they aren't listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/explore", "/map", "/categories", "/business", "/about"];
  return [
    ...pages.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...CATEGORIES.map((c) => ({ url: `${SITE_URL}/explore?cat=${c.id}`, changeFrequency: "weekly" as const, priority: 0.5 })),
  ];
}
