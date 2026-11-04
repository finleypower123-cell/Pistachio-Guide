"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Heart, Home, Map, Sparkles, User } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/explore", label: "Explore", Icon: Compass },
  null,
  { href: "/map", label: "Map", Icon: Map },
  { href: "/saved", label: "Saved", Icon: Heart },
  { href: "/profile", label: "You", Icon: User },
] as const;

export function BottomNav() {
  const path = usePathname();
  const { setSurpriseOpen } = useApp();
  return (
    <nav
      aria-label="App"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      style={{ paddingLeft: "max(4px, env(safe-area-inset-left))", paddingRight: "max(4px, env(safe-area-inset-right))" }}
    >
      <div className="grid h-[68px] grid-cols-6 items-center">
        {ITEMS.map((it, i) =>
          it === null ? (
            <div key={i} className="flex justify-center">
              <button
                type="button"
                onClick={() => setSurpriseOpen(true)}
                className="-mt-7 grid size-14 place-items-center rounded-full bg-primary text-on-primary shadow-card ring-4 ring-bg active:scale-95"
                aria-label="Surprise me"
              >
                <Sparkles className="size-6" />
              </button>
            </div>
          ) : (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex flex-col items-center gap-0.5 text-[11px] font-bold text-ink-soft",
                (it.href === "/" ? path === "/" : path.startsWith(it.href)) && "text-ink",
              )}
            >
              <it.Icon className="size-[22px]" strokeWidth={path === it.href ? 2.4 : 2} />
              {it.label}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
