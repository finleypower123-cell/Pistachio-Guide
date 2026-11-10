import type { Metadata } from "next";

// Place details load in the browser, so the tab title is generic until the page sets its own.
export const metadata: Metadata = { title: "Place" };

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
