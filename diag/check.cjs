const { chromium, devices } = require("playwright");
const BASE = process.env.BASE;
(async () => {
  const out = [];
  const b = await chromium.launch();
  const { defaultBrowserType, ...phone } = devices["Pixel 7"];
  const ctx = await b.newContext(phone);
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && out.push("console.error: " + m.text().slice(0, 300)));
  page.on("pageerror", (e) => out.push("pageerror: " + String(e).slice(0, 300)));
  page.on("requestfailed", (r) => /api\/|overpass/.test(r.url()) && out.push(`FAILED ${r.method()} ${r.url().slice(0, 110)} ${r.failure()?.errorText}`));
  page.on("response", async (r) => {
    const u = r.url();
    if (!/\/api\/|overpass/.test(u)) return;
    let body = "";
    try { body = (await r.text()).slice(0, 220).replace(/\s+/g, " "); } catch {}
    out.push(`${r.status()} ${r.request().method()} ${u.slice(0, 110)} :: ${body}`);
  });
  const t0 = Date.now();
  await page.goto(BASE + "/explore", { waitUntil: "domcontentloaded" });
  let line = "";
  for (let i = 0; i < 100; i++) {
    await page.waitForTimeout(1000);
    const text = await page.evaluate(() => document.body.innerText);
    const m = text.match(/[^\n]*(real places from OpenStreetMap|Retry|Preview: demo)[^\n]*/);
    if (m) { line = m[0]; break; }
  }
  out.push(`STATUS LINE after ${Math.round((Date.now() - t0) / 1000)}s: ${line || "(still loading / none)"}`);
  const text = await page.evaluate(() => document.body.innerText);
  out.push("PAGE TEXT: " + text.slice(0, 900).replace(/\n+/g, " | "));
  const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src).filter(Boolean).length);
  out.push("scripts loaded: " + scripts);
  console.log(out.join("\n"));
  await b.close();
})().catch((e) => { console.log("SCRIPT ERROR " + e); });
