import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/nunito";
import { createRoot } from "react-dom/client";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { LocationDialog } from "@/components/dialogs/location-dialog";
import { SearchDialog } from "@/components/dialogs/search-dialog";
import { SurpriseDialog } from "@/components/dialogs/surprise-dialog";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AppProvider } from "@/components/providers/app-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { ToastProvider } from "@/components/ui/toast";
import Home from "@/app/page";
import ActivityPage from "@/app/activity/[id]/page";
import AboutPage from "@/app/about/page";
import BusinessPage from "@/app/business/page";
import CategoriesPage from "@/app/categories/page";
import LoginPage from "@/app/login/page";
import ProfilePage from "@/app/profile/page";
import SavedPage from "@/app/saved/page";
import { ExploreView } from "@/components/explore/explore-view";

function Page() {
  const path = usePathname();
  if (path.startsWith("/activity/")) return <ActivityPage key={path} />;
  switch (path) {
    case "/explore": return <ExploreView key="explore" />;
    case "/map": return <ExploreView key="map" initialView="map" />;
    case "/categories": return <CategoriesPage />;
    case "/saved": return <SavedPage />;
    case "/profile": return <ProfilePage />;
    case "/login": return <LoginPage />;
    case "/business": return <BusinessPage />;
    case "/about": return <AboutPage />;
    default: return <Home />;
  }
}

function App() {
  return (
    <ToastProvider>
      <UserProvider>
        <AppProvider>
          <SiteHeader />
          <main id="main">
            <div className="gutter mx-auto mt-3 max-w-7xl">
              <p className="rounded-2xl bg-demo-bg px-4 py-2.5 text-[13px] font-semibold text-demo-ink">
                Preview with demo listings. Live OpenStreetMap places, street maps and location search turn on in the deployed app.
              </p>
            </div>
            <Suspense>
              <Page />
            </Suspense>
          </main>
          <SiteFooter />
          <BottomNav />
          <LocationDialog />
          <SearchDialog />
          <SurpriseDialog />
        </AppProvider>
      </UserProvider>
    </ToastProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
