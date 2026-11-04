import { memo } from "react";
import { CAT, type IconKey } from "@/lib/categories";
import type { Activity, CategoryId } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Category illustrations used until a venue uploads real photos.
 * Generated SVG (no external images), seeded per listing so each card looks distinct.
 */

const PALETTES: [string, string, string][] = [
  ["#A8C686", "#D7E6C4", "#254C38"],
  ["#254C38", "#3E6A50", "#F7F5EC"],
  ["#E5EEDC", "#A8C686", "#254C38"],
  ["#F1DDB6", "#A8C686", "#254C38"],
  ["#C9DBB2", "#F7F5EC", "#254C38"],
  ["#F7F5EC", "#E5EEDC", "#254C38"],
];

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function icon(key: IconKey, k: string, f: string) {
  const S = `stroke="${k}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`;
  const dots = (pts: [number, number][]) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${k}"/>`).join("");
  switch (key) {
    case "key": return `<g ${S}><circle cx="-22" cy="0" r="18" fill="${f}"/><circle cx="-22" cy="0" r="6" fill="none"/><path d="M-4 0 H40 M28 0 v12 M38 0 v9" fill="none"/></g>`;
    case "slide": return `<g ${S} fill="none"><path d="M20 -38 V38 M36 -38 V38 M20 -20 H36 M20 0 H36"/><path d="M20 -38 C -10 -38 -30 -10 -40 30" stroke-width="9" stroke="${f}"/><path d="M20 -38 C -10 -38 -30 -10 -40 30"/><path d="M-48 40 q7 -6 14 0 t14 0 t14 0 t14 0 t14 0 t14 0"/></g>`;
    case "cup": return `<g ${S}><path d="M-30 -10 H22 V12 a24 24 0 0 1 -24 24 h-4 a24 24 0 0 1 -24 -24 Z" fill="${f}"/><path d="M22 -2 h6 a10 10 0 0 1 0 20 h-8 M-14 -22 q-6 -8 0 -16 M0 -22 q-6 -8 0 -16" fill="none"/></g>`;
    case "dice": return `<g ${S}><rect x="-38" y="-20" width="36" height="36" rx="8" fill="${f}" transform="rotate(-12 -20 -2)"/><rect x="4" y="-14" width="36" height="36" rx="8" fill="none" transform="rotate(10 22 4)"/></g>${dots([[-28, -8], [-12, 4], [14, -4], [22, 4], [30, 12]])}`;
    case "joy": return `<g ${S}><rect x="-36" y="10" width="72" height="24" rx="8" fill="${f}"/><path d="M0 10 V-18"/><circle cx="0" cy="-26" r="11" fill="${k}"/></g>${dots([[22, 22]])}`;
    case "pin": return `<g ${S}><path d="M-12 38 C -22 20 -14 5 -8 -6 C -12 -18 -10 -36 0 -36 C 10 -36 12 -18 8 -6 C 14 5 22 20 12 38 Z" fill="${f}"/><path d="M-9 -12 H9"/><circle cx="30" cy="24" r="13" fill="${k}"/></g>`;
    case "holds": return `<g ${S}><rect x="-40" y="-38" width="80" height="76" rx="10" fill="${f}"/><path d="M-28 -38 V38" stroke-dasharray="2 8"/></g><g fill="${k}"><ellipse cx="-12" cy="-20" rx="8" ry="6"/><circle cx="14" cy="-24" r="5"/><ellipse cx="20" cy="2" rx="9" ry="7"/><circle cx="-6" cy="12" r="6"/><ellipse cx="12" cy="26" rx="8" ry="6"/></g>`;
    case "tramp": return `<g ${S}><ellipse cx="0" cy="22" rx="42" ry="10" fill="${f}"/><path d="M-36 26 l-6 14 M36 26 l6 14 M0 32 v8"/><path d="M-20 0 q20 -16 40 0" fill="none" stroke-dasharray="3 9"/><circle cx="0" cy="-24" r="10" fill="${k}"/></g>`;
    case "flag": return `<g ${S}><ellipse cx="4" cy="34" rx="30" ry="7" fill="${f}"/><path d="M4 34 V-38"/><path d="M4 -38 L36 -26 L4 -14 Z" fill="${f}"/></g>${dots([[-22, 28]])}`;
    case "film": return `<g ${S}><rect x="-42" y="-26" width="84" height="52" rx="6" fill="${f}"/><path d="M-34 -17 H34 M-34 17 H34" stroke-dasharray="4 7" stroke-width="4"/><path d="M-8 -9 L12 0 L-8 9 Z" fill="${k}"/></g>`;
    case "awning": return `<g ${S}><path d="M-42 -14 L-34 -36 H34 L42 -14 Z" fill="${f}"/><path d="M-42 -14 q7 10 14 0 q7 10 14 0 q7 10 14 0 q7 10 14 0 q7 10 14 0 q7 10 14 0 M-36 -6 V36 M36 -6 V36 M-44 36 H44 M-20 18 h40" fill="none"/></g>`;
    case "hanger": return `<g ${S} fill="none"><path d="M0 -14 V-20 a8 8 0 1 1 8 -8"/><path d="M0 -14 L-42 12 H42 Z" fill="${f}"/><rect x="-28" y="18" width="56" height="22" rx="5"/></g>`;
    case "jar": return `<g ${S}><path d="M-28 34 V-2 a28 28 0 0 1 56 0 V34" fill="${f}"/><path d="M-36 36 H36"/><path d="M-10 28 l4 -24 h12 l4 24 Z" fill="${k}"/><circle cx="0" cy="-34" r="4" fill="${k}"/></g>`;
    case "brush": return `<g ${S}><path d="M-30 -10 C -40 -40 10 -44 30 -24 C 44 -10 30 12 14 6 C 4 2 4 22 -8 22 C -24 22 -24 4 -30 -10 Z" fill="${f}"/><path d="M-4 40 L30 6" stroke-width="7"/></g>${dots([[-14, -18], [4, -26], [20, -16]])}`;
    case "feet": return `<g fill="${k}"><ellipse cx="-16" cy="16" rx="8" ry="13" transform="rotate(-12 -16 16)"/><circle cx="-24" cy="-2" r="3"/><circle cx="-17" cy="-4" r="3"/><circle cx="-10" cy="-2" r="3"/><ellipse cx="16" cy="-12" rx="8" ry="13" transform="rotate(10 16 -12)"/><circle cx="10" cy="-30" r="3"/><circle cx="17" cy="-32" r="3"/><circle cx="24" cy="-29" r="3"/></g><path d="M-44 36 q22 -10 44 0 t44 0" stroke="${f}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    case "tree": return `<g ${S}><circle cx="0" cy="-14" r="26" fill="${f}"/><circle cx="-16" cy="-4" r="15" fill="${f}"/><circle cx="16" cy="-6" r="14" fill="${f}"/><path d="M0 38 V2 M0 16 L-12 6 M0 10 L12 0" fill="none"/></g>`;
    case "waves": return `<g ${S}><circle cx="22" cy="-22" r="14" fill="${f}"/><path d="M-44 0 q11 -10 22 0 t22 0 t22 0 t22 0 M-44 16 q11 -10 22 0 t22 0 t22 0 t22 0 M-44 32 q11 -10 22 0 t22 0 t22 0 t22 0" fill="none"/></g>`;
    case "gym": return `<g ${S}><rect x="-44" y="-16" width="12" height="32" rx="4" fill="${f}"/><rect x="32" y="-16" width="12" height="32" rx="4" fill="${f}"/><rect x="-30" y="-10" width="8" height="20" rx="3" fill="${f}"/><rect x="22" y="-10" width="8" height="20" rx="3" fill="${f}"/><path d="M-22 0 H22"/></g>`;
    case "vase": return `<g ${S}><path d="M-12 -36 H12 V-28 C 12 -20 32 -10 32 10 C 32 30 16 38 0 38 C -16 38 -32 30 -32 10 C -32 -10 -12 -20 -12 -28 Z" fill="${f}"/><path d="M-26 8 q13 8 26 0 t26 0" fill="none"/></g>`;
    case "bowl": return `<g ${S}><path d="M-40 0 H40 A40 34 0 0 1 -40 0 Z" fill="${f}"/><path d="M6 -8 L40 -40 M16 -6 L46 -32 M-14 -10 q-6 -8 0 -16" fill="none"/></g>`;
    case "mic": return `<g ${S}><rect x="-12" y="-38" width="24" height="40" rx="12" fill="${f}"/><path d="M-22 -6 a22 22 0 0 0 44 0 M0 16 V36 M-14 36 H14" fill="none"/></g>`;
  }
}

export function artSvg(category: CategoryId, seed: string) {
  const r = rng(hash(seed));
  const [bg, sh, ink] = PALETTES[Math.floor(r() * PALETTES.length)];
  const fill = bg === "#A8C686" ? "#F7F5EC" : "#A8C686";
  let decor = `<circle cx="${130 + r() * 40}" cy="${40 + r() * 60}" r="${50 + r() * 20}" fill="${sh}" opacity=".55"/>`;
  for (let i = 0; i < 5; i++) {
    const x = r() * 200, y = r() * 150, s = 6 + r() * 24;
    decor += r() > 0.5
      ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(s / 2).toFixed(1)}" fill="${sh}" opacity=".7"/>`
      : `<path d="M${x.toFixed(1)} ${y.toFixed(1)} q 8 -10 16 0 t 16 0" stroke="${sh}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  }
  const t = `translate(100 78) scale(${(0.95 + r() * 0.2).toFixed(2)}) rotate(${((r() - 0.5) * 14).toFixed(1)})`;
  return `<svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true"><rect width="200" height="150" fill="${bg}"/>${decor}<g transform="${t}">${icon(CAT[category].icon, ink, fill)}</g></svg>`;
}

export const ActivityArt = memo(function ActivityArt({
  activity,
  variant = 0,
  className,
}: {
  activity: Pick<Activity, "id" | "category" | "photos" | "name">;
  variant?: number;
  className?: string;
}) {
  const photo = activity.photos?.[variant];
  if (photo)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={`Photo of ${activity.name}`} className={cn("h-full w-full object-cover", className)} loading="lazy" />;
  return (
    <span
      className={cn("block h-full w-full [&>svg]:block", className)}
      role="img"
      aria-label={`${CAT[activity.category].short} illustration`}
      dangerouslySetInnerHTML={{ __html: artSvg(activity.category, `${activity.id}:${variant}`) }}
    />
  );
});
