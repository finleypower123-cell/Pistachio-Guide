// Copies MapLibre's web worker into /public so the map never depends on a third-party CDN.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
const src = "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs";
if (existsSync(src)) {
  mkdirSync("public", { recursive: true });
  copyFileSync(src, "public/maplibre-gl-worker.mjs");
}
