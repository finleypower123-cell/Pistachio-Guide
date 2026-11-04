"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Accessible modal: centred card on desktop, bottom sheet on phones. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      const el = ref.current?.querySelector<HTMLElement>("input, button:not([data-close]), a, select, textarea");
      el?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" data-close className="absolute inset-0 bg-[rgb(18_26_21/0.5)] backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        className={cn(
          "animate-pop relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-bg p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-card md:max-w-lg md:rounded-[28px] md:p-7",
          className,
        )}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line md:hidden" />
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button type="button" data-close onClick={onClose} aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
