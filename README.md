# Pistachio Guide

**Find the fun stuff.** A local discovery website and installable mobile web app for finding hidden gems, weird little adventures and affordable things to do nearby.

Built with Next.js 15, TypeScript, Tailwind CSS 4, MapLibre GL and (optionally) Supabase. Runs with **no API keys**.

## What's in it

- **Home** with natural-language search ("a weird date idea under £20"), location picker, Explore nearby, mood tiles and curated rails: Not your usual day out, Free, Real places near you, Rainy day, Little local gems, Under £20, Date night, Something weird, Local deals.
- **Explore + Map**: filters for budget, price, distance, open now / this afternoon / tonight, time available, indoor/outdoor, group size, rating, family, accessibility, collections, activity type and data source. List and map views; on phones the map gets swipeable cards and tap-to-preview markers.
- **Weather-aware**: current weather (Open-Meteo) ranks indoor places higher when it's wet and offers an "Indoors only" shortcut.
- **Surprise Me**: picks one nearby place that fits your budget, favourite categories and the weather.
- **Activity pages**: gallery, price, hours with open/closed status, accessibility, booking info, map, nearby places, save, share, walking directions (OpenStreetMap).
- **Accounts**: sign-up/login, saved places, favourite categories, budget, recently viewed. Without Supabase, all of this is kept on the device.
- **Business portal**: claim a listing, edit details and hours, upload photos, add offers and events, see views/saves/booking clicks, and choose a plan. Featured listings appear in a clearly labelled Sponsored section and never get a ranking boost.
- **Installable**: web app manifest and icon, so it can be added to a phone's home screen.

## Where the data comes from

| Badge | Source | What we show |
| --- | --- | --- |
| **OpenStreetMap** | Overpass API around the chosen location, with Photon and the OpenStreetMap API as backups | Only what OSM records: name, location, type, opening hours, website, phone, wheelchair access, address, `fee=no`. No prices, ratings or reviews are invented. |
| **Wikimedia** | Wikidata, Wikipedia and Wikimedia Commons, queried from the browser | Real photos and a short description for places that have them. A place gets a photo only when its OpenStreetMap record links to Wikidata or Commons, or a nearby Wikidata item has the same name and is the same kind of place. Every photo links to its Commons page for credit; text is credited to Wikipedia (CC BY-SA 4.0) |
| **Verified** | A business that claimed its listing and was verified | Their edits, photos, offers and events. |

Real places link to their own website. Sample ("demo") listings from `src/lib/demo-data.ts` appear only in the offline single-file preview (`npm run build:preview`), which can't load real places; the live site never shows them.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # logic tests: hours parser, OSM mapping, natural-language search
npm run build      # production build
```

Requires Node 20+.

## Deploy (Vercel)

1. Import this repo at [vercel.com/new](https://vercel.com/new). No settings needed.
2. Optional: add the Supabase variables below to turn on real accounts and the shared business portal.

## Turn on accounts (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql). It creates `profiles`, `businesses` and `listing_events` with row-level security, plus a `listing-photos` storage bucket.
3. Copy `.env.example` to `.env.local` (or set them in Vercel) and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the anon/publishable key)
4. In Supabase → Authentication → URL configuration, add your site URL.

Once connected, anything saved on a device moves into the user's account when they sign in. Business claims start as `pending`; set `status = 'verified'` in the `businesses` table after checking ownership. Owners can't change their own status, plan or featured flag (a database trigger enforces this).

## Monetisation architecture

- **Affiliate bookings**: `src/lib/affiliate.ts` builds tracked outbound links (`aff`, `utm_*`). Set `NEXT_PUBLIC_AFFILIATE_ID`. Booking, website and directions clicks are logged to `listing_events`.
- **Plans**: `src/lib/plans.ts` defines Free / Local (£19) / Featured (£49). Billing isn't connected: in demo mode choosing a plan previews it locally and says no payment is taken. To launch, add Stripe Checkout and update `businesses.plan` from a webhook using the service role.
- **Featured listings**: only shown when `plan = 'featured'` and `featured = true`, always badged Sponsored.
- **Local deals and events**: available on Local and Featured plans.

## Project structure

```
src/
  app/                 pages (home, explore, map, activity/[id], categories, saved, profile, login, business, about) and API routes
  app/api/discover     Overpass → activities near a point (the browser falls back to Photon)
  app/api/place        one OSM place by id (OpenStreetMap API, then Overpass)
  app/api/geocode      Nominatim location search
  app/api/weather      Open-Meteo current weather
  components/map       mapcn MapLibre components + DiscoveryMap
  components/…         cards, dialogs (location, search, Surprise Me), explore, business dashboard
  lib/                 types, categories, demo data, OSM mapping, hours parser, search/ranking, business, analytics, Supabase
supabase/schema.sql    database schema and policies
tests/logic.test.ts    unit tests
```

## Notes for production

- Real places come from three free OpenStreetMap services, none of which is meant to carry a commercial app's traffic. Overpass (full records, asked from `/api/discover`) is often overloaded or refuses requests, so the browser falls back to Photon (name, type, address and location only), and the OpenStreetMap API fills in hours, website and accessibility when a place is opened. For real traffic, use a paid Overpass or places provider, or host your own, and change `OVERPASS_ENDPOINTS` in `src/lib/osm.ts` and the URLs in `src/lib/places-fallback.ts`.
- Overpass answers are cached at the CDN for 6 hours and geocoding for 7 days; failures are never cached. Places are also cached on the device (6 hours for full records, 1 hour for basic ones).
- Photos and descriptions (`src/lib/wiki.ts`) come from Wikimedia's public APIs with no key. Most museums, parks, theatres and landmarks have one; most cafés and small shops do not, and keep their illustration until the venue uploads photos. Wikimedia serves thumbnails only at fixed widths (330, 500 and 960 px are used); other sizes are refused. Results are cached on the device for a week.
- OpenFreeMap tiles are free with no key. To switch providers, change `defaultStyles` in `src/components/map/map.tsx`.
- Illustrations stand in for photos until a venue uploads its own.

## Credits

Map components from [mapcn](https://github.com/AnmolSaini16/mapcn), Supabase helpers from [nextjs-supabase-shadcn-boilerplate](https://github.com/Barty-Bart/nextjs-supabase-shadcn-boilerplate), OSM category mapping from [TRIP](https://github.com/itskovacs/TRIP), tile setup informed by [nextjs-maplibre-starter](https://github.com/wellywahyudi/nextjs-maplibre-starter). All MIT; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Map data © OpenStreetMap contributors. Photos from Wikimedia Commons under each file's own licence, and descriptions from Wikipedia under CC BY-SA 4.0, each credited where shown.

## Launch settings

- `NEXT_PUBLIC_SITE_URL`: the site's public address (for example `https://pistachio.guide`), used in share previews, `robots.txt` and `sitemap.xml`. On Vercel the production address is used automatically until this is set; set it once the site has its own domain.
- Share preview image: `src/app/opengraph-image.tsx`. App icons: `public/icons/` (192, 512, maskable and Apple touch), generated from `src/app/icon.svg`.
- Every pull request and every push to `main` runs the tests, type check, lint and a production build (`.github/workflows/ci.yml`).

