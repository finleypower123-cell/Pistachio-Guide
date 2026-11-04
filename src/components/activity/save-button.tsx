"use client";

import { Heart } from "lucide-react";
import { useUser } from "@/components/providers/user-provider";
import { useToast } from "@/components/ui/toast";
import type { Activity } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SaveButton({ a, className, withLabel = false }: { a: Activity; className?: string; withLabel?: boolean }) {
  const { isSaved, toggleSave } = useUser();
  const toast = useToast();
  const saved = isSaved(a.id);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={withLabel ? undefined : saved ? `Remove ${a.name} from saved` : `Save ${a.name}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSave(a);
        toast(saved ? "Removed from saved" : "Saved");
      }}
      className={cn(
        "relative z-10 inline-flex items-center justify-center gap-2 rounded-full transition active:scale-95",
        withLabel ? "border border-line bg-surface px-4 py-2.5 text-sm font-bold" : "size-10 bg-surface/95 shadow-card backdrop-blur",
        className,
      )}
    >
      <Heart className={cn("size-[18px]", saved ? "fill-[#d0573f] text-[#d0573f]" : "text-ink")} />
      {withLabel && (saved ? "Saved" : "Save")}
    </button>
  );
}
