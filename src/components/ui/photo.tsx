"use client";

import { useEffect, useRef, useState } from "react";
import type { PhotoCredit } from "@/lib/types";
import { thumbSrcSet } from "@/lib/wiki";
import { cn } from "@/lib/utils";

/**
 * A real photo laid over its placeholder. The box is sized by the parent, so nothing moves when
 * the photo arrives: it fades in over the illustration, and if it fails to load the illustration
 * simply stays. Photos load lazily and at a size that fits the box, never the full original.
 */
export function Photo({ src, alt, hero = false, sizes, className }: { src: string; alt: string; hero?: boolean; sizes?: string; className?: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "shown" | "failed">("loading");

  // A cached image can finish loading before React attaches its handlers.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete) setState(img.naturalWidth > 0 ? "shown" : "failed");
  }, [src]);

  if (state === "failed") return null;
  const srcSet = thumbSrcSet(src, hero);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? (sizes ?? (hero ? "(max-width: 768px) 90vw, 640px" : "(max-width: 640px) 160px, 420px")) : undefined}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setState("shown")}
      onError={() => setState("failed")}
      className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-500", state === "shown" ? "opacity-100" : "opacity-0", className)}
    />
  );
}

/** A small, unobtrusive credit that links to the photo's own page, where the full licence is. */
export function PhotoCreditMark({ credit, className }: { credit: PhotoCredit; className?: string }) {
  return (
    <a
      href={credit.page}
      target="_blank"
      rel="noopener noreferrer"
      title={["Photo", credit.by && `by ${credit.by}`, credit.license, "via Wikimedia Commons"].filter(Boolean).join(" · ")}
      className={cn("rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white/95 hover:bg-black/75", className)}
    >
      Wikimedia<span className="sr-only"> Commons photo credit</span>
    </a>
  );
}
