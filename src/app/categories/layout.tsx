import type { Metadata } from "next";

export const metadata: Metadata = { title: "Categories", description: "Browse things to do by type, from escape rooms and arcades to independent cafés, markets and parks." };

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
