import type { CategoryId, Tag } from "./types";

export type IconKey =
  | "key" | "slide" | "cup" | "dice" | "joy" | "pin" | "holds" | "tramp" | "flag" | "film"
  | "awning" | "hanger" | "jar" | "brush" | "feet" | "tree" | "waves" | "gym" | "vase" | "bowl" | "mic";

export interface Category {
  id: CategoryId;
  label: string;
  short: string;
  icon: IconKey;
  /** Indoor by default, used for weather-smart ranking when the source doesn't say */
  indoorDefault: boolean | null;
}

export const CATEGORIES: Category[] = [
  { id: "escape", label: "Escape rooms", short: "Escape room", icon: "key", indoorDefault: true },
  { id: "water", label: "Water parks", short: "Water park", icon: "slide", indoorDefault: null },
  { id: "indiecafe", label: "Independent cafés", short: "Indie café", icon: "cup", indoorDefault: true },
  { id: "chaincafe", label: "Chain cafés", short: "Chain café", icon: "cup", indoorDefault: true },
  { id: "boardgame", label: "Board-game cafés", short: "Games café", icon: "dice", indoorDefault: true },
  { id: "arcade", label: "Arcades", short: "Arcade", icon: "joy", indoorDefault: true },
  { id: "bowling", label: "Bowling", short: "Bowling", icon: "pin", indoorDefault: true },
  { id: "climbing", label: "Indoor climbing", short: "Climbing", icon: "holds", indoorDefault: true },
  { id: "trampoline", label: "Trampoline parks", short: "Trampolines", icon: "tramp", indoorDefault: true },
  { id: "golf", label: "Crazy golf", short: "Crazy golf", icon: "flag", indoorDefault: null },
  { id: "cinema", label: "Independent cinemas", short: "Cinema", icon: "film", indoorDefault: true },
  { id: "market", label: "Markets", short: "Market", icon: "awning", indoorDefault: false },
  { id: "vintage", label: "Vintage shops", short: "Vintage", icon: "hanger", indoorDefault: true },
  { id: "museum", label: "Unusual museums", short: "Museum", icon: "jar", indoorDefault: true },
  { id: "art", label: "Art experiences", short: "Art", icon: "brush", indoorDefault: true },
  { id: "walk", label: "Free walks", short: "Walk", icon: "feet", indoorDefault: false },
  { id: "park", label: "Parks & gardens", short: "Park", icon: "tree", indoorDefault: false },
  { id: "swim", label: "Swimming", short: "Swimming", icon: "waves", indoorDefault: null },
  { id: "leisure", label: "Leisure centres", short: "Leisure centre", icon: "gym", indoorDefault: true },
  { id: "workshop", label: "Workshops", short: "Workshop", icon: "vase", indoorDefault: true },
  { id: "food", label: "Food experiences", short: "Food", icon: "bowl", indoorDefault: true },
  { id: "live", label: "Live entertainment", short: "Live", icon: "mic", indoorDefault: true },
];

export const CAT: Record<CategoryId, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, Category>;

export const COLLECTIONS: { id: Tag; label: string; blurb: string }[] = [
  { id: "gem", label: "Hidden gems", blurb: "Small, independent and easy to walk past" },
  { id: "rainy", label: "Rainy-day", blurb: "Indoors, warm and dry" },
  { id: "date", label: "Date ideas", blurb: "Better than another dinner" },
  { id: "family", label: "Family", blurb: "Good with kids" },
  { id: "solo", label: "Solo", blurb: "Great on your own" },
  { id: "friends", label: "With friends", blurb: "Best in a group" },
  { id: "weird", label: "Something weird", blurb: "Odd, quirky, unexpected" },
];

export const TAG_LABEL: Record<Tag, string> = Object.fromEntries(
  COLLECTIONS.map((c) => [c.id, c.label]),
) as Record<Tag, string>;
