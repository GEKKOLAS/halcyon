// End-to-end check of a full call between two headless Chromium peers.
// Usage: npm run build && npm start   (in another shell)
//        npm run test:e2e [-- baseUrl]
// Requires Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`).
const { chromium } = require("playwright");
const B = process.argv[2] ?? "http://localhost:3000";
const args = ["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"];
let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const filled = (p) => p.waitForFunction(() => document.querySelector("textarea[readonly]")?.value?.length > 0, null, {timeout: 15000});
async function pair(b) {
  const h = await (await b.newContext()).newPage();
  const g = await (await b.newContext()).newPage();
  await h.goto(`${B}/room/t1?host=1`); await g.goto(`${B}/room/t1`);
  await h.getByRole("button", { name: "Generate invite code" }).click(); await filled(h);
  const offer = await h.locator("textarea[readonly]").inputValue();
  return { h, g, offer };
}
async function connect(h, g, offer) {
  await g.locator("textarea").fill(offer);
  await g.getByRole("button", { name: "Generate reply" }).click(); await filled(g);
  await h.locator("textarea:not([readonly])").fill(await g.locator("textarea[readonly]").inputValue());
  await h.getByRole("button", { name: "Connect" }).click();
  await h.getByText("Connected", { exact: true }).waitFor({ timeout: 20000 });
  await g.getByText("Connected", { exact: true }).waitFor({ timeout: 20000 });
}
(async () => {
  const b = await chromium.launch({ args });
  // 1. camera toggle
  {
    const p = await (await b.newContext()).newPage();
    await p.goto(`${B}/room/cam?host=1`); await p.waitForTimeout(1500);
    await p.getByRole("button", { name: "Turn camera off" }).click(); await p.waitForTimeout(200);
    await p.getByRole("button", { name: "Turn camera on" }).click(); await p.waitForTimeout(500);
    const v = await p.evaluate(() => { const v = document.querySelector("video"); return !!v.srcObject && v.srcObject.getVideoTracks()[0].enabled && !v.classList.contains("invisible"); });
    ok(v, "camera off→on keeps local video attached and visible");
  }
  // 2. invalid codes
  {
    const { h, g, offer } = await pair(b);
    await g.locator("textarea").fill("garbage!!");
    await g.getByRole("button", { name: "Generate reply" }).click();
    ok(await g.getByRole("alert").filter({ hasText: "doesn't look right" }).isVisible({ timeout: 5000 }).catch(() => false) || await g.getByText("doesn't look right").waitFor({timeout:5000}).then(()=>true).catch(()=>false), "garbage invite code shows error");
    await h.locator("textarea:not([readonly])").fill(offer);
    await h.getByRole("button", { name: "Connect" }).click();
    ok(await h.getByText("That's an invite code").waitFor({timeout:5000}).then(()=>true).catch(()=>false), "host pasting own invite shows 'expected answer' error");
    // recover and connect after errors
    await h.locator("textarea:not([readonly])").fill("");
    await connect(h, g, offer);
    ok(true, "can still connect after invalid codes");
    ok(await g.getByText("Host", { exact: true }).isVisible(), "guest sees remote labelled 'Host'");
    ok(await h.getByText("Guest", { exact: true }).isVisible(), "host sees remote labelled 'Guest'");
    // remote mute indicator
    await h.getByRole("button", { name: "Mute" }).click();
    ok(await g.getByRole("img", { name: "Muted" }).first().waitFor({timeout:5000}).then(()=>true).catch(()=>false), "guest sees host muted");
    await h.getByRole("button", { name: "Turn camera off" }).click();
    ok(await g.getByRole("img", { name: "Camera off" }).waitFor({timeout:5000}).then(()=>true).catch(()=>false), "guest sees host camera off");
    // chat
    await g.getByRole("button", { name: "Chat" }).click(); await h.getByRole("button", { name: "Chat" }).click();
    await g.getByPlaceholder("Message…").locator("visible=true").fill("hola"); await g.keyboard.press("Enter");
    ok(await h.getByText("hola").locator("visible=true").waitFor({timeout:5000}).then(()=>true).catch(()=>false), "chat message delivered");
    // hang up
    const t0 = Date.now();
    await h.getByRole("button", { name: "Leave call" }).click();
    const seen = await g.getByText("The other person left").waitFor({timeout:5000}).then(()=>true).catch(()=>false);
    ok(seen, `guest notified of hang-up (${Date.now()-t0} ms)`);
    await h.waitForURL(B + "/"); ok(true, "host returned home");
  }
  // 3. tab close
  {
    const { h, g, offer } = await pair(b);
    await connect(h, g, offer);
    await g.close();
    ok(await h.getByText("The other person left").waitFor({timeout:10000}).then(()=>true).catch(()=>false), "host notified when guest closes tab");
  }
  await b.close();
  // 4. permission denied
  {
    const b2 = await chromium.launch({ args: ["--use-fake-device-for-media-stream"] });
    const p = await (await b2.newContext()).newPage();
    await p.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError")); });
    await p.goto(`${B}/room/deny?host=1`);
    ok(await p.getByText("access was blocked").waitFor({timeout:8000}).then(()=>true).catch(()=>false), "denied permission shows message");
    ok(await p.getByRole("button", { name: "Try camera again" }).isVisible(), "retry button offered");
    await b2.close();
  }
  console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
})();
