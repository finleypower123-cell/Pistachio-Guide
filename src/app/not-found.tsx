import Link from "next/link";
import type { Metadata } from "next";
import { PistachioMark } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="gutter mx-auto flex max-w-xl flex-col items-center py-20 text-center">
      <PistachioMark className="size-16" />
      <h1 className="mt-6 text-4xl font-extrabold md:text-5xl">Well, this is a dead end.</h1>
      <p className="mt-3 text-lg text-ink-soft">That page has wandered off. The good stuff is still out there, though.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/explore" className="rounded-full bg-primary px-6 py-3 font-extrabold text-on-primary">
          Explore nearby
        </Link>
        <Link href="/" className="rounded-full border border-line bg-surface px-6 py-3 font-extrabold">
          Back to the start
        </Link>
      </div>
    </div>
  );
}
