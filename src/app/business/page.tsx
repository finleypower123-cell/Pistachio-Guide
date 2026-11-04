"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BarChart3, Megaphone, Search, Store, Tag } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BusinessDashboard, PlanCards } from "@/components/business/dashboard";
import { useApp } from "@/components/providers/app-provider";
import { useUser } from "@/components/providers/user-provider";
import { ActivityArt } from "@/components/ui/activity-art";
import { SourceBadge } from "@/components/ui/badges";
import { useToast } from "@/components/ui/toast";
import { claimListing, myBusinesses, type BusinessRecord } from "@/lib/business";
import { CAT } from "@/lib/categories";
import type { Activity } from "@/lib/types";
import { cn } from "@/lib/utils";

const input = "w-full rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-primary";

function ClaimFlow({ preselect, onClaimed }: { preselect?: string | null; onClaimed: (r: BusinessRecord) => void }) {
  const { activities, findActivity, place, setLocationOpen } = useApp();
  const { user, supabaseReady } = useUser();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Activity | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Owner");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (preselect && !picked) {
      const a = findActivity(preselect);
      if (a) setPicked(a);
    }
  }, [preselect, findActivity, picked]);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return activities.filter((a) => a.name.toLowerCase().includes(s)).slice(0, 8);
  }, [q, activities]);

  const needsLogin = supabaseReady && !user;

  return (
    <div className="rounded-[24px] bg-surface p-6 shadow-card">
      <h2 className="text-2xl font-extrabold">Claim your listing</h2>
      {!picked ? (
        <>
          <p className="mt-1 text-sm text-ink-soft">
            Search for your venue near{" "}
            <button type="button" onClick={() => setLocationOpen(true)} className="font-bold text-ink underline">{place.label}</button>. Real places come from OpenStreetMap.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 focus-within:border-primary">
            <Search className="size-5 text-ink-soft" />
            <label htmlFor="claim-q" className="sr-only">Business name</label>
            <input id="claim-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Business name" className="min-w-0 flex-1 bg-transparent py-3 outline-none" />
          </div>
          <ul className="mt-3 divide-y divide-line">
            {matches.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => setPicked(a)} className="flex w-full items-center gap-3 py-3 text-left">
                  <span className="block size-12 shrink-0 overflow-hidden rounded-xl"><ActivityArt activity={a} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{a.name}</span>
                    <span className="block truncate text-sm text-ink-soft">{a.typeLabel ?? CAT[a.category].short}{a.address ? ` · ${a.address}` : ""}</span>
                  </span>
                  <SourceBadge a={a} />
                </button>
              </li>
            ))}
            {q.trim().length >= 2 && matches.length === 0 && <li className="py-3 text-sm text-ink-soft">No match nearby. Change location, or add your venue to OpenStreetMap first.</li>}
          </ul>
          <p className="mt-3 text-xs text-ink-soft">Try “Slow Clay” to explore with a demo listing.</p>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const { record, error } = await claimListing(picked.id, { name: `${name} (${role})`, email }, user?.id ?? null);
            setBusy(false);
            if (error || !record) return toast(error ?? "Couldn't claim that listing.");
            toast("Listing claimed");
            onClaimed(record);
          }}
          className="mt-4 flex flex-col gap-3"
        >
          <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
            <span className="block size-12 shrink-0 overflow-hidden rounded-xl"><ActivityArt activity={picked} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{picked.name}</span>
              <span className="block text-sm text-ink-soft">{picked.typeLabel ?? CAT[picked.category].short}</span>
            </span>
            <button type="button" onClick={() => setPicked(null)} className="text-sm font-extrabold underline">Change</button>
          </div>
          {needsLogin ? (
            <div className="rounded-2xl bg-surface-2 p-4">
              <p className="font-bold">Sign in to claim this listing.</p>
              <Link href={`/login?next=${encodeURIComponent(`/business?claim=${picked.id}`)}`} className="mt-3 inline-block rounded-full bg-primary px-5 py-2.5 font-extrabold text-on-primary">Sign in or create account</Link>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="c-name" className="mb-1 block text-sm font-bold">Your name</label>
                  <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className={input} />
                </div>
                <div>
                  <label htmlFor="c-role" className="mb-1 block text-sm font-bold">Your role</label>
                  <select id="c-role" value={role} onChange={(e) => setRole(e.target.value)} className={input}>
                    <option>Owner</option>
                    <option>Manager</option>
                    <option>Marketing</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="c-email" className="mb-1 block text-sm font-bold">Work email</label>
                <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={input} />
              </div>
              <p className="text-xs text-ink-soft">We verify ownership using the venue&apos;s listed phone or website before edits go public.</p>
              <button type="submit" disabled={busy} className="rounded-full bg-primary py-3.5 font-extrabold text-on-primary disabled:opacity-60">
                {busy ? "Claiming…" : "Claim listing"}
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}

function BusinessInner() {
  const params = useSearchParams();
  const claimParam = params.get("claim");
  const { user, supabaseReady } = useUser();
  const [records, setRecords] = useState<BusinessRecord[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    myBusinesses(user?.id ?? null).then((r) => {
      setRecords(r);
      if (r.length && !activeId) setActiveId(claimParam && r.some((x) => x.activityId === claimParam) ? claimParam : r[0].activityId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const active = records?.find((r) => r.activityId === activeId) ?? null;
  const showClaim = claiming || (records !== null && records.length === 0) || Boolean(claimParam && records && !records.some((r) => r.activityId === claimParam));

  return (
    <div className="gutter mx-auto max-w-7xl pb-10 pt-8">
      <div className="grid items-end gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-bold"><Store className="size-4" /> Pistachio Guide for business</p>
          <h1 className="mt-4 text-4xl font-extrabold md:text-6xl">Get found by people looking for something fun.</h1>
          <p className="mt-3 max-w-xl text-lg text-ink-soft">Claim your listing for free, keep it accurate, then add offers and events when you want more footfall.</p>
        </div>
        <ul className="grid grid-cols-3 gap-2 text-sm">
          {[
            { Icon: Tag, t: "Offers & deals" },
            { Icon: Megaphone, t: "Promote events" },
            { Icon: BarChart3, t: "See what works" },
          ].map(({ Icon, t }) => (
            <li key={t} className="rounded-2xl bg-surface p-4 text-center font-bold shadow-card"><Icon className="mx-auto mb-2 size-6 text-accent-ink" />{t}</li>
          ))}
        </ul>
      </div>

      {!supabaseReady && (
        <p className="mt-6 rounded-2xl bg-demo-bg p-4 text-sm text-demo-ink">
          <strong>Demo mode.</strong> Claims, edits and photos are stored in this browser only so you can try the whole flow. Connect Supabase (see README) to make them real and shared.
        </p>
      )}

      <div className="mt-8">
        {records === null ? (
          <p className="text-ink-soft">Loading your listings…</p>
        ) : (
          <div className="flex flex-col gap-6">
            {records.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-ink-soft">Your listings:</span>
                {records.map((r) => (
                  <button key={r.activityId} type="button" onClick={() => { setActiveId(r.activityId); setClaiming(false); }}
                    className={cn("rounded-full border px-3.5 py-2 text-sm font-bold", r.activityId === activeId && !showClaim ? "border-primary bg-primary text-on-primary" : "border-line bg-surface")}>
                    {r.listing.name || r.activityId}
                  </button>
                ))}
                <button type="button" onClick={() => setClaiming(true)} className="rounded-full px-3 py-2 text-sm font-extrabold underline">+ Claim another</button>
              </div>
            )}
            {showClaim ? (
              <ClaimFlow
                preselect={claimParam}
                onClaimed={(rec) => {
                  setRecords((prev) => [...(prev ?? []).filter((x) => x.activityId !== rec.activityId), rec]);
                  setActiveId(rec.activityId);
                  setClaiming(false);
                }}
              />
            ) : (
              active && (
                <BusinessDashboard
                  rec={active}
                  setRec={(next) => setRecords((prev) => (prev ?? []).map((x) => (x.activityId === next.activityId ? next : x)))}
                />
              )
            )}
          </div>
        )}
      </div>

      <section id="plans" className="mt-16 scroll-mt-24">
        <h2 className="text-3xl font-extrabold md:text-4xl">Plans</h2>
        <p className="mb-6 mt-1 text-ink-soft">Start free. Upgrade when you want offers, events or a featured spot. Sponsored placements are always labelled.</p>
        <PlanCards />
      </section>
    </div>
  );
}

export default function BusinessPage() {
  return (
    <Suspense>
      <BusinessInner />
    </Suspense>
  );
}
