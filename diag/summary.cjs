const fs = require("fs");
for (const c of ["brussels", "london"]) {
  const f = `public/data/cities/${c}.json`;
  const d = JSON.parse(fs.readFileSync(f, "utf8"));
  console.log(`\n== ${c}: ${d.places.length} places, size ${fs.statSync(f).size}, blurs ${d.places.filter((p) => p.photoBlur).length}, avg blur bytes ${Math.round(d.places.filter((p) => p.photoBlur).reduce((s, p) => s + p.photoBlur.length, 0) / Math.max(1, d.places.filter((p) => p.photoBlur).length))}`);
  const w = d.places.filter((p) => p.description?.source === "website");
  const k = d.places.filter((p) => p.description?.source === "wikipedia");
  console.log("Wikipedia:", k.length, "Website:", w.length);
  for (const p of k.slice(0, 6)) console.log(`  W ${p.name}: ${p.summary}`);
  for (const p of w.slice(0, 25)) console.log(`  S ${p.name} [${p.description.lang}]: ${p.summary}`);
}
