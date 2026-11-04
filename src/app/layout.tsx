import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/nunito";
import "./globals.css";
import { LocationDialog } from "@/components/dialogs/location-dialog";
import { SearchDialog } from "@/components/dialogs/search-dialog";
import { SurpriseDialog } from "@/components/dialogs/surprise-dialog";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AppProvider } from "@/components/providers/app-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: { default: "Pistachio Guide — Find the fun stuff", template: "%s · Pistachio Guide" },
  description: "Find hidden gems, weird little adventures and brilliant things to do near you.",
  applicationName: "Pistachio Guide",
  appleWebApp: { capable: true, title: "Pistachio", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F5EC" },
    { media: "(prefers-color-scheme: dark)", color: "#121A15" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-dvh antialiased">
        <ToastProvider>
          <UserProvider>
            <AppProvider>
              <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary">
                Skip to content
              </a>
              <SiteHeader />
              <main id="main">{children}</main>
              <SiteFooter />
              <BottomNav />
              <LocationDialog />
              <SearchDialog />
              <SurpriseDialog />
            </AppProvider>
          </UserProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
