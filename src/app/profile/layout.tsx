import type { Metadata } from "next";

export const metadata: Metadata = { title: "You", description: "Your preferences for recommendations and Surprise Me." };

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
