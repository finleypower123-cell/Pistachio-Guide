const { chromium, devices } = require("playwright");
const B = "http://localhost:3000";
(async () => {
  const out = [];
  const b = await chromium.launch();
  const { defaultBrowserType, ...phone } = devices["Pixel 7"];
  const page = await (await b.newContext(phone)).newPage();
  page.on("pageerror", (e) => out.push("PAGEERROR: " + String(e).slice(0, 300)));
  let photon = 0;
  page.on("response", (r) => { if (r.url().includes("photon.komoot.io")) photon++; });
  const body = () => page.evaluate(() => document.body.innerText);
  const count = async () => Number(((await body()).match(/(\d+) places?/) || [0, -1])[1]);
  const waitDone = async (label, max = 40) => {
    const t0 = Date.now(); let first = null;
    for (let i = 0; i < max * 2; i++) {
      await page.waitForTimeout(500);
      const t = await body();
      if (first === null && (await page.locator('a[href*="/activity/osm-"]').count()) > 0) first = Date.now() - t0;
      if (!/Finding (more )?places/.test(t) && (first !== null || /Couldn't load|No places found/.test(t))) break;
    }
    out.push(`${label}: first place after ${first}ms, done after ${Date.now() - t0}ms, ${await count()} places, photon requests so far ${photon}`);
  };
  try {
    await page.goto(B + "/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    out.push("first visit dialog shown: " + (await page.getByText("Where are you exploring?").isVisible()));
    await page.getByRole("button", { name: "Brussels" }).click();
    await page.waitForTimeout(14000);
    out.push("HOME h2: " + (await page.evaluate(() => [...document.querySelectorAll("h2")].map((h) => h.innerText).join(" | "))));
    out.push("HOME rail firsts: " + (await page.evaluate(() => [...document.querySelectorAll(".rail")].map((r) => r.querySelector("h3")?.innerText).join(" | "))));
    out.push("HOME moods: " + (await page.evaluate(() => [...document.querySelectorAll('a[href*="mood="]')].map((a) => a.innerText.split("\n")[0]).join(", "))));
    out.push("HOME mentions demo: " + /demo/i.test(await body()));

    await page.evaluate(() => localStorage.removeItem("pg:places-cache:v1"));
    await page.goto(B + "/explore", { waitUntil: "domcontentloaded" });
    await waitDone("EXPLORE 5 km (fresh)");
    out.push("EXPLORE cards: " + (await page.evaluate(() => [...document.querySelectorAll("article")].slice(0, 6).map((a) => a.innerText.replace(/\n+/g, " / ")).join(" || "))));
    out.push("EXPLORE mentions demo/OpenStreetMap badge: " + /demo/i.test(await body()) + " / " + /OPENSTREETMAP/.test(await body()));
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitDone("EXPLORE 5 km (cached reload)");

    await page.selectOption("#range", "25");
    await waitDone("EXPLORE 25 km");
    await page.selectOption("#sort", "nearest");
    await page.waitForTimeout(500);
    const far = await page.evaluate(() => [...document.querySelectorAll("article")].map((a) => (a.innerText.match(/([\d.]+) km/) || [])[1]).filter(Boolean).map(Number));
    await page.getByRole("button", { name: /Filters/ }).first().click();
    await page.waitForTimeout(600);
    out.push("FILTERS: " + (await page.evaluate(() => [...document.querySelectorAll("legend, label[for^=f-]")].map((l) => l.innerText.split("\n")[0]).filter((v, i, a) => a.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i).join(" | "))));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Museums" }).first().click().catch(() => out.push("no Museums chip"));
    await page.waitForTimeout(600);
    out.push(`MUSEUMS within 25 km: ${await count()}; cards: ` + (await page.evaluate(() => [...document.querySelectorAll("article")].slice(-3).map((a) => a.innerText.replace(/\n+/g, " / ")).join(" || "))));

    await page.getByRole("button", { name: "Map", exact: true }).first().click();
    await page.waitForTimeout(5000);
    out.push("MAP markers: " + (await page.locator(".maplibregl-marker").count()) + ", canvas: " + (await page.locator("canvas.maplibregl-canvas").count()));
    const box = await page.locator("canvas.maplibregl-canvas").boundingBox();
    if (box) {
      for (let k = 0; k < 3; k++) {
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.3);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.3, { steps: 8 });
        await page.mouse.up();
        await page.waitForTimeout(900);
      }
      const btn = page.getByRole("button", { name: "Search this area" });
      out.push("Search this area shown: " + (await btn.isVisible().catch(() => false)));
      if (await btn.isVisible().catch(() => false)) {
        const before = photon;
        await btn.click();
        await page.waitForTimeout(12000);
        out.push(`after Search this area: location label "${await page.evaluate(() => document.querySelector("header button[aria-label*=ocation], header button")?.innerText)}", new photon requests ${photon - before}, markers ${await page.locator(".maplibregl-marker").count()}`);
      }
    }
    const href = await page.evaluate(() => null);
    await page.goto(B + "/explore?cat=museum", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    const link = await page.locator('a[href*="/activity/osm-"]').first().getAttribute("href").catch(() => null);
    if (link) {
      await page.goto(B + link, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(7000);
      out.push("DETAIL " + link + ": " + (await page.evaluate(() => (document.querySelector("main")?.innerText ?? "").slice(0, 700).replace(/\n+/g, " | "))));
    }
  } catch (e) { out.push("SCRIPT ERROR " + String(e).slice(0, 500)); }
  console.log(out.join("\n"));
  await b.close();
})();
