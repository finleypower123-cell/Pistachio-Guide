import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Personal and account pages have nothing for a search engine; API routes return data, not pages.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/saved", "/profile", "/login"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
