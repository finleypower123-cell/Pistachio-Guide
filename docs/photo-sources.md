# Photos for places: what is in place, and the options for the rest

Checked on 11 November 2026. Prices and terms change, so check the linked pages again before committing to a paid source.

## What the site does today

| Source | Covers | Cost | Status |
|---|---|---|---|
| Wikimedia Commons, via Wikidata and Wikipedia | Museums, theatres, parks, cinemas, landmarks, castles. About 1 place in 10 in a city centre | Free, no key | Live (`src/lib/wiki.ts`) |
| The venue's own photos, uploaded in the business portal | Any venue whose owner claims it | Free | Built, but only saved on the device until Supabase is connected |
| Illustration per kind of place | Everything else | Free | Live (`src/components/ui/activity-art.tsx`) |

Cafés, small shops, escape rooms and most independent venues have no photo on Wikimedia. Covering them needs one of the options below.

## Options for the rest

### 1. Owners upload their own (recommended first)

Already built. It needs Supabase connected (see the README, "Turn on accounts (Supabase)"). The photos are the venue's own, so there is no licence cost and no risk of showing the wrong place. This is also the feature the business plan charges for.

### 2. Google Places API (New), Place Photos

- **Cost:** the Place Photos SKU has a free cap of 1,000 requests a month, then 7 US dollars per 1,000. Finding the right Google place for each of our places needs a search request too: Text Search Enterprise has its own free cap of 1,000 a month, then 35 dollars per 1,000. A visitor loading 450 places would use the monthly free caps in a few page views unless results are limited to the places actually opened.
- **Rules that affect this site:**
  - Places content must not be shown on a map that is not a Google map. The site's map is OpenFreeMap, so Google photos could appear on place pages and lists but those places could not then be drawn on our map, or the map would have to change to Google's.
  - Content may not be stored or cached, apart from the place ID. Every view fetches again, which is what drives the cost.
  - The Google Maps logo and each photo's author attribution must be shown, and the site's terms and privacy policy must reference Google's.
  - Separate terms apply to billing addresses in the European Economic Area.
- **Verdict:** best coverage, but the map rule conflicts with how the site works today, and the cost grows with every view.

Sources: [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing), [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies), [service specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms/index-20240422).

### 3. Foursquare Places API, Photos

- **Cost:** photos are a Premium endpoint. Foursquare's pricing page lists Places photos at 6.50 US dollars per 1,000 requests with a 200 dollar monthly credit in its estimator; a third-party summary of a June 2026 update says Premium fields are billed from the first call. These do not agree, so confirm in the Foursquare developer console before relying on a free allowance.
- **Rules:** fewer display restrictions than Google (no map requirement found), attribution required.
- **Verdict:** the more practical paid option for this site, if the price is acceptable. Coverage of small venues in Belgium should be tested on a handful of real places before building on it.

Sources: [Foursquare pricing](https://location.foursquare.com/pricing/), [Foursquare products pricing](https://foursquare.com/products/pricing/).

### 4. Visitors upload photos

Needs accounts (Supabase), storage, and a way to review and remove uploads. Worth doing after launch, once there are visitors.

## Why no paid integration is switched on, or built blind

Both paid sources need an account, a key and a payment method, and Google's needs a decision about the map. Code written against them without a key cannot be tested, and an untested integration that looks finished is worse than none. Once a source is chosen and a key exists, the work is small, because places already carry `photos` and `photoCredits` and the cards and place pages already show them with credits:

1. Add the key as a server-only environment variable in Vercel (never `NEXT_PUBLIC_`).
2. Add a server route that takes a place's name and coordinates, asks the provider, and returns photo URLs with their credits. Call it only when a place page is opened, not for every card, to keep the cost down.
3. Show the provider's required attribution next to the photos.
