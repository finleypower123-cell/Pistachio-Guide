import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function priceLabel(price: number | null | undefined) {
  if (price === 0) return "Free";
  if (price == null) return "Price not listed";
  return `£${price}`;
}
