#!/usr/bin/env node
/**
 * Regenerate README screenshots.
 * Run: node tools/screenshots.mjs
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = resolve(process.cwd());
const OUT = join(ROOT, "screenshots");
const PORT = 9354;
const PAGE = `file://${join(ROOT, process.env.PAGE || "index.html")}`;
mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "dsh-bd-shots-"));

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--mute-audio",
  "--hide-scrollbars", "--allow-file-access-from-files",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });

let ws, seq = 0;
const pending = new Map();
let errors = 0;
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
async function ev(expression, awaitPromise = false) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}
async function viewport(width, height) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 800 });
  await send("Emulation.setTouchEmulationEnabled", { enabled: width < 800 });
}
async function shot(name, wait = 600) {
  await sleep(wait);
  const r = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(join(OUT, name), Buffer.from(r.data, "base64"));
  console.log("  → screenshots/" + name);
}

async function setup() {
  const tab = await connect();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    } else if (m.method === "Runtime.exceptionThrown") {
      errors++;
      console.error("JS exception:", m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    }
  };
  await send("Page.enable");
  await send("Runtime.enable");
}

async function load() {
  await send("Page.navigate", { url: PAGE });
  for (let i = 0; i < 60; i++) {
    if (await ev("!!window.__BD_READY__")) break;
    await sleep(100);
  }
  await sleep(850);
}

async function run() {
  await setup();
  await viewport(1440, 900);
  await load();

  // 01 — menu (retro is the default mode)
  await ev("BD.setGraphics('retro', true)");
  await ev(`(() => {
    const S = BD.debug.S;
    S.best = 12480;
    S.completed = [true, true, true, true, false, false, false, false];
    BD.debug.renderOverlay('menu');
  })()`);
  await shot("01-menu-ru.png", 900);

  // 02 — modern gameplay, level 4
  await ev("BD.setGraphics('modern', true)");
  await ev(`(() => {
    const S = BD.debug.S;
    BD.debug.loadLevel(3, { score: 2430, screen: 'playing' });
    BD.debug.renderOverlay('playing');
    S.score = 2430; S.gems = 9; S.time = 37; S.lives = 3; S.best = 12480;
    document.getElementById('toast').className = 'toast';
  })()`);
  await shot("02-game-modern.png", 950);

  // 03 — retro gameplay
  await ev("BD.setGraphics('retro', true)");
  await shot("03-game-retro.png", 700);

  // 04 — level select
  await ev(`(() => {
    BD.setGraphics('modern', true);
    BD.menu();
    BD.debug.S.best = 12480;
    BD.debug.S.completed = [true, true, true, true, false, false, false, false];
    BD.openLevels();
    document.getElementById('toast').className = 'toast';
  })()`);
  await shot("04-levels-ru.png", 850);

  // 05 — mobile gameplay
  await viewport(390, 844);
  await load();
  await ev("BD.setGraphics('retro', true)");
  await ev(`(() => {
    BD.debug.loadLevel(0, { score: 0, screen: 'playing' });
    BD.debug.renderOverlay('playing');
    BD.debug.S.best = 12480;
    document.getElementById('toast').className = 'toast';
  })()`);
  await shot("05-mobile.png", 800);

  // 06 — victory
  await viewport(1440, 900);
  await ev(`(() => {
    BD.debug.loadLevel(7, { score: 12480, screen: 'playing' });
    BD.debug.renderOverlay('playing');
    const S = BD.debug.S;
    S.score = 12480; S.gems = S.quota; S.exitOpen = true; S.best = 11100;
    S.completed = [true, true, true, true, true, true, true, true];
    S.runTime = 612; S.lives = 3;
    document.getElementById('toast').className = 'toast';
    BD.debug.completeLevel();
  })()`);
  await sleep(2200);
  await shot("06-victory-ru.png", 500);

  if (errors) throw new Error(`${errors} JS errors while taking screenshots`);
  console.log("done · no JS errors");
}

try { await run(); }
catch (e) { console.error("SCREENSHOT FAILED:", e.message); process.exitCode = 1; }
finally {
  try { ws?.close(); } catch {}
  chrome.kill("SIGTERM");
  await sleep(250);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
