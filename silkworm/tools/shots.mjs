#!/usr/bin/env node
/**
 * Скриншоты и автотесты SILKWORM через Chrome DevTools Protocol.
 *
 *   node tools/shots.mjs               — скриншоты в screenshots/
 *   node tools/shots.mjs --test        — только автотесты (#test), код выхода 1 при провале
 *   node tools/shots.mjs title boss    — только указанные кадры
 *   node tools/shots.mjs --sim=600     — прогон полного забега без рендера
 *   node tools/shots.mjs --audio       — smoke-тест аудиодвижка
 *   node tools/shots.mjs --viewport=390x844 --prefix=mobile-   — мобильные кадры
 *
 * Требуется Google Chrome (macOS: /Applications/Google Chrome.app).
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "screenshots");
const PAGE = `file://${join(ROOT, "index.html")}`;
const PORT = 9411;
const args = process.argv.slice(2);
const testOnly = args.includes("--test");
const audioSmoke = args.includes("--audio");
const playtest = args.includes("--playtest");
const simArg = args.find((a) => a.startsWith("--sim="));
const simSeconds = simArg ? Number(simArg.split("=")[1]) || 300 : 0;
const vpArg = args.find((a) => a.startsWith("--viewport="));
const vp = vpArg ? vpArg.split("=")[1].split("x").map(Number) : [1200, 800];
const prefixArg = args.find((a) => a.startsWith("--prefix="));
const prefix = prefixArg ? prefixArg.split("=")[1] : "";
const only = args.filter((a) => !a.startsWith("--"));

mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "sw-chrome-"));
const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--disable-crashpad",
  "--disable-breakpad",
  "--hide-scrollbars",
  "--autoplay-policy=no-user-gesture-required",
  "--mute-audio",
  "--no-first-run",
  "--allow-file-access-from-files",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore" });

let ws;
let seq = 0;
const pending = new Map();
const listeners = new Map();

function send(method, params = {}) {
  const id = ++seq;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
function once(name, timeout = 25000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("timeout: " + name)), timeout);
    const arr = listeners.get(name) || [];
    arr.push((p) => { clearTimeout(t); res(p); });
    listeners.set(name, arr);
  });
}
async function connect() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
      if (r.ok) return await r.json();
    } catch { /* journal ещё не поднялся */ }
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
      if (msg.method === "Runtime.exceptionThrown") {
        console.log("  ⚠ JS:", msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description || "");
      }
      if (msg.method === "Log.entryAdded" && ["error", "warning"].includes(msg.params.entry.level)) {
        console.log("  ⚠ console:", msg.params.entry.text);
      }
    }
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
}
async function grab(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result?.value;
}
let navSeq = 0;
async function pressKey(key, code, vk) {
  const base = { key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  await send("Input.dispatchKeyEvent", { type: "keyDown", ...base, text: key.length === 1 ? key : undefined });
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
  await sleep(120);
}
async function holdKey(key, code, vk, ms) {
  const base = { key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  await send("Input.dispatchKeyEvent", { type: "keyDown", ...base, text: key.length === 1 ? key : undefined });
  await sleep(ms);
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
}
async function goto(url) {
  const i = url.indexOf("#");
  const base = i < 0 ? url : url.slice(0, i);
  const hash = i < 0 ? "" : url.slice(i);
  const full = `${base}?r=${++navSeq}${hash}`;
  const loaded = once("Page.loadEventFired").catch(() => null);
  await send("Page.navigate", { url: full });
  await Promise.race([loaded, sleep(9000)]);
  await grab(`new Promise(r => { let n = 0; const f = () => (++n > 3) ? r(1) : requestAnimationFrame(f); requestAnimationFrame(f); })`);
  await sleep(400);
}
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const file = join(OUT, `${prefix}${name}.png`);
  writeFileSync(file, Buffer.from(r.data, "base64"));
  const dim = await grab(`JSON.stringify({w: innerWidth, h: innerHeight})`);
  console.log("  →", `${prefix}${name}.png`, dim);
}

const SHOTS = [
  { name: "title", hash: "#shot=title" },
  { name: "title_modern", hash: "#gfx=modern&shot=title" },
  { name: "intro", hash: "#shot=intro&stage=1" },
  { name: "intro_modern", hash: "#gfx=modern&shot=intro&stage=1" },
  { name: "play", hash: "#shot=play&stage=1" },
  { name: "play_modern", hash: "#gfx=modern&shot=play&stage=1" },
  { name: "stage2_sea", hash: "#shot=play&stage=2" },
  { name: "stage3_modern", hash: "#gfx=modern&shot=play&stage=3" },
  { name: "stage4", hash: "#shot=play&stage=4" },
  { name: "boss", hash: "#shot=boss&stage=1" },
  { name: "boss_modern", hash: "#gfx=modern&shot=boss&stage=3" },
  { name: "clear", hash: "#shot=clear&stage=1" },
  { name: "pause", hash: "#shot=pause" },
  { name: "gameover", hash: "#shot=gameover" },
  { name: "victory", hash: "#shot=victory" },
  { name: "controls", hash: "#shot=controls" },
  { name: "controls_en_modern", hash: "#gfx=modern&lang=en&shot=controls" },
  { name: "title_en", hash: "#lang=en&shot=title" },
  { name: "play_en_modern", hash: "#gfx=modern&lang=en&shot=play&stage=2" },
];

async function main() {
  await setup();
  await send("Emulation.setDeviceMetricsOverride", { width: vp[0], height: vp[1], deviceScaleFactor: 1, mobile: vp[0] < 600 });
  if (playtest) {
    await goto(PAGE);
    const state = () => grab("JSON.stringify({ st: __SW.G.state, gfx: __SW.GFX(), lang: __SW.LANG(), score: __SW.G.score, bullets: __SW.G.bullets.length, enemies: __SW.G.enemies.length, lives: __SW.G.lives, phase: __SW.G.phase })");
    console.log("  start:", await state());
    await pressKey("Enter", "Enter", 13);
    console.log("  after Enter:", await state());
    await sleep(2600);
    await holdKey(" ", "Space", 32, 3200);
    console.log("  after fire 3.2s:", await state());
    await pressKey("p", "KeyP", 80);
    console.log("  after P (pause):", await state());
    await pressKey("p", "KeyP", 80);
    console.log("  after P (resume):", await state());
    await pressKey("g", "KeyG", 71);
    console.log("  after G (gfx):", await state());
    await pressKey("l", "KeyL", 76);
    console.log("  after L (lang):", await state());
    await pressKey("m", "KeyM", 77);
    await holdKey(" ", "Space", 32, 5000);
    console.log("  after 5s more:", await state());
    await pressKey("b", "KeyB", 66);
    await sleep(400);
    console.log("  after B (bomb):", await state());
    await pressKey("Escape", "Escape", 27);
    await pressKey("Escape", "Escape", 27);
    console.log("  after Esc x2:", await state());
    const err = await grab("document.getElementById('err')?.textContent || ''");
    const info = JSON.parse(await state());
    const ok = info.st === "play" || info.st === "pause" || info.st === "title";
    if (err.trim()) console.log("PAGE ERRORS:\n" + err.trim());
    await cleanup(err.trim() ? 1 : 0);
    return;
  }
  if (simSeconds) {
    await goto(`${PAGE}#sim=${simSeconds}`);
    await sleep(2500);
    const title = await grab("document.title");
    const sim = await grab("JSON.stringify(window.__SW_SIM__ || null)");
    const err = await grab("document.getElementById('err')?.textContent || ''");
    console.log("TITLE:", title);
    if (sim) {
      const r = JSON.parse(sim);
      console.log("SIM:", JSON.stringify(r, null, 1));
    }
    if (err.trim()) console.log("PAGE ERRORS:\n" + err.trim());
    const ok = /SIM VICTORY/.test(title || "") || (sim && JSON.parse(sim).state === "victory");
    await cleanup(ok && !err.trim() ? 0 : 1);
    return;
  }
  if (audioSmoke) {
    await goto(PAGE);
    const res = await grab(`(async () => {
      const out = { api: !!(window.SWAudio && window.SWAudio.playMusic), ready: false, errors: [] };
      try {
        window.SWAudio.unlock();
        await new Promise(r => setTimeout(r, 250));
        out.ready = !!(window.SWAudio.isReady && window.SWAudio.isReady());
        out.playStage = window.SWAudio.playMusic('stage');
        await new Promise(r => setTimeout(r, 400));
        out.playBoss = window.SWAudio.playMusic('boss');
        out.sfx = ['shoot','explosion','bomb','powerup'].map(n => window.SWAudio.sfx(n));
        await new Promise(r => setTimeout(r, 400));
        out.mute = window.SWAudio.setMuted(true);
        out.unmute = window.SWAudio.setMuted(false);
        out.test = window.SWAudio.selftest().filter(x => !x.ok).length;
      } catch (e) { out.errors.push(String(e && e.message || e)); }
      return JSON.stringify(out);
    })()`);
    let data = null;
    try { data = JSON.parse(res); } catch (e) { console.log("RAW:", res); }
    console.log("AUDIO:", JSON.stringify(data));
    const err = await grab("document.getElementById('err')?.textContent || ''");
    if (err.trim()) console.log("PAGE ERRORS:\n" + err.trim());
    const ok = !!data && data.api && data.ready && !data.errors.length && !err.trim();
    await cleanup(ok ? 0 : 1);
    return;
  }
  if (testOnly) {
    await goto(`${PAGE}#test`);
    await sleep(900);
    const title = await grab("document.title");
    const report = await grab("JSON.stringify(window.__SW_TESTS__ || null)");
    const err = await grab("document.getElementById('err')?.textContent || ''");
    console.log("TITLE:", title);
    if (report) {
      const data = JSON.parse(report);
      for (const r of data.results) console.log((r.ok ? "  ✓ " : "  ✗ ") + r.name + (r.msg ? " — " + r.msg : ""));
      console.log(`ИТОГО: ${data.pass}/${data.total}`);
    }
    if (err.trim()) console.log("PAGE ERRORS:\n" + err.trim());
    const ok = /PASS/.test(title || "") && !err.trim();
    await cleanup(ok ? 0 : 1);
    return;
  }
  await goto(PAGE);
  for (const s of SHOTS) {
    if (only.length && !only.some((o) => s.name.includes(o))) continue;
    await goto(`${PAGE}${s.hash}`);
    await sleep(650);
    await shot(s.name);
  }
  const err = await grab("document.getElementById('err')?.textContent || ''");
  if (err.trim()) console.log("PAGE ERRORS:\n" + err.trim());
  await cleanup(err.trim() ? 1 : 0);
}

async function cleanup(code) {
  try { ws.close(); } catch { /* ignore */ }
  try { chrome.kill("SIGKILL"); } catch { /* ignore */ }
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  process.exit(code);
}

main().catch(async (e) => {
  console.error("FAIL:", e.message);
  await cleanup(1);
});
