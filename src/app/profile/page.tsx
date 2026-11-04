"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ActivityCard } from "@/components/activity/activity-card";
import { AuthForm } from "@/components/account/auth-form";
import { useApp } from "@/components/providers/app-provider";
import { useUser } from "@/components/providers/user-provider";
import { useToast } from "@/components/ui/toast";
import { CATEGORIES } from "@/lib/categories";
import { distanceKm } from "@/lib/geo";
import { score } from "@/lib/search";
import type { CategoryId } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const { user, displayName, cloud, prefs, setPrefs, saved, recent, signOut, supabaseReady } = useUser();
  const { activities, place, weather, setSurpriseOpen } = useApp();
  const toast = useToast();

  const toggleCat = (c: CategoryId) =>
    setPrefs({ ...prefs, categories: prefs.categories.includes(c) ? prefs.categories.filter((x) => x !== c) : [...prefs.categories, c] });

  const picks = useMemo(() => {
    const savedCats = new Set(saved.map((s) => s.snapshot.category));
    return activities
      .filter((a) => distanceKm(place, a) <= 4 && !saved.some((s) => s.id === a.id))
      .filter((a) => prefs.budget >= 50 || a.price == null || a.price <= prefs.budget)
      .map((a) => {
        let s = score(a, place, weather);
        if (prefs.categories.includes(a.category)) s += 3;
        if (savedCats.has(a.category)) s += 1.5;
        return { a, s };
      })
      .sort((x, y) => y.s - x.s)
      .slice(0, 10)
      .map((x) => x.a);
  }, [activities, place, weather, prefs, saved]);

  return (
    <div className="gutter mx-auto max-w-7xl pb-10 pt-8">
      <h1 className="text-4xl font-extrabold md:text-5xl">{displayName ? `Hi, ${displayName.split(/[ @]/)[0]}` : "Your Pistachio"}</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="rounded-[24px] bg-surface p-6 shadow-card">
          <h2 className="text-2xl font-extrabold">Preferences</h2>
          <p className="mt-1 text-sm text-ink-soft">These shape your recommendations and Surprise Me. {cloud ? "Saved to your account." : "Saved on this device."}</p>

          <div className="mt-6">
            <label htmlFor="pref-budget" className="mb-2 flex justify-between font-bold">
              Usual budget per person <span className="tabular">{prefs.budget >= 50 ? "Any" : `Up to £${prefs.budget}`}</span>
            </label>
            <input id="pref-budget" type="range" min={0} max={50} value={prefs.budget} onChange={(e) => setPrefs({ ...prefs, budget: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
          </div>

          <label htmlFor="pref-weather" className="mt-6 flex cursor-pointer items-center justify-between gap-3 font-bold">
            <span>
              Weather-smart suggestions
              <span className="block text-sm font-normal text-ink-soft">Skip outdoor ideas when it&apos;s raining.</span>
            </span>
            <input id="pref-weather" type="checkbox" checked={prefs.weatherSmart} onChange={(e) => setPrefs({ ...prefs, weatherSmart: e.target.checked })} className="size-6 accent-[var(--primary)]" />
          </label>

          <fieldset className="mt-6">
            <legend className="mb-2 font-bold">Favourite kinds of things</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" aria-pressed={prefs.categories.includes(c.id)} onClick={() => toggleCat(c.id)}
                  className={cn("rounded-full border px-3 py-1.5 text-sm font-bold", prefs.categories.includes(c.id) ? "border-primary bg-primary text-on-primary" : "border-line bg-surface")}>
                  {c.label}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="button" onClick={() => setSurpriseOpen(true)} className="mt-6 rounded-full bg-accent px-5 py-3 font-extrabold text-forest">Try Surprise Me</button>
        </section>

        <section className="rounded-[24px] bg-surface p-6 shadow-card">
          <h2 className="mb-4 text-2xl font-extrabold">Account</h2>
          {user ? (
            <div>
              <p className="font-bold">{user.email}</p>
              <p className="mt-1 text-sm text-ink-soft">Saved places, history and preferences sync across your devices.</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <Link href="/saved" className="rounded-2xl bg-surface-2 p-3"><span className="block font-display text-2xl font-bold tabular">{saved.length}</span><span className="text-sm">saved</span></Link>
                <Link href="/saved" className="rounded-2xl bg-surface-2 p-3"><span className="block font-display text-2xl font-bold tabular">{recent.length}</span><span className="text-sm">viewed</span></Link>
              </div>
              <button type="button" onClick={async () => { await signOut(); toast("Signed out"); }} className="mt-4 w-full rounded-full border border-line py-3 font-extrabold">Sign out</button>
            </div>
          ) : (
            <>
              {supabaseReady && <p className="mb-4 text-sm text-ink-soft">Anything you&apos;ve saved on this device moves into your account when you sign in.</p>}
              <AuthForm />
            </>
          )}
          <Link href="/business" className="mt-6 block rounded-2xl bg-surface-2 p-4 text-sm">
            <strong>Own a venue?</strong> Claim your listing and add offers in the business portal.
          </Link>
        </section>
      </div>

      <section className="mt-12">
        <h2 className="mb-1 text-3xl font-extrabold">Picked for you</h2>
        <p className="mb-5 text-ink-soft">Based on your favourites, budget, saves{weather ? " and today's weather" : ""} near {place.label}.</p>
        <div className="rail">{picks.map((a) => <ActivityCard key={a.id} a={a} />)}</div>
      </section>
    </div>
  );
}
