import { memo } from "react";
import { CAT, type IconKey } from "@/lib/categories";
import type { Activity, CategoryId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Photo } from "./photo";

/**
 * The picture shown when a place has no real photo, and behind a photo while it loads.
 *
 * Deliberately plain: one flat brand colour per family of places and a single small line icon,
 * like a category marker on a map. No scattered shapes or random tilts, which read as clip art.
 * Families keep a consistent colour, so a list of mixed places still looks ordered.
 */

type Tone = [bg: string, ink: string, fill: string];
const TONES: Record<"play" | "culture" | "outdoors" | "food", Tone> = {
  play: ["#A8C686", "#254C38", "#F7F5EC"],
  culture: ["#254C38", "#F7F5EC", "#3E6A50"],
  outdoors: ["#E5EEDC", "#254C38", "#A8C686"],
  food: ["#F1DDB6", "#254C38", "#F7F5EC"],
};
const FAMILY: Partial<Record<CategoryId, keyof typeof TONES>> = {
  escape: "play", arcade: "play", boardgame: "play", bowling: "play", golf: "play", climbing: "play", trampoline: "play",
  themepark: "play", icerink: "play", karaoke: "play", softplay: "play", leisure: "play",
  museum: "culture", art: "culture", cinema: "culture", live: "culture", historic: "culture", workshop: "culture",
  park: "outdoors", walk: "outdoors", swim: "outdoors", water: "outdoors", zoo: "outdoors", boats: "outdoors",
  indiecafe: "food", chaincafe: "food", food: "food", brewery: "food", market: "food", vintage: "food",
};


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
    case "paw": return `<g fill="${k}"><ellipse cx="0" cy="16" rx="20" ry="16" fill="${f}" stroke="${k}" stroke-width="5"/><ellipse cx="-24" cy="-8" rx="8" ry="11"/><ellipse cx="-8" cy="-24" rx="8" ry="11"/><ellipse cx="10" cy="-24" rx="8" ry="11"/><ellipse cx="26" cy="-8" rx="8" ry="11"/></g>`;
    case "coaster": return `<g ${S} fill="none"><path d="M-44 30 C -30 -40 -6 -40 2 4 C 8 34 30 34 44 -10" stroke="${f}" stroke-width="10"/><path d="M-44 30 C -30 -40 -6 -40 2 4 C 8 34 30 34 44 -10"/><path d="M-44 38 H44 M-26 -8 V38 M2 4 V38 M30 14 V38"/></g><rect x="-34" y="-34" width="18" height="12" rx="4" fill="${k}" transform="rotate(-38 -25 -28)"/>`;
    case "skate": return `<g ${S}><path d="M-22 -36 H2 V-8 C 20 -8 34 0 34 16 H-22 Z" fill="${f}"/><path d="M-10 16 V28 M22 16 V28 M-34 30 H30 q12 0 12 -10" fill="none"/><path d="M-12 -22 H2 M-12 -10 H2" fill="none"/></g>`;
    case "blocks": return `<g ${S}><rect x="-40" y="2" width="34" height="34" rx="6" fill="${f}"/><rect x="2" y="2" width="34" height="34" rx="6" fill="none"/><rect x="-20" y="-36" width="34" height="34" rx="6" fill="${f}"/></g>${dots([[-23, 19], [19, 19], [-3, -19]])}`;
    case "boat": return `<g ${S}><path d="M-42 12 H42 L30 34 H-30 Z" fill="${f}"/><path d="M0 12 V-38 M0 -38 L28 2 H0 M0 -28 L-22 2 H0" fill="none"/></g><path d="M-46 42 q11 -8 23 0 t23 0 t23 0 t23 0" stroke="${k}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    case "castle": return `<g ${S}><path d="M-38 38 V-18 h12 v10 h12 v-10 h28 v10 h12 v-10 h12 V38 Z" fill="${f}"/><path d="M-10 38 V16 a10 10 0 0 1 20 0 V38" fill="${k}"/><path d="M-24 4 v8 M24 4 v8" fill="none"/></g>`;
    case "pint": return `<g ${S}><path d="M-22 -30 H22 L16 36 H-16 Z" fill="${f}"/><path d="M-20 -12 H20" fill="none"/><path d="M22 -14 h10 a8 8 0 0 1 8 8 v14 a8 8 0 0 1 -8 8 h-12" fill="none"/></g>${dots([[-6, 4], [6, 18], [-4, 24]])}`;
    case "bowl": return `<g ${S}><path d="M-40 0 H40 A40 34 0 0 1 -40 0 Z" fill="${f}"/><path d="M6 -8 L40 -40 M16 -6 L46 -32 M-14 -10 q-6 -8 0 -16" fill="none"/></g>`;
    case "mic": return `<g ${S}><rect x="-12" y="-38" width="24" height="40" rx="12" fill="${f}"/><path d="M-22 -6 a22 22 0 0 0 44 0 M0 16 V36 M-14 36 H14" fill="none"/></g>`;
  }
}

export function artSvg(category: CategoryId, seed: string) {
  const [bg, ink, fill] = TONES[FAMILY[category] ?? "outdoors"];
  // Gallery slots (seed ends in :1, :2 ...) get the neighbouring tone so the strip isn't uniform.
  const slot = Number(seed.split(":").pop()) || 0;
  const [b2, k2, f2] = slot ? Object.values(TONES)[(Object.keys(TONES).indexOf(FAMILY[category] ?? "outdoors") + slot) % 4] : [bg, ink, fill];
  return `<svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true"><rect width="200" height="150" fill="${b2}"/><g transform="translate(100 75) scale(0.62)">${icon(CAT[category].icon, k2, f2)}</g></svg>`;
}

export const ActivityArt = memo(function ActivityArt({
  activity,
  variant = 0,
  hero = false,
  sizes,
  className,
  priority = false,
}: {
  activity: Pick<Activity, "id" | "category" | "photos" | "name" | "photoBlur">;
  variant?: number;
  /** A large picture (the place page's main photo): allows the bigger image size. */
  hero?: boolean;
  /** How wide the box is on screen, in `sizes` syntax, so the browser picks the smallest photo that fits. */
  sizes?: string;
  /** Load the photo ahead of others: for the first few pictures on a screen. */
  priority?: boolean;
  className?: string;
}) {
  const photo = activity.photos?.[variant];
  const art = (
    <span
      className={cn("block h-full w-full [&>svg]:block", !photo && className)}
      role="img"
      aria-label={`${CAT[activity.category].short} illustration`}
      aria-hidden={photo ? true : undefined}
      dangerouslySetInnerHTML={{ __html: artSvg(activity.category, `${activity.id}:${photo ? 0 : variant}`) }}
    />
  );
  if (!photo) return art;
  // The illustration stays underneath as the placeholder while the photo loads, or if it never does.
  return (
    <span className={cn("relative block h-full w-full overflow-hidden", className)}>
      {art}
      {/* A tiny blurred copy of the photo, inlined in the data, so a picture shows at once */}
      {variant === 0 && activity.photoBlur && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={activity.photoBlur} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl" />
      )}
      <Photo src={photo} alt={`Photo of ${activity.name}`} hero={hero} sizes={sizes} priority={priority} />
    </span>
  );
});
