// Builds dist-preview/index.html: the real app's pages in one self-contained file (demo data only).
// Usage: node scripts/build-preview.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const out = "dist-preview";
mkdirSync(out, { recursive: true });

execFileSync("npx", ["@tailwindcss/cli", "-i", "src/app/globals.css", "-o", `${out}/tw.css`, "--minify"], { stdio: "inherit" });

await build({
  entryPoints: ["preview/main.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  outfile: `${out}/app.js`,
  jsx: "automatic",
  alias: {
    "next/link": "./preview/shims/next-link.tsx",
    "next/navigation": "./preview/shims/next-navigation.ts",
    "@supabase/ssr": "./preview/shims/supabase-ssr.ts",
  },
  loader: { ".woff2": "dataurl", ".woff": "dataurl" },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": '""',
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": '""',
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": '""',
    "process.env.NEXT_PUBLIC_AFFILIATE_ID": '"pistachio-preview"',
  },
  logLevel: "warning",
});

const tw = readFileSync(`${out}/tw.css`, "utf8");
const appCss = readFileSync(`${out}/app.css`, "utf8");
const js = readFileSync(`${out}/app.js`, "utf8").replace(/<\/script/gi, "<\\/script");
const worker = readFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "utf8");
const workerJs = JSON.stringify(worker).replace(/<\//g, "<\\/");

const html = `<title>Pistachio Guide</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Find hidden gems, weird little adventures and brilliant things to do near you.">
<style>${appCss}\n${tw}</style>
<div id="root"></div>
<script>
window.__PISTACHIO_PREVIEW__ = true;
try { window.__MAPLIBRE_WORKER_URL = URL.createObjectURL(new Blob([${workerJs}], { type: "text/javascript" })); } catch (e) {}
</script>
<script>${js}</script>
`;
writeFileSync(`${out}/index.html`, html);
console.log(`dist-preview/index.html ${(html.length / 1024 / 1024).toFixed(2)} MB`);
