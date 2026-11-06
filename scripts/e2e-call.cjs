// End-to-end check of full calls between headless Chromium peers.
// Usage: npm run build && npm start   (in another shell)
//        npm run test:e2e [-- baseUrl]
// Requires a Chromium for Playwright: `npx playwright install chromium` (once).
const { chromium } = require("playwright");

const B = process.argv[2] ?? "http://localhost:3000";
const args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"];
let fails = 0;
const ok = (c, m) => {
  console.log((c ? "PASS " : "FAIL ") + m);
  if (!c) fails++;
};
const seen = (locator, timeout = 8000) =>
  locator.waitFor({ timeout }).then(() => true, () => false);
const connected = (p, timeout = 15000) =>
  seen(p.getByText("Connected", { exact: true }), timeout);
const room = () => "t" + Math.random().toString(36).slice(2, 10);

const filled = (p) =>
  p.waitForFunction(() => document.querySelector("textarea[readonly]")?.value?.length > 0, null, {
    timeout: 15000,
  });

async function newPage(b) {
  return (await b.newContext()).newPage();
}

async function manualPair(b) {
  const id = room();
  const h = await newPage(b);
  const g = await newPage(b);
  const manual = (p) =>
    p.getByRole("button", { name: "Having trouble? Connect manually with codes" }).click();
  // Switch the host first so the two can't auto-connect through the link.
  await h.goto(`${B}/room/${id}?host=1`);
  await manual(h);
  await g.goto(`${B}/room/${id}`);
  await manual(g);
  await h.getByRole("button", { name: "Generate invite code" }).click();
  await filled(h);
  const offer = await h.locator("textarea[readonly]").inputValue();
  return { h, g, offer };
}

async function manualConnect(h, g, offer) {
  await g.locator("textarea").fill(offer);
  await g.getByRole("button", { name: "Generate reply" }).click();
  await filled(g);
  await h.locator("textarea:not([readonly])").fill(await g.locator("textarea[readonly]").inputValue());
  await h.getByRole("button", { name: "Connect" }).click();
  return (await connected(h)) && (await connected(g));
}

(async () => {
  const b = await chromium.launch({ args });

  // --- Link mode -----------------------------------------------------------
  {
    const id = room();
    const h = await newPage(b);
    await h.goto(`${B}/room/${id}?host=1`);
    ok(await seen(h.getByText("Waiting for someone to join…")), "link: host waits for someone");
    const g = await newPage(b);
    const t0 = Date.now();
    await g.goto(`${B}/room/${id}`);
    ok((await connected(g)) && (await connected(h)), `link: host first, guest opens link → connected (${Date.now() - t0} ms)`);

    await g.getByRole("button", { name: "Chat" }).click();
    await h.getByRole("button", { name: "Chat" }).click();
    await g.getByPlaceholder("Message…").locator("visible=true").fill("hola");
    await g.keyboard.press("Enter");
    ok(await seen(h.getByText("hola").locator("visible=true")), "link: chat delivered");

    // Third person is turned away
    const x = await newPage(b);
    await x.goto(`${B}/room/${id}`);
    ok(await seen(x.getByText("already has two people")), "link: third visitor sees 'room full'");
    await x.close();

    // Guest leaves; host starts over; a new guest joins
    await g.getByRole("button", { name: "Leave call" }).click();
    ok(await seen(h.getByText("The other person left"), 5000), "link: host notified when guest leaves");
    await h.getByRole("button", { name: "Start over in this room" }).click();
    const g2 = await newPage(b);
    await g2.goto(`${B}/room/${id}`);
    ok((await connected(g2)) && (await connected(h)), "link: new guest can join after start over");
    await h.context().close();
    await g2.context().close();
  }
  {
    const id = room();
    const g = await newPage(b);
    await g.goto(`${B}/room/${id}`);
    await g.waitForTimeout(1500);
    const h = await newPage(b);
    await h.goto(`${B}/room/${id}?host=1`);
    ok((await connected(g)) && (await connected(h)), "link: guest first, host later → connected");
    // Reload keeps the same seat
    await g.reload();
    ok(await seen(h.getByText("The other person left"), 5000), "link: reload notifies the other side");
    await h.getByRole("button", { name: "Start over in this room" }).click();
    ok((await connected(g)) && (await connected(h)), "link: reloaded tab reconnects after start over");
    await h.context().close();
    await g.context().close();
  }
  {
    const id = room();
    const [h, g] = [await newPage(b), await newPage(b)];
    await Promise.all([h.goto(`${B}/room/${id}?host=1`), g.goto(`${B}/room/${id}`)]);
    ok((await connected(g)) && (await connected(h)), "link: both join at the same time → connected");
    await h.context().close();
    await g.context().close();
  }

  // --- In-call features (two fake cameras) ------------------------------------
  {
    const b3 = await chromium.launch({
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream=device-count=2",
        "--auto-select-desktop-capture-source=Entire screen",
      ],
    });
    const id = room();
    const h = await newPage(b3);
    const g = await newPage(b3);
    await h.goto(`${B}/room/${id}?host=1`);
    await g.goto(`${B}/room/${id}`);
    await connected(h);
    await connected(g);

    ok(await seen(g.getByText(/(\d+|<1) ms · /)), "network badge shows round-trip time");

    const camId = () =>
      h.evaluate(() => {
        // The self-view is the muted <video>; the first one in a call is the remote.
        const self = [...document.querySelectorAll("video")].find((v) => v.muted);
        return self?.srcObject?.getVideoTracks()[0]?.getSettings().deviceId;
      });
    const before = await camId();
    await h.getByRole("button", { name: "Switch camera" }).click();
    await h.waitForTimeout(1000);
    const after = await camId();
    ok(before && after && before !== after, "switch camera changes the capture device");
    // Ignore Next.js's own (empty) route announcer.
    const alerts = await h.locator("[role=alert]:not(#__next-route-announcer__)").count();
    ok(alerts === 0, "no error after switching camera");

    await h.getByRole("button", { name: "Share screen" }).click();
    ok(await seen(h.getByText("You · screen")), "host sees own screen in self-view");
    ok(
      await g
        .waitForFunction(() => [...document.querySelectorAll("video")].some((v) => v.classList.contains("object-contain")), null, { timeout: 8000 })
        .then(() => true, () => false),
      "guest shows the shared screen uncropped"
    );
    await h.getByRole("button", { name: "Stop sharing screen" }).click();
    ok(await seen(h.getByRole("button", { name: "Share screen" })), "screen share can be stopped");
    await b3.close();
  }

  // --- Relay limits -------------------------------------------------------------
  {
    const headers = { "x-forwarded-for": "203.0.113.9" };
    const codes = await Promise.all(
      Array.from({ length: 320 }, (_, i) =>
        fetch(`${B}/api/signal/flood?peer=p${i % 2}`, { headers }).then((r) => r.status)
      )
    );
    ok(codes.includes(429), "relay rate-limits a flood from one client");
  }

  // --- Media ----------------------------------------------------------------
  {
    const p = await newPage(b);
    await p.goto(`${B}/room/${room()}?host=1`);
    await p.waitForTimeout(1500);
    await p.getByRole("button", { name: "Turn camera off" }).click();
    await p.waitForTimeout(200);
    await p.getByRole("button", { name: "Turn camera on" }).click();
    await p.waitForTimeout(500);
    const v = await p.evaluate(() => {
      const v = document.querySelector("video");
      return !!v.srcObject && v.srcObject.getVideoTracks()[0].enabled && !v.classList.contains("invisible");
    });
    ok(v, "camera off→on keeps local video attached and visible");
    await p.context().close();
  }

  // --- Manual mode ----------------------------------------------------------
  {
    const { h, g, offer } = await manualPair(b);
    await g.locator("textarea").fill("garbage!!");
    await g.getByRole("button", { name: "Generate reply" }).click();
    ok(await seen(g.getByText("doesn't look right")), "manual: garbage invite code shows error");
    await h.locator("textarea:not([readonly])").fill(offer);
    await h.getByRole("button", { name: "Connect" }).click();
    ok(await seen(h.getByText("That's an invite code")), "manual: host pasting own invite shows error");
    await h.locator("textarea:not([readonly])").fill("");
    ok(await manualConnect(h, g, offer), "manual: can still connect after invalid codes");
    ok(await g.getByText("Host", { exact: true }).isVisible(), "guest sees remote labelled 'Host'");
    ok(await h.getByText("Guest", { exact: true }).isVisible(), "host sees remote labelled 'Guest'");

    await h.getByRole("button", { name: "Mute" }).click();
    ok(await seen(g.getByRole("img", { name: "Muted" }).first()), "guest sees host muted");
    await h.getByRole("button", { name: "Turn camera off" }).click();
    ok(await seen(g.getByRole("img", { name: "Camera off" })), "guest sees host camera off");

    const t0 = Date.now();
    await h.getByRole("button", { name: "Leave call" }).click();
    ok(await seen(g.getByText("The other person left"), 5000), `manual: guest notified of hang-up (${Date.now() - t0} ms)`);
    await h.waitForURL(B + "/");
    ok(true, "host returned home");
  }
  {
    const { h, g, offer } = await manualPair(b);
    await manualConnect(h, g, offer);
    await g.close();
    ok(await seen(h.getByText("The other person left"), 10000), "manual: host notified when guest closes tab");
  }
  await b.close();

  // --- Permission denied ------------------------------------------------------
  {
    const b2 = await chromium.launch({ args: ["--use-fake-device-for-media-stream"] });
    const p = await newPage(b2);
    await p.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
    });
    await p.goto(`${B}/room/${room()}?host=1`);
    ok(await seen(p.getByText("access was blocked")), "denied permission shows message");
    ok(await p.getByRole("button", { name: "Try camera again" }).isVisible(), "retry button offered");
    await b2.close();
  }

  console.log(fails ? `${fails} FAILED` : "ALL PASSED");
  process.exit(fails ? 1 : 0);
})();
