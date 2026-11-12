#!/usr/bin/env node
/**
 * Headless Chrome smoke test + screenshots for ОБВАЛ.
 * Usage: node tools/test.mjs
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = resolve(process.cwd());
const OUT = join(ROOT, "screenshots", "test");
const PORT = 9344;
const PAGE = `file://${join(ROOT, process.env.PAGE || "index.html")}`;
mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "obval-test-"));

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-crashpad",
  "--disable-breakpad", "--hide-scrollbars", "--no-first-run", "--mute-audio",
  "--allow-file-access-from-files", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });

let ws, seq = 0;
const pending = new Map();
const errors = [];
const warnings = [];

function send(method, params = {}) {
  const id = ++seq;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function connect() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
      if (r.ok) return r.json();
    } catch {}
    await sleep(150);
  }
  throw new Error("Chrome DevTools did not start");
}

async function setup() {
  const tab = await connect();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    } else if (msg.method === "Runtime.exceptionThrown") {
      errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    } else if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      errors.push(msg.params.entry.text);
    } else if (msg.method === "Runtime.consoleAPICalled") {
      const text = msg.params.args.map(a => a.value ?? a.description ?? "").join(" ");
      if (msg.params.type === "error") errors.push(text);
      if (msg.params.type === "warning") warnings.push(text);
    }
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Input.setIgnoreInputEvents", { ignore: false });
}

async function evaluate(expression, awaitPromise = false) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception?.description || ""));
  return r.result.value;
}

async function viewport(width, height, dpr = 1) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile: false });
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
}

async function goto() {
  const loaded = new Promise(res => {
    const t = setInterval(() => { if (true) {} }, 1000);
    const check = setInterval(async () => {
      try {
        const ready = await evaluate("!!window.__OBVAL_READY__");
        if (ready) { clearInterval(check); clearTimeout(t); res(); }
      } catch {}
    }, 100);
    setTimeout(() => { clearInterval(check); clearTimeout(t); res(); }, 5000);
  });
  await send("Page.navigate", { url: PAGE });
  await loaded;
  await evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))", true);
  await sleep(300);
}

async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, "base64"));
  console.log("  →", `screenshots/${name}.png`);
}

async function press(code, key, ms = 60) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", code, key, windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : undefined });
  await sleep(ms);
  await send("Input.dispatchKeyEvent", { type: "keyUp", code, key });
}

async function run() {
  await setup();
  await viewport(1440, 900, 1);
  await goto();

  console.log("\\n— loaded —");
  console.log("levels:", await evaluate("JSON.stringify(OBVAL.levels.map(l => l.name.ru + ' · ' + l.quota))"));
  console.log("validation:", await evaluate("JSON.stringify(OBVAL.validateLevels())"));
  console.log("state:", await evaluate("JSON.stringify(OBVAL.state)"));
  console.log("scroll:", await evaluate("JSON.stringify({sw:document.documentElement.scrollWidth, iw:innerWidth, sh:document.documentElement.scrollHeight, ih:innerHeight})"));
  await shot("01-menu-ru-modern");

  await press("Enter", "Enter", 80);
  await sleep(750);
  console.log("after Enter start:", await evaluate("JSON.stringify(OBVAL.state)"));
  console.log("audio:", await evaluate("JSON.stringify({ready:OBVAL.debug.Sound.ready, state:OBVAL.debug.Sound.ctx&&OBVAL.debug.Sound.ctx.state, track:OBVAL.debug.Sound.currentTrack, scheduler:!!OBVAL.debug.Sound.timer})"));
  await shot("02-play-ru-modern");

  // Move down/right a little, check that the player is actually able to move.
  const before = await evaluate("JSON.stringify(OBVAL.state.player)");
  await press("ArrowRight", "ArrowRight", 300);
  await press("ArrowDown", "ArrowDown", 300);
  const after = await evaluate("JSON.stringify(OBVAL.state.player)");
  console.log("player:", before, "→", after);

  await evaluate("OBVAL.toggleGraphics()");
  await sleep(350);
  console.log("graphics:", await evaluate("OBVAL.state.graphics"));
  await shot("03-play-ru-retro");

  await evaluate("OBVAL.toggleGraphics()");
  await sleep(200);
  await evaluate("OBVAL.pause()");
  await sleep(200);
  await shot("04-pause-ru-modern");
  await evaluate("OBVAL.resume()");
  await sleep(150);

  await evaluate("OBVAL.toggleLanguage()");
  await sleep(250);
  console.log("language:", await evaluate("OBVAL.state.language"));
  await shot("05-play-en-modern");
  await evaluate("OBVAL.toggleLanguage()");

  await evaluate("OBVAL.debug.S.gems = OBVAL.debug.S.quota; OBVAL.debug.S.exitOpen = true;");
  await sleep(100);
  await evaluate("OBVAL.debug.completeLevel()");
  await sleep(1100);
  await shot("06-clear-ru-modern");

  // Level select overlay
  await evaluate("OBVAL.menu(); OBVAL.openLevels()");
  await sleep(300);
  await shot("07-levels-ru-modern");
  await evaluate("OBVAL.menu()");
  await sleep(200);

  // Mobile layout
  await viewport(390, 844, 2);
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await evaluate("OBVAL.menu()");
  await sleep(300);
  await shot("08-menu-mobile");
  await evaluate("OBVAL.start(0)");
  await sleep(500);
  await shot("09-play-mobile");

  console.log("\\nerrors:", errors.length ? errors : "none");
  console.log("warnings:", warnings.slice(0, 8));
  console.log("final state:", await evaluate("JSON.stringify(OBVAL.state)"));
}

try {
  await run();
} catch (e) {
  console.error("TEST FAILED:", e.message);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch {}
  chrome.kill("SIGTERM");
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
