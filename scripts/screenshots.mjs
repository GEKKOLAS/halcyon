// Captures README screenshots into docs/screenshots.
// Usage: npm run build && npm start   (in another shell)
//        node scripts/screenshots.mjs [baseUrl] [hostVideo.y4m] [guestVideo.y4m]
// The optional .y4m files replace Chromium's default fake-camera pattern.
// Requires a Chromium for Playwright: `npx playwright install chromium` (once).
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

// JPEG keeps the repo light; PNG of these gradients is ~10x larger.
const shot = (page, name) =>
  page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 85 });

// In a call the controls auto-hide when the pointer is idle. Keep signalling
// activity, since a capture can take longer than the idle timeout on slow CI.
const wake = async (page) => {
  await page.evaluate(() => {
    clearInterval(window.__keepAwake);
    window.__keepAwake = setInterval(
      () => window.dispatchEvent(new PointerEvent("pointermove")),
      500
    );
  });
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector("header")).opacity === "1",
    null,
    { timeout: 5000 }
  );
  await settle(page, 300);
};

const hostBrowser = await launch(hostVideo);
const guestBrowser = await launch(guestVideo);

// 1. Landing — desktop hero, full page, mobile
{
  const page = await newPage(hostBrowser, desktop);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await settle(page);
  await shot(page, "landing");

  // Sections reveal on scroll, so bring each into view and let it settle.
  for (const [id, file] of [
    ["features", "landing-features"],
    ["how", "landing-how"],
  ]) {
    // Align the section's top with the viewport so the strip above stays out of frame.
    await page.evaluate((el) => {
      const top = document.getElementById(el)?.getBoundingClientRect().top ?? 0;
      window.scrollTo(0, window.scrollY + top);
    }, id);
    await settle(page, 1500);
    await shot(page, file);
  }

  const m = await newPage(hostBrowser, mobile);
  await m.goto(BASE, { waitUntil: "networkidle" });
  await settle(m);
  await shot(m, "landing-mobile");
}

// 2. Host waits with the room link; a guest opens it
// Fresh room names per run, so seats left over from an aborted run never block us.
const suffix = Math.random().toString(36).slice(2, 6);
const room = `calm-${suffix}`;
const host = await newPage(hostBrowser, desktop);
await host.goto(`${BASE}/room/${room}?host=1`, { waitUntil: "load" });
await host.getByText("Waiting for someone to join…").waitFor();
await settle(host, 1500);
await shot(host, "room-waiting");

const guest = await newPage(guestBrowser, desktop);
await guest.goto(`${BASE}/room/${room}`, { waitUntil: "load" });
await host.getByText("Connected", { exact: true }).waitFor({ timeout: 20000 });
await guest.getByText("Connected", { exact: true }).waitFor({ timeout: 20000 });
await settle(host, 2500);
await wake(host);
await shot(host, "call-connected");

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
await shot(host, "call-chat");

// 4. Guest hangs up → host sees the end screen
await guest.getByRole("button", { name: "Leave call" }).click();
await host.getByText("The other person left").waitFor();
await settle(host, 800);
await shot(host, "call-ended");

// 5. Manual fallback (copy/paste codes)
{
  const p = await newPage(hostBrowser, desktop);
  await p.goto(`${BASE}/room/codes-${suffix}?host=1`, { waitUntil: "load" });
  await p.getByRole("button", { name: "Having trouble? Connect manually with codes" }).click();
  await p.getByRole("button", { name: "Generate invite code" }).click();
  await p.waitForFunction(() => document.querySelector("textarea[readonly]")?.value?.length > 0);
  await settle(p, 800);
  await shot(p, "room-manual");
}

await hostBrowser.close();
await guestBrowser.close();

// 6. Mobile: guest on a phone joins by link
{
  const hb = await launch(hostVideo);
  const gb = await launch(guestVideo);
  const g = await newPage(gb, mobile);
  await g.goto(`${BASE}/room/phone-${suffix}`, { waitUntil: "load" });
  await g.getByText("Waiting for someone to join…").waitFor();
  await settle(g, 1500);
  await shot(g, "room-mobile-join");
  const h = await newPage(hb, desktop);
  await h.goto(`${BASE}/room/phone-${suffix}?host=1`, { waitUntil: "load" });
  await g.waitForFunction(() => !document.querySelector("input[aria-label='Room link']"), null, {
    timeout: 20000,
  });
  await settle(g, 2500);
  await wake(g);
  await shot(g, "call-mobile");
  await hb.close();
  await gb.close();
}

console.log(`Screenshots written to ${OUT}/`);
