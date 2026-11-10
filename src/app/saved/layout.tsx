import type { Metadata } from "next";

export const metadata: Metadata = { title: "Saved", description: "Places you've saved for later." };

export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
