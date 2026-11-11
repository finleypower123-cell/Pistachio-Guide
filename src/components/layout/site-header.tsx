"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, MapPin, Search, Store } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { useUser } from "@/components/providers/user-provider";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import { hasSupabase } from "@/lib/supabase/config";

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/categories", label: "Categories" },
  { href: "/explore?price=free", label: "Free Things" },
  { href: "/map", label: "Map" },
  { href: "/saved", label: "Saved" },
];

export function SiteHeader() {
  const path = usePathname();
  const { place, setLocationOpen, setSearchOpen } = useApp();
  const { displayName, saved } = useUser();
  const initial = (displayName ?? "").trim().charAt(0).toUpperCase();
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-50 border-b border-line/70 bg-bg/90 backdrop-blur-md">
      <div className="gutter mx-auto flex h-16 max-w-7xl items-center gap-3">
        <Link href="/" className="shrink-0" aria-label="Pistachio Guide home">
          <Logo />
        </Link>
        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Main">
          {LINKS.map((l) => {
            const active = l.href === "/explore" ? path === "/explore" : path === l.href.split("?")[0] && l.href !== "/explore?price=free";
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn("rounded-full px-3.5 py-2 text-[15px] font-bold transition hover:bg-surface-2", active && "bg-surface-2")}
              >
                {l.label}
                {l.href === "/saved" && saved.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[11px] text-forest tabular">{saved.length}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setLocationOpen(true)}
            className="flex min-w-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-2 text-sm font-bold"
            aria-label={`Location: ${place.label}. Change location`}
          >
            <MapPin className="size-4 shrink-0 text-accent-ink" />
            <span className="max-w-[9rem] truncate">{place.label}</span>
            <ChevronDown className="size-4 shrink-0 text-ink-soft" />
          </button>
          <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search" className="grid size-10 place-items-center rounded-full bg-surface-2">
            <Search className="size-[18px]" />
          </button>
          <Link href="/business" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold hover:bg-surface-2 xl:flex">
            <Store className="size-4" /> For business
          </Link>
          {/* Without accounts connected there is nothing to sign in to, so the button offers preferences instead. */}
          <Link
            href="/profile"
            className="hidden h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-extrabold text-on-primary md:flex"
            aria-label={displayName ? "Your profile" : hasSupabase ? "Sign in" : "Your preferences"}
          >
            {initial ? <span className="grid size-6 place-items-center">{initial}</span> : hasSupabase ? "Sign in" : "You"}
          </Link>
        </div>
      </div>
    </header>
  );
}
