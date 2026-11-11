"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Accessibility, CalendarDays, Clock, ExternalLink, Globe, Info, Navigation, Phone, Share2, Star, Tag, Ticket, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityCard } from "@/components/activity/activity-card";
import { SaveButton } from "@/components/activity/save-button";
import { DiscoveryMap } from "@/components/map/discovery-map";
import { useApp } from "@/components/providers/app-provider";
import { useUser } from "@/components/providers/user-provider";
import { ActivityArt } from "@/components/ui/activity-art";
import { DealBadge, SourceBadge, SponsoredBadge } from "@/components/ui/badges";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { bookingLink } from "@/lib/affiliate";
import { logEvent } from "@/lib/analytics";
import { PREVIEW, SHOW_DEMO } from "@/lib/preview";
import { CAT, TAG_LABEL } from "@/lib/categories";
import { sampleReviews } from "@/lib/demo-data";
import { loadPlaceById } from "@/lib/discover";
import { loadPlaceMedia, visitorLangs, type PlaceMedia } from "@/lib/wiki";
import { distanceKm, formatDistance, formatWalk } from "@/lib/geo";
import { formatRange, openStatus, weekRows } from "@/lib/hours";
import type { Activity, PhotoCredit, WikiRef } from "@/lib/types";
import { cn, priceLabel } from "@/lib/utils";

function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-surface p-3.5">
      <Icon className="mt-0.5 size-5 shrink-0 text-accent-ink" />
      <div className="min-w-0">
        <div className="text-[12px] font-extrabold uppercase tracking-wider text-ink-soft">{label}</div>
        <div className="font-bold">{value}</div>
      </div>
    </div>
  );
}

function BookingDialog({ a, open, onClose }: { a: Activity; open: boolean; onClose: () => void }) {
  const link = bookingLink(a, "detail");
  return (
    <Sheet open={open} onClose={onClose} title={link.url ? "Continue to book" : "Booking in the demo"}>
      {link.url ? (
        <>
          <p className="text-ink-soft">You&apos;ll book directly with <strong className="text-ink">{a.name}</strong> on their website. Pistachio Guide may earn a commission from partner bookings.</p>
          <a href={link.url} target="_blank" rel="noopener noreferrer sponsored" onClick={onClose} className="mt-5 flex items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-extrabold text-on-primary">
            Open their website <ExternalLink className="size-4" />
          </a>
        </>
      ) : (
        <>
          <p className="text-ink-soft">
            {a.name} is a demo listing, so there&apos;s nothing real to book and no booking has been made. In the live app this button hands you to a booking partner with a tracked link like this:
          </p>
          <code className="mt-4 block overflow-x-auto whitespace-nowrap rounded-xl bg-surface-2 p-3 text-xs">{link.trackingPreview}</code>
          <p className="mt-3 text-sm text-ink-soft">The click was counted in the venue&apos;s analytics so you can see how it works in the business dashboard.</p>
          <button type="button" onClick={onClose} className="mt-5 w-full rounded-full bg-primary py-3.5 font-extrabold text-on-primary">Got it</button>
        </>
      )}
    </Sheet>
  );
}

export default function ActivityPage() {
  const { id } = useParams<{ id: string }>();
  const { findActivity, activities, place, hydrated } = useApp();
  const { saved, recent, addRecent } = useUser();
  const toast = useToast();
  const [fetched, setFetched] = useState<Activity | null>(null);
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "error">("idle");
  const [booking, setBooking] = useState(false);
  const [photo, setPhoto] = useState(0);
  const logged = useRef<string | null>(null);

  // A place known only by name, type and location is swapped for its full record once that loads.
  const listed = findActivity(id);
  const a: Activity | undefined = useMemo(
    () =>
      (listed?.partial && fetched ? { ...fetched, address: fetched.address ?? listed.address } : listed) ??
      fetched ??
      saved.find((s) => s.id === id)?.snapshot ??
      recent.find((r) => r.id === id)?.snapshot,
    [listed, fetched, saved, recent, id],
  );

  // OSM places outside the current search area, or with only basic details, are fetched by id
  const tried = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated || PREVIEW || fetched || !id.startsWith("osm-") || tried.current === id) return;
    const known = findActivity(id);
    if (known && !known.partial) return;
    tried.current = id;
    if (!known) setFetchState("loading");
    loadPlaceById(id)
      .then((place) => {
        setFetched(place);
        setFetchState("idle");
      })
      .catch(() => {
        if (!known) setFetchState("error");
      });
  }, [id, hydrated, findActivity, fetched]);

  // Real photos and a description from Wikimedia, for places OpenStreetMap links to Wikipedia,
  // Wikidata or Commons. Loaded after the page shows; the illustration stays until then.
  const [media, setMedia] = useState<PlaceMedia | null>(null);
  const wikiKey = a?.wiki ? JSON.stringify(a.wiki) : "";
  useEffect(() => {
    setMedia(null);
    if (PREVIEW || !wikiKey) return;
    const ctrl = new AbortController();
    loadPlaceMedia(JSON.parse(wikiKey) as WikiRef, visitorLangs(), ctrl.signal)
      .then((m) => {
        if (!ctrl.signal.aborted) setMedia(m);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [wikiKey]);

  // The tab carries the place's own name. The framework writes the generic page title into the
  // head after this page renders, so the name is put back whenever the head changes.
  const placeName = a?.name;
  useEffect(() => {
    if (!placeName) return;
    const want = `${placeName} · Pistachio Guide`;
    const apply = () => {
      if (document.title !== want) document.title = want;
    };
    apply();
    const watcher = new MutationObserver(apply);
    watcher.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => watcher.disconnect();
  }, [placeName]);

  useEffect(() => {
    if (!a || logged.current === a.id) return;
    logged.current = a.id;
    logEvent(a.id, "view");
    addRecent(a);
  }, [a, addRecent]);

  const nearby = useMemo(() => {
    if (!a) return [];
    return activities
      .filter((x) => x.id !== a.id)
      .map((x) => ({ x, d: distanceKm(a, x) }))
      .sort((p, q) => p.d - q.d)
      .slice(0, 6)
      .map((p) => p.x);
  }, [a, activities]);

  if (!a) {
    return (
      <div className="gutter mx-auto max-w-3xl py-20 text-center">
        {!hydrated || fetchState === "loading" ? (
          <p className="font-bold text-ink-soft">Loading place…</p>
        ) : (
          <>
            <h1 className="text-3xl font-extrabold">We couldn&apos;t find that place.</h1>
            <p className="mt-2 text-ink-soft">It may be outside your current area, or OpenStreetMap didn&apos;t respond.</p>
            <Link href="/explore" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-extrabold text-on-primary">Back to Explore</Link>
          </>
        )}
      </div>
    );
  }

  const km = distanceKm(place, a);
  const status = openStatus(a.hours);
  const isDemo = a.source === "demo";
  // A venue's own photos come first; otherwise Wikimedia photos of this place, each with its credit.
  const ownPhotos = Boolean(a.photos?.length) && !a.photoCredits?.length;
  const shown: Activity =
    !ownPhotos && media?.photos.length ? { ...a, photos: media.photos.map((p) => p.src), photoCredits: media.photos.map((p) => p.credit) } : a;
  const photoCount = shown.photos?.length ?? 0;
  const credits = (shown.photoCredits ?? []).filter((c): c is PhotoCredit => Boolean(c));
  // Without photos there is one illustration, shown as a banner: four copies of it would be a gallery of nothing.
  const variants = photoCount ? shown.photos!.map((_, i) => i) : [0];
  // The big slot shows whichever picture was tapped; stay in range if the set of photos changed.
  const mainPhoto = photoCount ? Math.min(photo, photoCount - 1) : photo;
  // With real photos the desktop grid adapts to how many there are, so no cell is left empty.
  const slot = (i: number) =>
    !photoCount
      ? "aspect-[16/9] md:col-span-4 md:row-span-2 md:aspect-[21/7]"
      : photoCount >= 5
      ? i === 0 ? "aspect-[4/3] md:col-span-2 md:row-span-2 md:aspect-auto" : "aspect-[4/3] md:aspect-[4/3]"
      : photoCount === 1
        ? "aspect-[4/3] md:col-span-4 md:row-span-2 md:aspect-[21/9]"
        : photoCount === 2
          ? "aspect-[4/3] md:col-span-2 md:row-span-2 md:aspect-[4/3]"
          : i === 0
            ? "aspect-[4/3] md:col-span-2 md:row-span-2 md:aspect-auto"
            : photoCount === 3
              ? "aspect-[4/3] md:col-span-2 md:aspect-[2/1]"
              : i === 3 ? "aspect-[4/3] md:col-span-2 md:aspect-auto" : "aspect-[4/3] md:aspect-[4/3]";
  const today = new Date().getDay();

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: a.name, text: a.summary, url });
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // user closed the share sheet
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      toast("Couldn't copy. Use your browser's share button instead.");
    }
  };

  const directionsUrl = !isDemo
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${place.lat}%2C${place.lng}%3B${a.lat}%2C${a.lng}`
    : null;

  return (
    <div className="gutter mx-auto max-w-7xl pb-10 pt-4 md:pt-8">
      <nav className="mb-4 text-sm font-semibold text-ink-soft" aria-label="Breadcrumb">
        <Link href="/explore" className="hover:underline">Explore</Link> /{" "}
        <Link href={`/explore?cat=${a.category}`} className="hover:underline">{CAT[a.category].label}</Link>
      </nav>

      {/* Gallery: swipe on phones, grid on desktop */}
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:grid-rows-2 md:overflow-visible md:px-0">
        {variants.slice(0, photoCount ? 5 : 4).map((v, i) => (
          <button
            key={v}
            type="button"
            onClick={() => setPhoto(v)}
            aria-label={photoCount > 1 ? `Show photo ${i + 1}` : undefined}
            aria-hidden={photoCount > 1 ? undefined : true}
            tabIndex={photoCount > 1 ? undefined : -1}
            className={cn("no-bounce relative shrink-0 snap-center overflow-hidden rounded-[22px] md:w-auto", photoCount <= 1 ? "w-full" : "w-[86%]", slot(i))}
          >
            <ActivityArt activity={shown} variant={i === 0 ? mainPhoto : v} hero={i === 0} sizes={i === 0 ? undefined : "(max-width: 768px) 86vw, 320px"} />
          </button>
        ))}
      </div>
      {!photoCount && <p className="mt-2 text-xs text-ink-soft">No photos of this place yet, so here&apos;s a drawing of the general idea.</p>}
      {credits.length > 0 && (
        <p className="mt-2 text-xs text-ink-soft">
          {credits.length > 1 ? "Photos" : "Photo"} from Wikimedia Commons:{" "}
          {credits.map((c, i) => (
            <span key={c.page}>
              {i > 0 && " · "}
              <a href={c.page} target="_blank" rel="noopener noreferrer" className="underline">
                {[c.by ?? "see credit", c.license].filter(Boolean).join(", ")}
              </a>
            </span>
          ))}
        </p>
      )}

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-extrabold uppercase tracking-wider text-ink-soft">{a.typeLabel ?? CAT[a.category].short}</span>
            {(SHOW_DEMO || a.source === "business") && <SourceBadge a={a} />}
            {a.sponsored && <SponsoredBadge />}
            {a.deal && <DealBadge />}
          </div>
          <h1 className="mt-2 text-4xl font-extrabold md:text-6xl">{a.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold text-ink-soft tabular">
            {a.rating != null && (
              <span className="inline-flex items-center gap-1 text-ink">
                <Star className="size-4 fill-accent text-accent-ink" /> {a.rating.toFixed(1)}
                <span className="font-normal text-ink-soft">({a.ratingCount} {isDemo ? "sample ratings" : "ratings"})</span>
              </span>
            )}
            <span>{formatWalk(km).endsWith("away") ? formatWalk(km) : `${formatDistance(km)} · ${formatWalk(km)}`}</span>
            {status.open !== null && <span className={cn(status.open === true && "text-ok", status.open === false && "text-warn")}>{status.text}</span>}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <SaveButton a={a} withLabel />
            <button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-bold">
              <Share2 className="size-4" /> Share
            </button>
            {directionsUrl ? (
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer" onClick={() => logEvent(a.id, "directions")} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-bold">
                <Navigation className="size-4" /> Directions
              </a>
            ) : (
              <a href="#location" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-bold">
                <Navigation className="size-4" /> See on map
              </a>
            )}
          </div>

          {isDemo && a.provenance && (
            <p className="mt-5 flex gap-2 rounded-2xl bg-demo-bg p-3.5 text-sm text-demo-ink">
              <Info className="mt-0.5 size-4 shrink-0" /> {a.provenance}
            </p>
          )}

          {/* Only what is actually known: a row of "not listed" boxes tells nobody anything. */}
          <div className="mt-6 grid gap-2 empty:hidden sm:grid-cols-2">
            {a.price != null && <Fact icon={Ticket} label="Price" value={a.priceNote ? `${priceLabel(a.price)} · ${a.priceNote}` : priceLabel(a.price)} />}
            {a.durationMin && <Fact icon={Clock} label="Takes about" value={a.durationMin >= 60 ? `${Math.round((a.durationMin / 60) * 10) / 10} hours` : `${a.durationMin} minutes`} />}
            {a.ages && <Fact icon={Users} label="Ages" value={a.ages} />}
            {a.groupMax && <Fact icon={Users} label="Group size" value={`${a.groupMin ?? 1}–${a.groupMax} people`} />}
          </div>

          <section className="mt-10">
            <h2 className="text-2xl font-extrabold">About</h2>
            {!a.about && media?.text ? (
              <>
                <p className="mt-3 max-w-[65ch] text-[17px]" lang={media.text.lang}>{media.text.text}</p>
                <p className="mt-2 text-xs text-ink-soft">
                  From{" "}
                  <a href={media.text.url} target="_blank" rel="noopener noreferrer" className="underline">
                    Wikipedia: {media.text.title}
                  </a>
                  , text under{" "}
                  <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" className="underline">
                    CC BY-SA 4.0
                  </a>
                </p>
              </>
            ) : (
              <p className="mt-3 max-w-[65ch] text-[17px]">{a.about ?? a.summary}</p>
            )}
            {a.special && (
              <div className="mt-5 rounded-[22px] bg-accent/40 p-5">
                <h3 className="font-sans text-sm font-extrabold uppercase tracking-wider text-accent-ink">What makes it special</h3>
                <p className="mt-1.5 font-display text-xl font-bold">{a.special}</p>
              </div>
            )}
            {a.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {a.tags.map((t) => (
                  <Link key={t} href={`/explore?tag=${t}`} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-bold">
                    <Tag className="size-3.5" /> {TAG_LABEL[t]}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {(a.deal || a.events?.length) && (
            <section className="mt-10">
              <h2 className="text-2xl font-extrabold">Offers & events</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {a.deal && <li className="rounded-2xl border-2 border-dashed border-accent bg-surface p-4 font-bold">{a.deal}</li>}
                {a.events?.map((e) => (
                  <li key={e.id} className="flex gap-3 rounded-2xl bg-surface p-4">
                    <CalendarDays className="size-5 shrink-0 text-accent-ink" />
                    <div>
                      <div className="font-bold">{e.title}{e.date && <span className="font-normal text-ink-soft"> · {new Date(e.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}</div>
                      {e.details && <p className="text-sm text-ink-soft">{e.details}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-10 grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-extrabold">Opening hours</h2>
              {a.hours ? (
                <table className="mt-3 w-full text-[15px] tabular">
                  <tbody>
                    {weekRows(a.hours).map((r) => (
                      <tr key={r.day} className={cn("border-b border-line", r.d === today && "font-extrabold")}>
                        <td className="py-2">{r.day}</td>
                        <td className="py-2 text-right">{formatRange(r.range)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : a.openingHoursRaw ? (
                <p className="mt-3 rounded-2xl bg-surface p-4 font-mono text-sm">{a.openingHoursRaw}</p>
              ) : (
                <p className="mt-3 text-ink-soft">
                  We don&apos;t have these yet.{" "}
                  {a.website ? (
                    <>
                      <a href={a.website} target="_blank" rel="noopener noreferrer" className="font-bold text-ink underline underline-offset-2">Their website</a> will know.
                    </>
                  ) : (
                    "Worth a quick check before you set off."
                  )}
                </p>
              )}
              {a.source === "osm" && a.openingHoursRaw && <p className="mt-2 text-xs text-ink-soft">From OpenStreetMap. Hours can be out of date.</p>}
            </div>
            <div>
              <h2 className="text-2xl font-extrabold">Before you go</h2>
              {a.booking !== "unknown" && (
                <p className="mt-3">
                  {a.booking === "partner" && "Book ahead through our booking partner. Popular times sell out."}
                  {a.booking === "walkin" && "No booking needed. Pay at the door."}
                  {a.booking === "free" && "Free. Just turn up."}
                  {a.booking === "venue" && "Book or check details directly with the venue."}
                </p>
              )}
              {a.accessible != null ? (
                <p className="mt-3 flex gap-2"><Accessibility className="mt-0.5 size-5 shrink-0 text-accent-ink" /> {a.accessNote}</p>
              ) : (
                <p className="mt-3 flex gap-2 text-ink-soft"><Accessibility className="mt-0.5 size-5 shrink-0" /> We don&apos;t know about step-free access here yet. Ask the venue if you need it.</p>
              )}
              {(a.website || a.phone) && (
                <ul className="mt-3 space-y-2 text-sm font-bold">
                  {a.website && (
                    <li>
                      <a href={a.website} target="_blank" rel="noopener noreferrer" onClick={() => logEvent(a.id, "website_click")} className="inline-flex items-center gap-2 underline underline-offset-2">
                        <Globe className="size-4" /> Website
                      </a>
                    </li>
                  )}
                  {a.phone && <li className="inline-flex items-center gap-2 select-all"><Phone className="size-4" /> {a.phone}</li>}
                </ul>
              )}
            </div>
          </section>

          <section id="location" className="mt-10 scroll-mt-24">
            <h2 className="text-2xl font-extrabold">Location</h2>
            {(isDemo || a.address) && <p className="mt-2 text-ink-soft">{isDemo ? "Demo listing, so this pin is a sample position with no real address." : a.address}</p>}
            <div className="mt-3 h-72">
              <DiscoveryMap activities={[a]} selectedId={a.id} showWalkRing={false} className="h-full" />
            </div>
            {a.osm && (
              <p className="mt-2 text-xs text-ink-soft">
                Details come from OpenStreetMap and can be out of date. Something wrong? <a href={`https://www.openstreetmap.org/${a.osm.type}/${a.osm.id}`} target="_blank" rel="noopener noreferrer" className="underline">Improve it on OpenStreetMap</a> or{" "}
                <Link href={`/business?claim=${a.id}`} className="underline">claim this listing</Link>.
              </p>
            )}
          </section>

          {/* Reviews appear once there are real ones to show; an empty heading promises something that isn't there. */}
          {isDemo && (
          <section className="mt-10">
            <h2 className="text-2xl font-extrabold">Reviews</h2>
            {isDemo ? (
              <>
                <p className="mt-1 text-sm text-ink-soft">Sample reviews to show the layout. They aren&apos;t from real visitors.</p>
                <ul className="mt-4 grid gap-3 md:grid-cols-3">
                  {sampleReviews(a.id).map((r, i) => (
                    <li key={i} className="rounded-2xl bg-surface p-4">
                      <div className="flex gap-0.5" aria-label={`${r.stars} out of 5`}>
                        {Array.from({ length: 5 }).map((_, s) => (
                          <Star key={s} className={cn("size-4", s < r.stars ? "fill-accent text-accent-ink" : "text-line")} />
                        ))}
                      </div>
                      <p className="mt-2 text-[15px]">{r.text}</p>
                      <p className="mt-2 text-xs font-bold text-ink-soft">{r.who}</p>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-3 text-ink-soft">No reviews yet. OpenStreetMap doesn&apos;t include reviews, and we won&apos;t make any up.</p>
            )}
          </section>
          )}
        </div>

        <aside>
          <div className="sticky top-24 rounded-[24px] bg-surface p-5 shadow-card">
            {a.price === 0 ? (
              <>
                <div className="inline-block rotate-[-3deg] rounded-xl bg-accent px-4 py-2 font-display text-3xl font-extrabold text-forest">FREE</div>
                <p className="mt-3 font-bold">{a.booking === "free" ? "No ticket, no booking. Just turn up." : "Free to visit."}</p>
                {a.priceNote && <p className="mt-1 text-sm text-ink-soft">{a.priceNote}</p>}
              </>
            ) : a.price != null ? (
              <>
                <div className="font-display text-4xl font-extrabold tabular">{priceLabel(a.price)}</div>
                {a.priceNote && <p className="text-sm text-ink-soft">{a.priceNote}</p>}
              </>
            ) : (
              <>
                <div className="font-display text-3xl font-extrabold">Fancy it?</div>
                <p className="mt-1 text-sm text-ink-soft">{a.website ? "Check prices and times with the venue, then go." : "Save it for later, or head straight there."}</p>
              </>
            )}
            {a.deal && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm font-bold">{a.deal}</p>}
            <div className="mt-5 flex flex-col gap-2">
              {a.booking === "partner" ? (
                <button
                  type="button"
                  onClick={() => {
                    logEvent(a.id, "booking_click");
                    setBooking(true);
                  }}
                  className="rounded-full bg-primary py-3.5 font-extrabold text-on-primary"
                >
                  Check availability &amp; book
                </button>
              ) : a.website ? (
                // A real venue's own site opens directly: no partner is involved, so there is nothing to explain first.
                <a
                  href={a.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logEvent(a.id, "website_click")}
                  className="flex items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-extrabold text-on-primary"
                >
                  Visit their website <ExternalLink className="size-4" />
                </a>
              ) : a.booking === "venue" ? (
                <p className="rounded-xl bg-surface-2 p-3 text-sm">Book directly with the venue. {isDemo && "(Demo listing: no real contact details.)"}</p>
              ) : null}
              {directionsUrl && (
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer" onClick={() => logEvent(a.id, "directions")} className="rounded-full border border-line py-3 text-center font-extrabold">
                  Walking directions
                </a>
              )}
            </div>
            {(status.open !== null || a.durationMin) && (
              <p className="mt-4 text-xs text-ink-soft">{[status.open !== null ? status.text : null, a.durationMin ? `about ${a.durationMin} min` : null].filter(Boolean).join(" · ")}</p>
            )}
          </div>
        </aside>
      </div>

      {nearby.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-5 text-3xl font-extrabold">While you&apos;re in the area</h2>
          <div className="rail">
            {nearby.map((x) => (
              <ActivityCard key={x.id} a={x} compact />
            ))}
          </div>
        </section>
      )}

      <BookingDialog a={a} open={booking} onClose={() => setBooking(false)} />
    </div>
  );
}
