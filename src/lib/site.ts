/**
 * The public address of the site, used for share links, the sitemap and social previews.
 * Set NEXT_PUBLIC_SITE_URL once the site has its own domain; on Vercel the production address is
 * picked up automatically until then.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

export const SITE_NAME = "Pistachio Guide";
export const SITE_TAGLINE = "Find the fun stuff";
export const SITE_DESCRIPTION = "Find hidden gems, weird little adventures and brilliant things to do near you.";
