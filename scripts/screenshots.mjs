// Captures README screenshots into docs/screenshots.
// Usage: npm run build && npm start   (in another shell)
//        node scripts/screenshots.mjs [baseUrl] [hostVideo.y4m] [guestVideo.y4m]
// The optional .y4m files replace Chromium's default fake-camera pattern.
// Requires Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const [hostVideo, guestVideo] = process.argv.slice(3);
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const launch = (video) =>
  chromium.launch({
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      ...(video ? [`--use-file-for-fake-video-capture=${video}`] : []),
    ],
  });

const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const mobile = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

async function newPage(browser, opts) {
  const ctx = await browser.newContext({ ...opts, permissions: ["camera", "microphone"] });
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  return page;
}

const settle = (page, ms = 1200) => page.waitForTimeout(ms);

const hostBrowser = await launch(hostVideo);
const guestBrowser = await launch(guestVideo);

// 1. Landing — desktop hero, full page, mobile
{
  const page = await newPage(hostBrowser, desktop);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await settle(page);
  await page.screenshot({ path: `${OUT}/landing.png` });

  const m = await newPage(hostBrowser, mobile);
  await m.goto(BASE, { waitUntil: "networkidle" });
  await settle(m);
  await m.screenshot({ path: `${OUT}/landing-mobile.png` });
}

// 2. Two peers complete the copy/paste handshake
const room = "aurora42";
const host = await newPage(hostBrowser, desktop);
const guest = await newPage(guestBrowser, desktop);
await host.goto(`${BASE}/room/${room}?host=1`, { waitUntil: "networkidle" });
await guest.goto(`${BASE}/room/${room}`, { waitUntil: "networkidle" });
await settle(host, 2000);
await host.screenshot({ path: `${OUT}/room-waiting.png` });

await host.getByRole("button", { name: "Generate invite code" }).click();
const offerBox = host.locator("textarea[readonly]");
await offerBox.waitFor();
await host.waitForFunction(() => document.querySelector("textarea[readonly]")?.value?.length > 0);
await settle(host, 500);
await host.screenshot({ path: `${OUT}/room-invite.png` });
const offer = await offerBox.inputValue();

await guest.locator("textarea").fill(offer);
await guest.getByRole("button", { name: "Generate reply" }).click();
const answerBox = guest.locator("textarea[readonly]");
await answerBox.waitFor();
await guest.waitForFunction(() => document.querySelector("textarea[readonly]")?.value?.length > 0);
await settle(guest, 500);
await guest.screenshot({ path: `${OUT}/room-reply.png` });
const answer = await answerBox.inputValue();

await host.locator("textarea:not([readonly])").fill(answer);
await host.getByRole("button", { name: "Connect" }).click();
await host.getByText("Connected", { exact: true }).waitFor({ timeout: 20000 });
await guest.getByText("Connected", { exact: true }).waitFor({ timeout: 20000 });
await settle(host, 2500);
await host.screenshot({ path: `${OUT}/call-connected.png` });

// 3. Chat over the data channel
await host.getByRole("button", { name: "Chat" }).click();
await guest.getByRole("button", { name: "Chat" }).click();
const say = async (page, text) => {
  await page.getByPlaceholder("Message…").locator("visible=true").fill(text);
  await page.keyboard.press("Enter");
  await settle(page, 300);
};
await say(guest, "Hey! Can you hear me ok?");
await say(host, "Loud and clear 👋");
await say(guest, "Sending the deck link here: halcyon.app/notes");
await say(host, "Got it, thanks!");
await settle(host, 800);
await host.screenshot({ path: `${OUT}/call-chat.png` });

// 4. Mobile call view (guest on a phone)
await hostBrowser.close();
await guestBrowser.close();

// Separate run for a mobile connected view
{
  const hb = await launch(hostVideo);
  const gb = await launch(guestVideo);
  const h = await newPage(hb, desktop);
  const g = await newPage(gb, mobile);
  await h.goto(`${BASE}/room/${room}?host=1`, { waitUntil: "networkidle" });
  await g.goto(`${BASE}/room/${room}`, { waitUntil: "networkidle" });
  await settle(g, 1500);
  await g.screenshot({ path: `${OUT}/room-mobile-join.png` });
  await h.getByRole("button", { name: "Generate invite code" }).click();
  await h.waitForFunction(() => document.querySelector("textarea[readonly]")?.value?.length > 0);
  await g.locator("textarea").fill(await h.locator("textarea[readonly]").inputValue());
  await g.getByRole("button", { name: "Generate reply" }).click();
  await g.waitForFunction(() => document.querySelector("textarea[readonly]")?.value?.length > 0);
  await h.locator("textarea:not([readonly])").fill(await g.locator("textarea[readonly]").inputValue());
  await h.getByRole("button", { name: "Connect" }).click();
  await g.waitForFunction(() => !document.querySelector("textarea"), null, { timeout: 20000 });
  await settle(g, 2500);
  await g.screenshot({ path: `${OUT}/call-mobile.png` });
  await hb.close();
  await gb.close();
}

console.log(`Screenshots written to ${OUT}/`);
