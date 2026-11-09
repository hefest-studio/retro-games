#!/usr/bin/env node
/* Скриншоты игры для README и приёмки: node tools/shots.mjs
 * Требуется локальный Chrome и Node 26+ (глобальные WebSocket/fetch).
 * Никаких npm-зависимостей.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "screenshots");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9451;
const PAGE = `file://${join(ROOT, "index.html")}`;
const profile = mkdtempSync(join(tmpdir(), "staratel-shots-"));
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-crashpad", "--disable-breakpad",
  "--hide-scrollbars", "--no-first-run", "--allow-file-access-from-files", "--mute-audio",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank"
], { stdio: "ignore" });

let ws, seq = 0;
const pending = new Map();
const listeners = new Map();
function send(method, params = {}) {
  const id = ++seq;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
function once(name, timeout = 20000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("timeout: " + name)), timeout);
    const arr = listeners.get(name) || [];
    arr.push((p) => { clearTimeout(t); res(p); });
    listeners.set(name, arr);
  });
}
async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
      if (r.ok) return await r.json();
    } catch { /* ещё не поднялся */ }
    await sleep(200);
  }
  throw new Error("Chrome DevTools не отвечает");
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
    } else if (msg.method) {
      const arr = listeners.get(msg.method);
      if (arr) { listeners.delete(msg.method); arr.forEach((fn) => fn(msg.params)); }
    }
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Runtime.exceptionThrown") {
      console.log("  ⚠ JS exception:", msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    }
  });
}
async function goto(url) {
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url });
  await loaded;
  await sleep(700);
}
async function ev(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(join(OUT, name + ".png"), Buffer.from(r.data, "base64"));
  console.log("  →", name + ".png");
}
async function run() {
  await setup();
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await goto(PAGE);
  const body = await ev(`JSON.stringify({levels: window.__LODE ? __LODE.levels.length : 0, fatal: document.getElementById('fatal')?.textContent || null})`);
  console.log("BOOT:", body);

  await sleep(500);
  await shot("title-neon");

  await ev(`__LODE.ui.applyTheme('retro', false); 1`);
  await sleep(600);
  await shot("title-retro");

  await ev(`__LODE.ui.applyTheme('neon', false); __LODE.ui.startRun(); 1`);
  await sleep(3200); // баннер сам уедет
  await shot("game-neon");

  await ev(`(()=>{const L=__LODE, g=L.game, ui=L.ui; ui.paused=true; ui.setScreen('none'); g.startLevel(4); g.state='playing'; g.freeze=0; ui.hideBanner(); for(let i=0;i<30;i++)g.update(1/60); L.renderer.draw(g, 0.016); return 1;})()`);
  await sleep(600);
  await shot("game-neon-level5");
  await ev(`__LODE.ui.applyTheme('retro', false); 1`);
  await sleep(600);
  await shot("game-retro-level5");
  await ev(`__LODE.ui.setScreen('pause'); 1`);
  await sleep(500);
  await shot("pause-retro");

  await ev(`(()=>{const L=__LODE,ui=L.ui; ui.applyTheme('neon',false); ui.setScreen('none'); ui.applyLanguage('ru',false); ui.setScreen('help'); return 1;})()`);
  await sleep(500);
  await shot("help-neon");

  await ev(`(()=>{const L=__LODE, g=L.game, ui=L.ui; ui.paused=true; ui.setScreen('none'); g.startLevel(2); g.state='playing'; g.freeze=0; g.enemies=[]; Array.from(g.gold).forEach(k=>{const a=k.split(',');g._collectGoldAt(+a[0],+a[1]);}); const p=g.player;p.x=g.exit.x;p.y=g.exit.y;p.px=p.x;p.py=p.y;p.move=null;p.state='idle';g._arrive(p); return 1;})()`);
  await sleep(700);
  await shot("complete-neon");

  await ev(`__LODE.ui.showGameover({score: 12345}); 1`);
  await sleep(500);
  await shot("gameover-neon");

  await ev(`__LODE.ui.showVictory({score: 54321}); 1`);
  await sleep(500);
  await shot("victory-neon");

  // mobile title + game (touch)
  await ev(`(()=>{const ui=__LODE.ui; ui.applyTheme('retro',false); ui.applyLanguage('ru',false); ui.setScreen('title'); __LODE.game.showTitlePreview(); return 1;})()`);
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await sleep(600);
  await shot("title-mobile");
  await ev(`__LODE.ui.startRun(); 1`);
  await sleep(3200);
  await shot("game-mobile");
  console.log("DONE →", OUT);
}
run().then(() => {
  try { ws?.close(); } catch { /* ok */ }
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ok */ }
  process.exit(0);
}).catch((err) => {
  console.error("SHOTS FAILED:", err);
  try { ws?.close(); } catch { /* ok */ }
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ok */ }
  process.exit(1);
});
