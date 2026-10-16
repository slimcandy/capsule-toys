// Makes the link-preview card (Open Graph, 1200×630) from the machine on the
// page itself. The app icons are cut from the same picture by scripts/art.py.
// Run after `npm run build`, with Playwright installed:
//   npx vite preview --port 4173 & node scripts/share-card.mjs
// sRGB JPEG: link previews often drop colour profiles.
import { webkit } from "playwright";

const url = process.argv[2] ?? "http://localhost:4173/";
const browser = await webkit.launch();

// 1. The machine, cut from the scene.
const page = await browser.newPage({ viewport: { width: 600, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const box = await page.locator("#scene").boundingBox();
const machine = await page.screenshot({
  clip: { x: box.x + box.width * 0.17, y: box.y + box.height * 0.27, width: box.width * 0.66, height: box.height * 0.54 },
  animations: "disabled",
});

// 2. The card: the machine on the left, the pitch on the right, in the arcade.
const card = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const html = await (await page.request.get(new URL("/", url).href)).text();
const stylesheet = html.match(/href="(\/assets\/[^"]+\.css)"/)?.[1];
await card.goto(url);
await card.setContent(`<!doctype html>
  <link rel="stylesheet" href="${new URL(stylesheet, url).href}">
  <body class="share">
    <div class="room"></div>
    <img class="share-machine" src="data:image/png;base64,${machine.toString("base64")}">
    <div class="share-text">
      <p class="share-sign">Capsule Toys</p>
      <h1>Turn the knob.<br>See it in AR.</h1>
      <p>A capsule toy machine for your iPhone: a random 3D model on your face or in your room.</p>
      <p class="share-url">ar.avolkov.dev</p>
    </div>
  </body>`, { waitUntil: "networkidle" });
await card.addStyleTag({
  content: `body.share { position: relative; margin: 0; width: 1200px; height: 630px; display: flex; align-items: center; gap: 48px; padding: 0 80px 0 60px; box-sizing: border-box; overflow: hidden }
    body.share .room { position: absolute; inset: -60px; z-index: 0; filter: blur(22px) brightness(0.6) }
    .share-machine { position: relative; z-index: 1; height: 630px; margin-left: -60px; mask: linear-gradient(90deg, transparent, black 12%, black 88%, transparent) }
    .share-text { position: relative; z-index: 1; color: var(--color-cream); text-shadow: 0 2px 4px oklch(0 0 0 / 0.6) }
    .share-sign { display: inline-block; margin: 0; padding: 10px 26px 8px; border-radius: 10px; font-family: var(--font-sign); font-weight: 700; letter-spacing: .14em; text-transform: uppercase; font-size: 26px; color: var(--color-cream) !important; background: linear-gradient(var(--color-enamel-dark), var(--color-burgundy-deep)); box-shadow: 0 0 0 3px var(--color-brass), 0 0 0 4px var(--color-brass-dark), 0 8px 18px oklch(0 0 0 / 0.6); text-shadow: 0 1px 0 oklch(0.7 0.1 80), 0 2px 0 oklch(0.5 0.1 70), 0 4px 6px oklch(0 0 0 / 0.6) }
    .share-text h1 { margin: 26px 0 0; font-family: var(--font-serif); font-size: 66px; line-height: 1.05; font-weight: 700 }
    .share-text p { font-family: var(--font-serif); font-size: 27px; line-height: 1.4; color: var(--color-cream) }
    .share-url { margin-top: 26px; font-weight: 700; color: var(--color-amber) !important }`,
});
await card.waitForTimeout(300);
await card.screenshot({ path: "site/public/share/card-1200x630.jpg", type: "jpeg", quality: 88 });

await browser.close();
console.log("share card written");
