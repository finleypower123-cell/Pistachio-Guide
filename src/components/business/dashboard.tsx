"use client";

import Link from "next/link";
import { BarChart3, CalendarDays, Camera, Check, Crown, Eye, Heart, MousePointerClick, Pencil, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { useUser } from "@/components/providers/user-provider";
import { ActivityArt } from "@/components/ui/activity-art";
import { SourceBadge } from "@/components/ui/badges";
import { useToast } from "@/components/ui/toast";
import { bucket, cloudEventsFor, localEventsFor, type DailyStats } from "@/lib/analytics";
import { saveBusiness, uploadPhoto, type BusinessRecord } from "@/lib/business";
import { CAT } from "@/lib/categories";
import { H } from "@/lib/hours";
import { canFeature, canOffer, PLANS, type PlanId } from "@/lib/plans";
import type { Activity, BusinessEvent, WeeklyHours } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "overview" | "listing" | "photos" | "offers" | "plan";
const TABS: { id: Tab; label: string; Icon: typeof Eye }[] = [
  { id: "overview", label: "Analytics", Icon: BarChart3 },
  { id: "listing", label: "Listing", Icon: Pencil },
  { id: "photos", label: "Photos", Icon: Camera },
  { id: "offers", label: "Offers & events", Icon: CalendarDays },
  { id: "plan", label: "Plan", Icon: Crown },
];

const input = "w-full rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-primary";
const DAYS = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Chart({ data }: { data: DailyStats[] }) {
  const max = Math.max(4, ...data.map((d) => d.view));
  const W = 560, Hh = 180, padL = 28, padB = 24;
  const bw = (W - padL) / data.length;
  const ticks = [0, Math.round(max / 2), max];
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${Hh}`} className="min-w-[420px]" role="img" aria-label="Listing views and clicks over the last 14 days">
        {ticks.map((t) => {
          const y = Hh - padB - (t / max) * (Hh - padB - 10);
          return (
            <g key={t}>
              <line x1={padL} x2={W} y1={y} y2={y} stroke="var(--line)" />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="11" fill="var(--ink-soft)">{t}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.view / max) * (Hh - padB - 10);
          const clicks = d.booking_click + d.website_click + d.directions;
          const ch = (clicks / max) * (Hh - padB - 10);
          const x = padL + i * bw + bw * 0.18;
          return (
            <g key={d.day}>
              <rect x={x} y={Hh - padB - h} width={bw * 0.64} height={Math.max(h, d.view ? 2 : 0)} rx="4" fill="var(--accent)">
                <title>{`${d.day}: ${d.view} views, ${clicks} clicks`}</title>
              </rect>
              <rect x={x + bw * 0.16} y={Hh - padB - ch} width={bw * 0.32} height={Math.max(ch, clicks ? 2 : 0)} rx="3" fill="var(--primary)" />
              {i % 2 === 0 && (
                <text x={x + bw * 0.32} y={Hh - 6} textAnchor="middle" fontSize="10" fill="var(--ink-soft)">
                  {new Date(d.day).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex gap-4 text-xs font-semibold text-ink-soft">
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-accent" /> Views</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-primary" /> Clicks (booking, website, directions)</span>
      </div>
    </div>
  );
}

function Overview({ rec, a }: { rec: BusinessRecord; a: Activity }) {
  const [rows, setRows] = useState<DailyStats[] | null>(null);
  const [source, setSource] = useState<"cloud" | "device">("device");
  useEffect(() => {
    (async () => {
      if (rec.storage === "cloud") {
        const ev = await cloudEventsFor(rec.activityId);
        if (ev) {
          setSource("cloud");
          setRows(bucket(ev));
          return;
        }
      }
      setSource("device");
      setRows(bucket(localEventsFor(rec.activityId)));
    })();
  }, [rec.activityId, rec.storage]);

  if (!rows) return <p className="text-ink-soft">Loading analytics…</p>;
  const sum = (k: keyof Omit<DailyStats, "day">) => rows.reduce((s, r) => s + r[k], 0);
  const views = sum("view");
  const clicks = sum("booking_click") + sum("website_click") + sum("directions");
  const tiles = [
    { label: "Listing views", value: views, Icon: Eye },
    { label: "Saves", value: sum("save"), Icon: Heart },
    { label: "Booking clicks", value: sum("booking_click"), Icon: MousePointerClick },
    { label: "Click-through", value: views ? `${Math.round((clicks / views) * 100)}%` : "—", Icon: BarChart3 },
  ];
  return (
    <div>
      <p className="mb-4 rounded-2xl bg-surface-2 p-3 text-sm">
        {source === "cloud"
          ? "Last 14 days, from every visitor."
          : "Last 14 days, counted on this device only. Connect Supabase to see every visitor. Open your public listing and press buttons to watch these move."}
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl bg-surface p-4">
            <t.Icon className="size-5 text-accent-ink" />
            <div className="mt-2 font-display text-3xl font-bold tabular">{t.value}</div>
            <div className="text-sm text-ink-soft">{t.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-2xl bg-surface p-4">
        <Chart data={rows} />
      </div>
      <Link href={`/activity/${a.id}`} className="mt-4 inline-block font-extrabold underline">View your public listing</Link>
    </div>
  );
}

function HoursEditor({ value, onChange }: { value: WeeklyHours; onChange: (h: WeeklyHours) => void }) {
  const set = (d: number, r: [number, number] | null) => {
    const next = [...value];
    next[d] = r;
    onChange(next);
  };
  const hours = Array.from({ length: 25 }, (_, i) => i);
  return (
    <div className="flex flex-col gap-2">
      {DAYS.map((d) => {
        const r = value[d];
        return (
          <div key={d} className="flex flex-wrap items-center gap-2">
            <span className="w-10 font-bold">{DAY_SHORT[d]}</span>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={!r} onChange={(e) => set(d, e.target.checked ? null : [10, 18])} className="accent-[var(--primary)]" /> Closed
            </label>
            {r && (
              <>
                <label className="sr-only" htmlFor={`open-${d}`}>{DAY_SHORT[d]} opens</label>
                <select id={`open-${d}`} value={r[0]} onChange={(e) => set(d, [Number(e.target.value), r[1]])} className="rounded-xl border border-line bg-surface px-2 py-1.5 tabular">
                  {hours.slice(0, 24).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                </select>
                <span>to</span>
                <label className="sr-only" htmlFor={`close-${d}`}>{DAY_SHORT[d]} closes</label>
                <select id={`close-${d}`} value={r[1]} onChange={(e) => set(d, [r[0], Number(e.target.value)])} className="rounded-xl border border-line bg-surface px-2 py-1.5 tabular">
                  {hours.slice(1).map((h) => <option key={h} value={h}>{h === 24 ? "Midnight" : `${String(h).padStart(2, "0")}:00`}</option>)}
                </select>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ListingEditor({ rec, a, onSave }: { rec: BusinessRecord; a: Activity; onSave: (r: BusinessRecord) => Promise<void> }) {
  const [name, setName] = useState(rec.listing.name ?? a.name);
  const [summary, setSummary] = useState(rec.listing.summary ?? a.summary);
  const [about, setAbout] = useState(rec.listing.about ?? a.about ?? "");
  const [price, setPrice] = useState<string>(rec.listing.price != null ? String(rec.listing.price) : a.price != null ? String(a.price) : "");
  const [priceNote, setPriceNote] = useState(rec.listing.priceNote ?? a.priceNote ?? "");
  const [website, setWebsite] = useState(rec.listing.website ?? a.website ?? "");
  const [phone, setPhone] = useState(rec.listing.phone ?? a.phone ?? "");
  const [accessNote, setAccessNote] = useState(rec.listing.accessNote ?? a.accessNote ?? "");
  const [hours, setHours] = useState<WeeklyHours>(rec.listing.hours ?? a.hours ?? H(10, 18));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (website && !/^https?:\/\//.test(website)) return setErr("Website must start with https://");
        setErr(null);
        setBusy(true);
        await onSave({
          ...rec,
          listing: {
            name: name.trim(),
            summary: summary.trim(),
            about: about.trim(),
            price: price === "" ? null : Math.max(0, Number(price)),
            priceNote: priceNote.trim(),
            website: website.trim(),
            phone: phone.trim(),
            accessNote: accessNote.trim(),
            hours,
          },
        });
        setBusy(false);
      }}
      className="grid gap-4 md:grid-cols-2"
    >
      <div className="md:col-span-2">
        <label htmlFor="b-name" className="mb-1 block text-sm font-bold">Business name</label>
        <input id="b-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className={input} />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="b-summary" className="mb-1 block text-sm font-bold">One-line description</label>
        <input id="b-summary" value={summary} onChange={(e) => setSummary(e.target.value)} required maxLength={160} className={input} />
        <p className="mt-1 text-xs text-ink-soft tabular">{summary.length}/160 · shown on cards</p>
      </div>
      <div className="md:col-span-2">
        <label htmlFor="b-about" className="mb-1 block text-sm font-bold">About</label>
        <textarea id="b-about" value={about} onChange={(e) => setAbout(e.target.value)} rows={4} maxLength={1200} className={input} />
      </div>
      <div>
        <label htmlFor="b-price" className="mb-1 block text-sm font-bold">Price per person (£)</label>
        <input id="b-price" type="number" inputMode="decimal" min={0} step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Leave blank if it varies" className={input} />
        <p className="mt-1 text-xs text-ink-soft">Use 0 for free.</p>
      </div>
      <div>
        <label htmlFor="b-pnote" className="mb-1 block text-sm font-bold">Price note</label>
        <input id="b-pnote" value={priceNote} onChange={(e) => setPriceNote(e.target.value)} placeholder="e.g. per hour, kids £6" maxLength={80} className={input} />
      </div>
      <div>
        <label htmlFor="b-web" className="mb-1 block text-sm font-bold">Website or booking link</label>
        <input id="b-web" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" className={input} />
      </div>
      <div>
        <label htmlFor="b-phone" className="mb-1 block text-sm font-bold">Phone</label>
        <input id="b-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="b-access" className="mb-1 block text-sm font-bold">Accessibility</label>
        <input id="b-access" value={accessNote} onChange={(e) => setAccessNote(e.target.value)} placeholder="Step-free entrance, accessible toilet…" maxLength={200} className={input} />
      </div>
      <fieldset className="md:col-span-2">
        <legend className="mb-2 text-sm font-bold">Opening hours</legend>
        <HoursEditor value={hours} onChange={setHours} />
      </fieldset>
      {err && <p className="text-sm font-bold text-warn md:col-span-2" role="alert">{err}</p>}
      <button type="submit" disabled={busy} className="rounded-full bg-primary py-3.5 font-extrabold text-on-primary disabled:opacity-60 md:col-span-2">
        {busy ? "Saving…" : "Save listing"}
      </button>
    </form>
  );
}

function Photos({ rec, onSave }: { rec: BusinessRecord; onSave: (r: BusinessRecord) => Promise<void> }) {
  const { user } = useUser();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const limit = rec.plan === "free" ? 5 : 20;
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const urls: string[] = [];
    for (const f of [...files].slice(0, limit - rec.photos.length)) {
      const r = await uploadPhoto(rec, f, user?.id ?? null);
      if (r.error) toast(r.error);
      if (r.url) urls.push(r.url);
    }
    if (urls.length) await onSave({ ...rec, photos: [...rec.photos, ...urls] });
    setBusy(false);
  };
  return (
    <div>
      <p className="mb-4 text-sm text-ink-soft">
        {rec.photos.length}/{limit} photos. The first photo is your cover image.{" "}
        {rec.storage === "device" && "In demo mode, photos are stored on this device only."}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {rec.photos.map((p, i) => (
          <div key={p.slice(-40) + i} className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p} alt={`Listing photo ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-forest px-2 py-0.5 text-xs font-bold text-cream">Cover</span>}
            <button type="button" onClick={() => onSave({ ...rec, photos: rec.photos.filter((_, j) => j !== i) })} aria-label={`Delete photo ${i + 1}`} className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-surface/90">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {rec.photos.length < limit && (
          <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-surface text-sm font-bold hover:border-primary">
            <Upload className="size-6" />
            {busy ? "Uploading…" : "Add photos"}
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} disabled={busy} />
          </label>
        )}
      </div>
    </div>
  );
}

function Offers({ rec, onSave }: { rec: BusinessRecord; onSave: (r: BusinessRecord) => Promise<void> }) {
  const [kind, setKind] = useState<"offer" | "event">("offer");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [date, setDate] = useState("");
  const allowed = canOffer(rec.plan);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const item: BusinessEvent = { id: crypto.randomUUID(), kind, title: title.trim(), details: details.trim(), date: date || undefined };
          await onSave({ ...rec, offers: [item, ...rec.offers] });
          setTitle("");
          setDetails("");
          setDate("");
        }}
        className="flex flex-col gap-3 rounded-2xl bg-surface p-4"
      >
        <div className="flex rounded-full border border-line p-1" role="group" aria-label="Type">
          {(["offer", "event"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={cn("flex-1 rounded-full py-2 text-sm font-extrabold capitalize", kind === k && "bg-primary text-on-primary")}>
              {k === "offer" ? "Offer / deal" : "Event"}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="o-title" className="mb-1 block text-sm font-bold">{kind === "offer" ? "Offer" : "Event name"}</label>
          <input id="o-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={90} placeholder={kind === "offer" ? "e.g. 2-for-1 on weekday mornings" : "e.g. Late-night retro tournament"} className={input} />
        </div>
        <div>
          <label htmlFor="o-details" className="mb-1 block text-sm font-bold">Details</label>
          <textarea id="o-details" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={300} className={input} />
        </div>
        <div>
          <label htmlFor="o-date" className="mb-1 block text-sm font-bold">{kind === "offer" ? "Ends on (optional)" : "Date"}</label>
          <input id="o-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required={kind === "event"} className={input} />
        </div>
        <button type="submit" className="rounded-full bg-primary py-3 font-extrabold text-on-primary">Add {kind}</button>
        {!allowed && <p className="text-sm text-warn">Offers and events go live on the Local plan or above. You can draft them now.</p>}
      </form>
      <ul className="flex flex-col gap-2">
        {rec.offers.length === 0 && <li className="rounded-2xl bg-surface-2 p-4 text-ink-soft">No offers or events yet.</li>}
        {rec.offers.map((o) => (
          <li key={o.id} className="flex items-start gap-3 rounded-2xl bg-surface p-4">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-extrabold", o.kind === "offer" ? "bg-accent text-forest" : "bg-surface-2")}>{o.kind}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{o.title}</p>
              {o.details && <p className="text-sm text-ink-soft">{o.details}</p>}
              {o.date && <p className="text-xs text-ink-soft">{new Date(o.date).toLocaleDateString("en-GB", { dateStyle: "medium" })}</p>}
              <p className="mt-1 text-xs font-bold">{allowed ? "Live on your listing" : "Draft · needs Local plan"}</p>
            </div>
            <button type="button" onClick={() => onSave({ ...rec, offers: rec.offers.filter((x) => x.id !== o.id) })} aria-label={`Delete ${o.title}`} className="grid size-9 place-items-center rounded-full bg-surface-2">
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlanCards({ current, onChoose }: { current?: PlanId; onChoose?: (p: PlanId) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {PLANS.map((p) => (
        <div key={p.id} className={cn("flex flex-col rounded-[24px] p-6", p.id === "featured" ? "bg-forest text-cream" : "bg-surface shadow-card", current === p.id && "ring-4 ring-accent")}>
          <h3 className="text-2xl font-extrabold">{p.name}</h3>
          <p className="mt-1 text-sm opacity-80">{p.pitch}</p>
          <p className="mt-4 font-display text-4xl font-extrabold tabular">
            {p.priceMonthly ? `£${p.priceMonthly}` : "£0"}
            <span className="text-base font-bold opacity-70">/month</span>
          </p>
          <ul className="mt-4 flex-1 space-y-2 text-sm">
            {p.features.map((f) => (
              <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" /> {f}</li>
            ))}
          </ul>
          {onChoose && (
            <button type="button" disabled={current === p.id} onClick={() => onChoose(p.id)}
              className={cn("mt-5 rounded-full py-3 font-extrabold disabled:opacity-70", p.id === "featured" ? "bg-pistachio text-forest" : "bg-primary text-on-primary")}>
              {current === p.id ? "Current plan" : `Choose ${p.name}`}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function PlanTab({ rec, onSave }: { rec: BusinessRecord; onSave: (r: BusinessRecord) => Promise<void> }) {
  const toast = useToast();
  const choose = async (plan: PlanId) => {
    if (rec.storage === "cloud") {
      toast("Billing isn't connected yet, so plans can't be changed here. No payment was taken.");
      return;
    }
    await onSave({ ...rec, plan, featured: canFeature(plan) ? rec.featured : false });
    toast(`Previewing the ${PLANS.find((p) => p.id === plan)!.name} plan. No payment taken.`);
  };
  return (
    <div>
      <p className="mb-4 rounded-2xl bg-sponsor-bg p-3 text-sm text-sponsor-ink">
        Billing isn&apos;t switched on in this build. {rec.storage === "device" ? "Choosing a plan previews its features on this device. Nobody is charged." : "Plans are managed by the Pistachio team for now."}
      </p>
      <PlanCards current={rec.plan} onChoose={choose} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface p-4">
        <div>
          <p className="font-bold">Show in Featured partner slots</p>
          <p className="text-sm text-ink-soft">Always labelled Sponsored. {canFeature(rec.plan) ? "" : "Needs the Featured plan."}</p>
        </div>
        <label htmlFor="feat" className="flex items-center gap-2 font-bold">
          <input id="feat" type="checkbox" disabled={!canFeature(rec.plan)} checked={rec.featured} onChange={(e) => void onSave({ ...rec, featured: e.target.checked })} className="size-6 accent-[var(--primary)]" />
          {rec.featured ? "On" : "Off"}
        </label>
      </div>
    </div>
  );
}

export function BusinessDashboard({ rec, setRec }: { rec: BusinessRecord; setRec: (r: BusinessRecord) => void }) {
  const { findActivity, refreshOverlays } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const a = findActivity(rec.activityId);
  const save = async (next: BusinessRecord) => {
    const { error } = await saveBusiness(next);
    if (error) return toast(error);
    setRec(next);
    refreshOverlays();
    toast("Saved");
  };
  const fallback = useMemo<Activity>(
    () => ({ id: rec.activityId, source: "osm", name: rec.listing.name ?? "Your listing", category: "leisure", lat: 0, lng: 0, tags: [], summary: rec.listing.summary ?? "", booking: "unknown" }),
    [rec],
  );
  const act = a ?? fallback;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 rounded-[24px] bg-surface p-4 shadow-card">
        <span className="block size-16 overflow-hidden rounded-2xl"><ActivityArt activity={act} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-extrabold">{act.name}</h2>
            <SourceBadge a={act} />
          </div>
          <p className="text-sm text-ink-soft">
            {CAT[act.category].short} · {PLANS.find((p) => p.id === rec.plan)!.name} plan ·{" "}
            <span className={cn("font-bold", rec.status === "verified" ? "text-ok" : "text-warn")}>
              {rec.status === "verified" ? "Verified" : "Verification pending"}
            </span>
          </p>
        </div>
      </div>
      {rec.status === "pending" && (
        <p className="mt-3 rounded-2xl bg-surface-2 p-3 text-sm">
          {rec.storage === "device"
            ? "Demo mode: your edits show on this device straight away. In production we verify ownership (by phone or a code sent to the venue's listed contact) before edits go public."
            : "We'll verify ownership with the venue's listed contact before your edits go public."}
        </p>
      )}
      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn("flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-extrabold", tab === t.id ? "bg-primary text-on-primary" : "bg-surface")}>
            <t.Icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tab === "overview" && <Overview rec={rec} a={act} />}
        {tab === "listing" && <ListingEditor key={rec.activityId} rec={rec} a={act} onSave={save} />}
        {tab === "photos" && <Photos rec={rec} onSave={save} />}
        {tab === "offers" && <Offers rec={rec} onSave={save} />}
        {tab === "plan" && <PlanTab rec={rec} onSave={save} />}
      </div>
    </div>
  );
}
