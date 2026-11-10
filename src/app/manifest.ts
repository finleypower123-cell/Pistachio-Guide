import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pistachio Guide",
    short_name: "Pistachio",
    description: "Find the fun stuff near you.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F5EC",
    theme_color: "#254C38",
    // PNG sizes are what phones use for the home-screen icon; the maskable one fills the system's icon shape.
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
