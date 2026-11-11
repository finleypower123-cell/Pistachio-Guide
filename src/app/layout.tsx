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
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  appleWebApp: { capable: true, title: "Pistachio", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  // What a shared link looks like in a chat or on social media. The picture is src/app/opengraph-image.tsx.
  openGraph: { type: "website", siteName: SITE_NAME, title: `${SITE_NAME} — ${SITE_TAGLINE}`, description: SITE_DESCRIPTION, locale: "en_GB", url: "/" },
  twitter: { card: "summary_large_image", title: `${SITE_NAME} — ${SITE_TAGLINE}`, description: SITE_DESCRIPTION },
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
              {/* At least a screen tall, so the footer never shows first and then jumps down as content loads. */}
              <main id="main" className="min-h-[100svh]">{children}</main>
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
