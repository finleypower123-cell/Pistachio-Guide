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
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
