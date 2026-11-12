import Link from "next/link";
import { PistachioMark } from "@/components/ui/logo";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-surface-2/60 pb-28 md:pb-10">
      <div className="gutter mx-auto grid max-w-7xl gap-8 py-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <PistachioMark className="size-8" />
            <span className="font-display text-lg font-bold">Pistachio Guide</span>
          </div>
          <p className="mt-3 text-sm text-ink-soft">Find the fun stuff. Hidden gems, weird little adventures and brilliant things to do near you.</p>
        </div>
        <div className="text-sm">
          <h2 className="mb-2 font-sans text-sm font-bold text-ink">Discover</h2>
          <ul className="space-y-1.5 font-semibold">
            <li><Link href="/explore">Explore</Link></li>
            <li><Link href="/categories">Categories</Link></li>
            <li><Link href="/map">Map</Link></li>
            <li><Link href="/explore?price=free">Free things</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <h2 className="mb-2 font-sans text-sm font-bold text-ink">Business</h2>
          <ul className="space-y-1.5 font-semibold">
            <li><Link href="/business">Claim your listing</Link></li>
            <li><Link href="/business#plans">Plans</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <h2 className="mb-2 font-sans text-sm font-bold text-ink">About the data</h2>
          <ul className="space-y-1.5 font-semibold">
            <li><Link href="/about">Sources & credits</Link></li>
          </ul>
        </div>
      </div>
      <p className="gutter mx-auto max-w-7xl text-xs text-ink-soft">
        Real places from © OpenStreetMap contributors and Overture Maps. Details can be out of date, so check with the venue before you go.
      </p>
    </footer>
  );
}
