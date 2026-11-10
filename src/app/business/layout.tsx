import type { Metadata } from "next";

export const metadata: Metadata = { title: "For businesses", description: "Claim your listing for free, keep it accurate, and add offers and events." };

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
