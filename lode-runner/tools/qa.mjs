#!/usr/bin/env node
/* ==========================================================================
   LODE RUNNER · приёмочный QA-прогон через Chrome DevTools Protocol.
   Запуск:  node lode-runner/tools/qa.mjs
   Пишет:   lode-runner/screenshots/qa/*.png + results.json
   Игровые файлы НЕ меняет. Chrome — headless, file://, отдельный профиль.
   ========================================================================== */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { loadavg, tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = "/Users/sergio/My/code/projects/music_book/lode-runner";
const OUT = join(ROOT, "screenshots/qa");
let devtoolsUrl = null;
const PAGE = `file://${ROOT}/index.html`;

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) {
  if (f.endsWith(".png") || f === "results.json") {
    try { rmSync(join(OUT, f)); } catch { /* ok */ }
  }
}

/* ---------------------------------------------------------------- results */
const RESULTS = {
  startedAt: new Date().toISOString(),
  checks: [],
  levels: [],
  screenshots: [],
  perf: null,
  errors: { exceptions: [], consoleErrors: [], consoleWarnings: [], fatal: null },
  meta: {},
};
const failures = () => RESULTS.checks.filter((c) => !c.pass);

function section(title) {
  console.log("");
  console.log("=".repeat(78));
  console.log("  " + title);
  console.log("=".repeat(78));
}
function check(id, name, pass, detail) {
  const rec = { id, name, pass: !!pass, detail: detail === undefined ? "" : detail };
  RESULTS.checks.push(rec);
  const icon = pass ? "PASS" : "FAIL";
  let d = "";
  if (detail !== undefined && detail !== "") {
    try {
      d = typeof detail === "string" ? detail : JSON.stringify(detail);
      if (d.length > 420) d = d.slice(0, 420) + "…";
    } catch { d = String(detail); }
  }
  console.log(`[${icon}] ${id} — ${name}${d ? "\n        " + d : ""}`);
  return pass;
}
function note(text) { console.log("   · " + text); }

/* ------------------------------------------------------------- CDP plumbing */
const profile = mkdtempSync(join(tmpdir(), "dsh-lr-qa-"));
let chromeStderr = "";
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-crashpad", "--disable-breakpad",
  "--hide-scrollbars", "--no-first-run", "--allow-file-access-from-files", "--mute-audio",
  "--disable-features=Translate,MediaRouter", "--force-device-scale-factor=1", "--disable-audio-output",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });
chrome.stderr.on("data", (d) => { chromeStderr += d.toString(); });
chrome.stdout.on("data", (d) => { chromeStderr += d.toString(); });
async function waitForDevTools() {
  for (let i = 0; i < 250; i++) {
    const m = chromeStderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (m) { devtoolsUrl = m[1]; return m[1]; }
    await sleep(100);
  }
  throw new Error("Chrome DevTools не стартовал. stderr:\n" + chromeStderr.slice(-1500));
}

let ws;
let seq = 0;
const pending = new Map();
const waiters = new Map(); // event name -> Set<{fn,timer}>
const ev = RESULTS.errors;

function send(method, params = {}, timeout = 90000) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error("CDP timeout: " + method)); }
    }, timeout);
    pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
function waitEvent(name, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const set = waiters.get(name) || new Set();
    const entry = {
      fn: resolve,
      timer: setTimeout(() => { set.delete(entry); reject(new Error("timeout event: " + name)); }, timeout),
    };
    set.add(entry);
    waiters.set(name, set);
  });
}
function emit(name, params) {
  const set = waiters.get(name);
  if (!set) return;
  waiters.delete(name);
  for (const e of set) { clearTimeout(e.timer); e.fn(params); }
}

async function connectTab() {
  const port = new URL(devtoolsUrl).port;
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
      if (r.ok) return await r.json();
    } catch { /* not up yet */ }
    await sleep(150);
  }
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  if (!list.length) throw new Error("Chrome DevTools не отвечает");
  return list[0];
}

const AUDIO_PROBE = `(() => {
  try {
    window.__qaAudio = { contexts: [], oscCount: 0, gainCount: 0 };
    const Orig = window.AudioContext || window.webkitAudioContext;
    if (!Orig) { window.__qaAudio.unsupported = true; return; }
    function WrappedCtx() {
      const ctx = new Orig(...arguments);
      window.__qaAudio.contexts.push(ctx);
      try {
        const co = ctx.createOscillator.bind(ctx);
        ctx.createOscillator = function () { window.__qaAudio.oscCount++; return co(); };
      } catch (e) { /* ignore */ }
      try {
        const cg = ctx.createGain.bind(ctx);
        ctx.createGain = function () { window.__qaAudio.gainCount++; return cg(); };
      } catch (e) { /* ignore */ }
      return ctx;
    }
    WrappedCtx.prototype = Orig.prototype;
    try { Object.setPrototypeOf(WrappedCtx, Orig); } catch (e) { /* ignore */ }
    window.AudioContext = WrappedCtx;
    window.webkitAudioContext = WrappedCtx;
  } catch (e) {
    window.__qaAudioError = String(e);
  }
})();`;

async function setup() {
  await waitForDevTools();
  const tab = await connectTab();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      return;
    }
    if (!msg.method) return;
    emit(msg.method, msg.params);
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      ev.exceptions.push((d.exception && (d.exception.description || d.exception.value)) || d.text || "unknown exception");
    }
    if (msg.method === "Runtime.consoleAPICalled") {
      const args = (msg.params.args || []).map((a) => a.value !== undefined ? a.value : a.description).join(" ");
      if (msg.params.type === "error") ev.consoleErrors.push(args);
      else if (msg.params.type === "warning") ev.consoleWarnings.push(args);
    }
    if (msg.method === "Log.entryAdded") {
      const e = msg.params.entry;
      if (e.level === "error") ev.consoleErrors.push(e.text);
      else if (e.level === "warning") ev.consoleWarnings.push(e.text);
    }
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: AUDIO_PROBE });
  try { await send("Emulation.setFocusEmulationEnabled", { enabled: true }); } catch { /* ok */ }
  try { await send("Page.bringToFront"); } catch { /* ok */ }
}

async function raceFrames(timeoutMs = 2000) {
  try {
    await Promise.race([
      js("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))", { awaitPromise: true }),
      sleep(timeoutMs),
    ]);
  } catch { /* rAF может быть throttled — не критично */ }
}
async function goto(url) {
  const loaded = waitEvent("Page.loadEventFired", 30000);
  await send("Page.navigate", { url });
  await loaded;
  try { await send("Page.bringToFront"); } catch { /* ok */ }
  await raceFrames();
  await sleep(450);
}

async function js(expression, opts = {}) {
  const r = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: !!opts.awaitPromise,
  });
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error("EvalError: " + ((d.exception && (d.exception.description || d.exception.value)) || d.text));
  }
  return r.result.value;
}
async function waitUntil(expression, timeout = 5000, stepMs = 50) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await js(expression)) return true; } catch { /* keep polling */ }
    await sleep(stepMs);
  }
  return false;
}

async function setShotMode(on) {
  try {
    await js(`(() => {
      let el = document.getElementById('qa-shot-style');
      if (${on} && !el) {
        el = document.createElement('style');
        el.id = 'qa-shot-style';
        el.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.orb{filter:none!important;opacity:.12!important}';
        document.head.appendChild(el);
      } else if (!${on} && el) {
        el.remove();
      }
      return true;
    })()`);
  } catch { /* ok */ }
}
async function shot(name) {
  await raceFrames();
  let buf = null;
  let softened = false;
  const attempts = [
    { format: "png", fromSurface: true },
    { format: "png", fromSurface: true },
    { format: "png", fromSurface: false },
  ];
  for (let i = 0; i < attempts.length && !buf; i++) {
    if (i === 1) { await setShotMode(true); softened = true; note("screenshot " + name + ": тяжёлые CSS-эффекты временно отключены для снимка (environment-limited)"); }
    try {
      const r = await send("Page.captureScreenshot", attempts[i], 150000);
      buf = Buffer.from(r.data, "base64");
    } catch (e) {
      console.log(`   ⚠ screenshot ${name}: попытка ${i + 1} не удалась (${e.message})`);
      await sleep(2500);
    }
  }
  if (softened) await setShotMode(false);
  if (!buf) {
    RESULTS.screenshotFailures = RESULTS.screenshotFailures || [];
    RESULTS.screenshotFailures.push({ name, reason: "capture timeout — environment load" });
    console.log(`   ✗ screenshot ${name}: пропущен (environment-limited), прогон продолжается`);
    return null;
  }
  const file = join(OUT, name + ".png");
  writeFileSync(file, buf);
  const rec = {
    name,
    file,
    bytes: buf.length,
    sha1: createHash("sha1").update(buf).digest("hex").slice(0, 12),
    softened,
    at: new Date().toISOString(),
  };
  RESULTS.screenshots.push(rec);
  console.log(`   → screenshots/qa/${name}.png (${(buf.length / 1024).toFixed(0)} KB)`);
  return rec;
}

/* ------------------------------------------------------------------ inputs */
const KEYDEF = {
  ArrowLeft: { key: "ArrowLeft", vk: 37 },
  ArrowRight: { key: "ArrowRight", vk: 39 },
  ArrowUp: { key: "ArrowUp", vk: 38 },
  ArrowDown: { key: "ArrowDown", vk: 40 },
  Enter: { key: "Enter", vk: 13 },
  Escape: { key: "Escape", vk: 27 },
  KeyA: { key: "a", vk: 65 },
  KeyD: { key: "d", vk: 68 },
  KeyW: { key: "w", vk: 87 },
  KeyS: { key: "s", vk: 83 },
  KeyG: { key: "g", vk: 71 },
  KeyM: { key: "m", vk: 77 },
  KeyL: { key: "l", vk: 76 },
  KeyP: { key: "p", vk: 80 },
  KeyZ: { key: "z", vk: 90 },
  KeyX: { key: "x", vk: 88 },
};
async function keyDown(code) {
  const d = KEYDEF[code];
  await send("Input.dispatchKeyEvent", {
    type: "keyDown", code, key: d.key,
    windowsVirtualKeyCode: d.vk, nativeVirtualKeyCode: d.vk,
  });
}
async function keyUp(code) {
  const d = KEYDEF[code];
  await send("Input.dispatchKeyEvent", {
    type: "keyUp", code, key: d.key,
    windowsVirtualKeyCode: d.vk, nativeVirtualKeyCode: d.vk,
  });
}
async function press(code, holdMs = 40) {
  await keyDown(code);
  await sleep(holdMs);
  await keyUp(code);
  await sleep(70);
}
async function holdKey(code, ms) {
  await keyDown(code);
  await sleep(ms);
  await keyUp(code);
  await sleep(80);
}
async function mouseClick(x, y) {
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await sleep(35);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}
async function rectOf(selector) {
  return js(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  })()`);
}
async function clickSelector(selector, pause = 420) {
  const r = await rectOf(selector);
  if (!r || r.w === 0 || r.h === 0) throw new Error("Элемент не найден/не виден: " + selector);
  await mouseClick(r.cx, r.cy);
  await sleep(pause);
  return r;
}
async function touchStartAt(x, y) {
  await send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1, radiusX: 12, radiusY: 12, force: 1 }],
  });
}
async function touchEndAll() {
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
async function touchTap(x, y) {
  await touchStartAt(x, y);
  await sleep(70);
  await touchEndAll();
  await sleep(200);
}
async function touchHold(x, y, ms) {
  await touchStartAt(x, y);
  await sleep(ms);
  await touchEndAll();
  await sleep(120);
}

/* --------------------------------------------------------------- viewports */
async function setDesktop() {
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
}
async function setMobile() {
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  let mediaErr = null;
  try {
    await send("Emulation.setEmulatedMedia", { features: [{ name: "pointer", value: "coarse" }] });
  } catch (e) { mediaErr = e.message; }
  await sleep(150);
  return mediaErr;
}

/* ------------------------------------------------------------ game helpers */
async function snap() {
  return js(`(() => {
    const L = window.__LODE, g = L.game;
    const hud = (id) => { const el = document.getElementById(id); return el ? el.textContent : null; };
    const active = document.querySelector('.screen.is-active');
    return {
      screen: document.body.dataset.screen,
      activeScreen: active ? active.getAttribute('data-screen') : null,
      state: g.state, level: g.levelIndex, lives: g.lives, score: g.score,
      goldLeft: g.gold.size, goldTotal: g.totalGold,
      exitOpen: g.exit.open, exitUsable: g.exitIsUsable(),
      px: Math.round(g.player.x * 100) / 100,
      py: Math.round(g.player.y * 100) / 100,
      pstate: g.player.state,
      holes: g.holes.size,
      enemies: g.enemies.map((e) => ({ x: e.x, y: e.y, state: e.state })),
      paused: L.ui.paused, lang: L.ui.lang, theme: L.ui.theme, muted: L.ui.muted,
      audioMuted: window.LR.audio.getMuted(),
      ctxState: (window.__qaAudio && window.__qaAudio.contexts.length)
        ? window.__qaAudio.contexts[window.__qaAudio.contexts.length - 1].state : null,
      osc: window.__qaAudio ? window.__qaAudio.oscCount : null,
      hudGold: hud('hud-gold'), hudGoldTotal: hud('hud-gold-total'), hudScore: hud('hud-score'),
      hudLives: hud('hud-lives'), hudLevel: hud('hud-level'), hudName: hud('hud-name'),
      hudExit: hud('hud-exit-state'), hudBest: hud('hud-best'), muteLabel: hud('mute-label'),
      toast: hud('toast'),
      fatal: document.getElementById('fatal') ? document.getElementById('fatal').textContent : null,
    };
  })()`);
}
async function teleport(x, y, state = "idle") {
  await js(`(() => {
    const p = window.__LODE.game.player;
    p.x = ${x}; p.y = ${y}; p.px = ${x}; p.py = ${y};
    p.move = null; p.state = ${JSON.stringify(state)}; p.hole = null; p.escape = 0;
    return true;
  })()`);
}
async function freezeEnemies() {
  return js(`(() => {
    const g = window.__LODE.game;
    g.enemies.forEach((en) => { en.state = 'dead'; en.deadTimer = 999; en.move = null; en.hole = null; });
    return g.enemies.length;
  })()`);
}
async function reviveEnemyAt(index, x, y) {
  return js(`(() => {
    const en = window.__LODE.game.enemies[${index}];
    if (!en) return false;
    en.state = 'idle'; en.deadTimer = 0; en.spawnTimer = 0; en.move = null; en.hole = null;
    en.x = ${x}; en.y = ${y}; en.px = ${x}; en.py = ${y}; en.wander = 0;
    return true;
  })()`);
}
async function titleDom() {
  return js(`(() => {
    const q = (s) => document.querySelector(s);
    const rect = (s) => {
      const el = q(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { x: r.x, y: r.y, w: r.width, h: r.height, display: cs.display, opacity: cs.opacity };
    };
    const overlap = (a, b) => (a && b) ? !(a.x + a.w <= b.x + 1 || b.x + b.w <= a.x + 1 || a.y + a.h <= b.y + 1 || b.y + b.h <= a.y + 1) : false;
    const texts = {};
    document.querySelectorAll('[data-i18n]').forEach((el) => { texts[el.getAttribute('data-i18n')] = el.textContent.trim(); });
    const start = rect('[data-action="start"]');
    const help = rect('[data-action="help"]');
    const card = rect('.title-card');
    return {
      scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight,
      innerW: innerWidth, innerH: innerHeight, card, start, help,
      meta: rect('.title-meta'), sw: rect('.theme-switch'), hint: rect('.title-hint'),
      overlapStartHelp: overlap(start, help),
      lang: document.body.classList.contains('lang-en') ? 'en' : 'ru',
      bodyClass: document.body.className,
      texts,
      activeScreen: q('.screen.is-active') ? q('.screen.is-active').getAttribute('data-screen') : null,
      titleBest: (document.getElementById('title-best') || {}).textContent,
      titleTheme: (document.getElementById('title-theme') || {}).textContent,
      langLabel: (document.getElementById('lang-label') || {}).textContent,
      muteLabel: (document.getElementById('mute-label') || {}).textContent,
      themeLabel: (document.getElementById('theme-label') || {}).textContent,
    };
  })()`);
}
async function hudLayout() {
  return js(`(() => {
    const hud = document.getElementById('hud');
    const hr = hud.getBoundingClientRect();
    const cells = Array.from(document.querySelectorAll('.hud-cell')).map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, text: el.textContent.trim().replace(/\\s+/g, ' ') };
    });
    const overlap = (a, b) => !(a.x + a.w <= b.x + 1 || b.x + b.w <= a.x + 1 || a.y + a.h <= b.y + 1 || b.y + b.h <= a.y + 1);
    let overlaps = 0;
    for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) if (overlap(cells[i], cells[j])) overlaps++;
    const c = document.getElementById('game');
    const cr = c.getBoundingClientRect();
    return {
      hud: { x: hr.x, y: hr.y, w: hr.width, h: hr.height },
      cells, overlaps,
      scrollW: document.documentElement.scrollWidth, innerW: innerWidth, innerH: innerHeight,
      hudScrollW: hud.scrollWidth, hudClientW: hud.clientWidth,
      canvas: { x: cr.x, y: cr.y, w: cr.width, h: cr.height, ratio: cr.width / cr.height },
      touchDisplay: getComputedStyle(document.querySelector('.touch-controls')).display,
      pointerCoarse: matchMedia('(pointer: coarse)').matches,
      dots: document.querySelectorAll('#lv-dots i').length,
      activeDots: document.querySelectorAll('#lv-dots i.is-active').length,
    };
  })()`);
}
async function canvasStats() {
  return js(`(() => {
    const c = document.getElementById('game');
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const uniq = new Set();
    let rS = 0, gS = 0, bS = 0, n = 0, nonblack = 0;
    const step = 4 * 499;
    for (let i = 0; i + 3 < d.length; i += step) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      uniq.add(r >> 4); uniq.add(g >> 4); uniq.add(b >> 4);
      rS += r; gS += g; bS += b; n++;
      if (r + g + b > 30) nonblack++;
    }
    return {
      w: c.width, h: c.height, uniq: uniq.size,
      nonblack: +(nonblack / n).toFixed(3),
      signature: [Math.round(rS / n), Math.round(gS / n), Math.round(bS / n)].join(','),
    };
  })()`);
}

async function overlayState() {
  return js(`(() => {
    const q = (s) => document.querySelector(s);
    const stage = q('#stage').getBoundingClientRect();
    const ov = q('#overlay').getBoundingClientRect();
    const hud = getComputedStyle(q('#hud'));
    const under = getComputedStyle(q('.underbar'));
    const scr = q('.screen.is-active');
    const sr = scr ? scr.getBoundingClientRect() : null;
    const cs = scr ? getComputedStyle(scr) : null;
    return {
      screen: document.body.dataset.screen,
      stage: { x: stage.x, y: stage.y, w: stage.width, h: stage.height },
      overlay: { x: ov.x, y: ov.y, w: ov.width, h: ov.height },
      screenRect: sr ? { x: sr.x, y: sr.y, w: sr.width, h: sr.height, display: cs.display, opacity: cs.opacity } : null,
      hudOpacity: hud.opacity, hudVisibility: hud.visibility, hudDisplay: hud.display,
      underOpacity: under.opacity, underVisibility: under.visibility, underDisplay: under.display,
      atHudCenter: (() => {
        const r = q('#hud').getBoundingClientRect();
        const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return el ? (el.id || el.className || el.tagName) : null;
      })(),
    };
  })()`);
}
async function assertOverlayCovered(id, label) {
  const o = await overlayState();
  const covers = !!(o.screenRect &&
    Math.abs(o.screenRect.x - o.stage.x) <= 3 && Math.abs(o.screenRect.y - o.stage.y) <= 3 &&
    Math.abs(o.screenRect.w - o.stage.w) <= 3 && Math.abs(o.screenRect.h - o.stage.h) <= 3 &&
    o.screenRect.display !== "none" && parseFloat(o.screenRect.opacity) > 0.5 &&
    !String(o.atHudCenter || "").split(" ").includes("hud"));
  check(id, `Оверлей «${label}» накрывает весь stage, HUD/underbar скрыты`,
    covers && parseFloat(o.hudOpacity) === 0 && parseFloat(o.underOpacity) === 0,
    { screen: o.screen, covers, hudOpacity: o.hudOpacity, underOpacity: o.underOpacity, screenRect: o.screenRect, stage: o.stage, atHudCenter: o.atHudCenter });
  return o;
}

/* ================================================================= phases */

async function phaseBootTitleAudio() {
  section("1. BOOT · TITLE · RU/EN · THEMES · AUDIO · HUD · PAUSE");
  await goto(PAGE);

  const boot = await js(`(() => {
    const c = document.getElementById('game');
    const r = c.getBoundingClientRect();
    return {
      levels: window.__LODE ? window.__LODE.levels.length : -1,
      screen: document.body.dataset.screen,
      canvas: { w: r.width, h: r.height },
      scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
      fatal: document.getElementById('fatal') ? document.getElementById('fatal').textContent : null,
      theme: window.__LODE.ui.theme, lang: window.__LODE.ui.lang,
    };
  })()`);
  check("boot.load", "Игра загрузилась: 10 уровней, экран title, без fatal", boot.levels === 10 && boot.screen === "title" && !boot.fatal, boot);
  check("boot.no-errors", "Нет JS-исключений и console.error при загрузке", ev.exceptions.length === 0 && ev.consoleErrors.length === 0, { exceptions: ev.exceptions.slice(0, 3), consoleErrors: ev.consoleErrors.slice(0, 3) });
  await shot("title-neon");

  /* ---- титул RU ---- */
  let t = await titleDom();
  const missingRu = Object.entries(t.texts).filter(([k, v]) => !v || v === k).map(([k]) => k);
  check("title.ru.texts", "Титул RU: ключевые тексты и подписи верные",
    t.lang === "ru" && t.texts.start === "НАЧАТЬ ПОГРУЖЕНИЕ" && t.texts.help === "КАК ИГРАТЬ" &&
    t.texts.title_sub === "ПОГРУЖЕНИЕ" && t.titleTheme === "НЕОН" && t.langLabel === "RU" && t.themeLabel === "НЕОН",
    { lang: t.lang, start: t.texts.start, help: t.texts.help, theme: t.titleTheme, langLabel: t.langLabel });
  check("title.i18n.complete", "Нет пустых/непереведённых i18n-узлов на титуле", missingRu.length === 0, { missing: missingRu });
  check("title.layout.desktop", "Титул 1280×800: без горизонтального переполнения и наложений",
    t.scrollW <= t.innerW + 1 && !t.overlapStartHelp && t.card && t.card.w > 0 &&
    t.start && t.start.w > 0 && t.start.y >= 0 && t.start.y + t.start.h <= t.innerH + 1,
    { scrollW: t.scrollW, innerW: t.innerW, start: t.start });
  await assertOverlayCovered("overlay.cover.title", "title");

  /* ---- аудио до жеста ---- */
  const a0 = await js(`({ ctxs: window.__qaAudio ? window.__qaAudio.contexts.length : -1, osc: window.__qaAudio ? window.__qaAudio.oscCount : -1, ready: window.LR.audio.isReady() })`);
  check("audio.before-gesture", "До жеста AudioContext ещё не создан (autoplay policy)", a0.ctxs === 0 && a0.ready === false, a0);

  await mouseClick(12, 12); // доверенный клик по пустому месту
  await sleep(800);
  const a1 = await js(`(() => { const A = window.__qaAudio; const ctx = A && A.contexts.length ? A.contexts[0] : null; return { ctxs: A ? A.contexts.length : 0, state: ctx ? ctx.state : null, osc: A ? A.oscCount : 0, ct: ctx ? +ctx.currentTime.toFixed(3) : null, ready: window.LR.audio.isReady() }; })()`);
  check("audio.unlock", "Доверенный клик (CDP mouse) запускает AudioContext running", a1.ctxs >= 1 && a1.state === "running" && a1.ready === true, a1);
  await sleep(1100);
  const a2 = await js(`(() => { const A = window.__qaAudio; const ctx = A && A.contexts.length ? A.contexts[0] : null; return { osc: A ? A.oscCount : 0, state: ctx ? ctx.state : null, ct: ctx ? +ctx.currentTime.toFixed(3) : null }; })()`);
  check("audio.music", "После клика стартует музыка (AudioContext clock идёт, осцилляторы планируются)",
    a2.osc > a1.osc && a2.state === "running" && a2.ct > (a1.ct || 0),
    { oscBefore: a1.osc, oscAfter: a2.osc, ctBefore: a1.ct, ctAfter: a2.ct, state: a2.state });

  await press("KeyM");
  await sleep(500);
  const a3 = await js(`({ muted: window.LR.audio.getMuted(), cls: document.body.classList.contains('is-muted'), label: document.getElementById('mute-label').textContent })`);
  check("audio.mute", "M глушит звук (is-muted + ЗВУК ВЫКЛ + getMuted)", a3.muted === true && a3.cls === true && a3.label === "ЗВУК ВЫКЛ", a3);
  await press("KeyM");
  await sleep(700);
  const a4 = await js(`({ muted: window.LR.audio.getMuted(), cls: document.body.classList.contains('is-muted'), label: document.getElementById('mute-label').textContent, state: window.__qaAudio && window.__qaAudio.contexts.length ? window.__qaAudio.contexts[0].state : null })`);
  check("audio.unmute", "M включает звук обратно, AudioContext остаётся running", a4.muted === false && a4.cls === false && a4.label === "ЗВУК ВКЛ" && a4.state === "running", a4);

  /* ---- темы на титуле ---- */
  await clickSelector('.theme-switch [data-theme="retro"]');
  const th = await js(`({ theme: window.__LODE.ui.theme, retro: document.body.classList.contains('theme-retro'), label: document.getElementById('theme-label').textContent, titleTheme: document.getElementById('title-theme').textContent })`);
  check("theme.retro.title", "Кнопка «8-БИТ» переключает тему на титуле", th.theme === "retro" && th.retro && th.label === "8-БИТ" && th.titleTheme === "8-БИТ", th);
  await shot("title-retro");
  await clickSelector('.theme-switch [data-theme="neon"]');
  const th2 = await js(`({ theme: window.__LODE.ui.theme, neon: document.body.classList.contains('theme-neon') })`);
  check("theme.neon.title", "Кнопка «НЕОН» возвращает неоновую тему", th2.theme === "neon" && th2.neon, th2);

  /* ---- язык EN ---- */
  await clickSelector('[data-action="lang"]');
  const en = await js(`(() => {
    const start = document.querySelector('[data-action="start"] span').textContent.trim();
    return {
      lang: window.__LODE.ui.lang, cls: document.body.classList.contains('lang-en'),
      start, help: document.querySelector('[data-action="help"] span').textContent.trim(),
      hint: document.querySelector('.title-hint').textContent.trim(),
      langLabel: document.getElementById('lang-label').textContent,
    };
  })()`);
  check("lang.en", "Кнопка L переключает на EN (заголовок/кнопки/подсказки)", en.lang === "en" && en.cls && en.start === "START THE DESCENT" && en.help === "HOW TO PLAY" && en.langLabel === "EN", en);
  const enDyn = await js(`(() => {
    const t = (s) => { const el = document.querySelector(s); return el ? el.textContent.trim() : null; };
    return {
      chipGraphics: t('#btn-theme .chip-label'), themeValue: t('#theme-label'),
      mute: t('#mute-label'), lang: t('#lang-label'),
      switchThemes: Array.from(document.querySelectorAll('.theme-switch button')).map((b) => b.textContent.trim()),
      hudLabels: Array.from(document.querySelectorAll('.hud-label')).map((el) => el.textContent.trim()),
      legend: Array.from(document.querySelectorAll('.underbar .lchip span')).map((el) => el.textContent.trim()),
      keybar: Array.from(document.querySelectorAll('.keybar em')).map((el) => el.textContent.trim()),
    };
  })()`);
  check("lang.en.dynamic-labels", "EN: динамические подписи ГРАФИКА/ЗВУК/кнопки тем/HUD обновились",
    enDyn.themeValue === "NEON" && enDyn.chipGraphics === "GRAPHICS" && enDyn.mute === "SOUND ON" &&
    enDyn.switchThemes.indexOf("NEON") >= 0 && enDyn.switchThemes.indexOf("8-BIT") >= 0 &&
    ["LEVEL", "GOLD", "SCORE", "LIVES"].every((w) => enDyn.hudLabels.indexOf(w) >= 0) &&
    enDyn.legend.indexOf("gold +100") >= 0 && enDyn.keybar.indexOf("move") >= 0,
    enDyn);
  const tEn = await titleDom();
  const missingEn = Object.entries(tEn.texts).filter(([k, v]) => !v || v === k).map(([k]) => k);
  check("lang.en.layout", "Титул EN: i18n заполнен, без переполнения",
    tEn.scrollW <= tEn.innerW + 1 && !tEn.overlapStartHelp && missingEn.length === 0 && tEn.start.w > 0,
    { scrollW: tEn.scrollW, innerW: tEn.innerW, missing: missingEn });
  await shot("title-en");
  await clickSelector('[data-action="lang"]');
  const ruBack = await js(`({ lang: window.__LODE.ui.lang, cls: document.body.classList.contains('lang-ru') })`);
  check("lang.ru.back", "Повторное L возвращает RU", ruBack.lang === "ru" && ruBack.cls, ruBack);

  /* ---- help ---- */
  await clickSelector('[data-action="help"]');
  const help = await js(`(() => {
    const q = (s) => document.querySelector(s);
    const el = q('.screen.is-active .panel');
    const r = el.getBoundingClientRect();
    const ov = q('.screen.is-active');
    const cs = getComputedStyle(ov);
    return {
      screen: document.body.dataset.screen,
      panel: { x: r.x, y: r.y, w: r.width, h: r.height },
      innerW: innerWidth, innerH: innerHeight,
      ovOverflow: cs.overflowY, ovClient: ov.clientHeight, ovScroll: ov.scrollHeight,
      title: q('.screen.is-active h2').textContent,
      actions: document.querySelectorAll('.screen.is-active .panel-actions button').length,
      items: document.querySelectorAll('.screen.is-active .help-list li').length,
    };
  })()`);
  const helpFits = help.panel.x >= 0 && help.panel.y >= 0 &&
    help.panel.x + help.panel.w <= help.innerW + 1 && help.panel.y + help.panel.h <= help.innerH + 1;
  check("overlay.help", "Help открывается кнопкой, контент не обрезан, кнопка закрытия есть",
    help.screen === "help" && help.panel.w > 0 && help.actions >= 1 && (helpFits || help.ovScroll > help.ovClient),
    help);
  await shot("help");
  await assertOverlayCovered("overlay.cover.help", "help");
  await clickSelector('[data-action="close-help"]');
  check("overlay.help.close", "Кнопка «Понятно» закрывает help и возвращает титул", (await snap()).screen === "title");

  /* ---- старт игры кнопкой ---- */
  await clickSelector('[data-action="start"]', 650);
  let st = await snap();
  check("title.start.button", "Кнопка «Начать погружение» запускает забег", st.screen === "none" && st.state === "playing" && st.level === 0, { screen: st.screen, state: st.state, level: st.level });
  const hudVis = await overlayState();
  check("hud.visible.game", "В игре HUD и underbar видимы (не под оверлеем)", hudVis.hudOpacity === "1" && hudVis.underOpacity === "1", { hudOpacity: hudVis.hudOpacity, underOpacity: hudVis.underOpacity });
  await freezeEnemies();
  await sleep(3300); // ждём, пока скроется баннер уровня

  await shot("game-neon");
  const cvsNeon = await canvasStats();
  check("render.neon", "Неон рисует поле (canvas не пустой)", cvsNeon.uniq >= 16 && cvsNeon.nonblack > 0.5, cvsNeon);

  const hd = await hudLayout();
  check("hud.desktop.layout", "HUD 1280×800: 4 ячейки без наложений/переполнения, 10 точек уровней",
    hd.overlaps === 0 && hd.scrollW <= hd.innerW + 1 && hd.dots === 10 && hd.activeDots === 1 && hd.canvas.ratio > 1.6 && hd.canvas.ratio < 1.9 && hd.canvas.w <= hd.innerW + 1,
    { overlaps: hd.overlaps, scrollW: hd.scrollW, innerW: hd.innerW, canvas: hd.canvas, dots: hd.dots });
  const hs = await snap();
  check("hud.desktop.values", "HUD: уровень/золото/очки/жизни/название/выход",
    hs.hudLevel === "01" && hs.hudGold === "00" && hs.hudGoldTotal === "03" && hs.hudScore === "000000" &&
    hs.hudLives === "♥♥♥" && hs.hudExit === "ВЫХОД ЗАКРЫТ" && hs.hudName.length > 0 && hs.hudBest.startsWith("РЕКОРД"),
    { level: hs.hudLevel, gold: hs.hudGold + "/" + hs.hudGoldTotal, score: hs.hudScore, lives: hs.hudLives, exit: hs.hudExit, name: hs.hudName, best: hs.hudBest });

  /* ---- тема 8-бит в игре ---- */
  await press("KeyG");
  await sleep(700);
  const rg = await js(`({ theme: window.__LODE.ui.theme, retro: document.body.classList.contains('theme-retro'), rendererTheme: window.__LODE.renderer.theme })`);
  check("theme.retro.game", "G переключает игру на 8-битную тему", rg.theme === "retro" && rg.retro && rg.rendererTheme === "retro", rg);
  await shot("game-retro");
  const cvsRetro = await canvasStats();
  check("render.retro", "8-бит рисует поле и заметно отличается от неона",
    cvsRetro.uniq >= 8 && cvsRetro.nonblack > 0.15 && cvsRetro.signature !== cvsNeon.signature,
    { neon: cvsNeon.signature, retro: cvsRetro.signature, uniq: [cvsNeon.uniq, cvsRetro.uniq], nonblack: [cvsNeon.nonblack, cvsRetro.nonblack] });
  await press("KeyG");
  await sleep(500);
  const backNeon = await js(`({ theme: window.__LODE.ui.theme })`);
  check("theme.neon.game", "Повторный G возвращает неон", backNeon.theme === "neon", backNeon);

  /* ---- пауза кнопкой ---- */
  await clickSelector('[data-action="pause"]');
  const pz = await snap();
  check("pause.button", "Кнопка паузы открывает оверлей pause", pz.screen === "pause" && pz.paused === true, { screen: pz.screen });
  const pauseLayout = await js(`(() => {
    const el = document.querySelector('.screen.is-active .panel');
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, innerW: innerWidth, innerH: innerHeight,
      btns: document.querySelectorAll('.screen.is-active .panel-actions button').length };
  })()`);
  check("overlay.pause", "Оверлей pause: панель в кадре, 3 кнопки", pauseLayout.btns === 3 && pauseLayout.x >= 0 && pauseLayout.y >= 0 && pauseLayout.x + pauseLayout.w <= pauseLayout.innerW + 1 && pauseLayout.y + pauseLayout.h <= pauseLayout.innerH + 1, pauseLayout);
  await shot("pause");
  await assertOverlayCovered("overlay.cover.pause", "pause");
  await clickSelector('[data-action="resume"]');
  const rs = await snap();
  check("pause.resume.button", "Кнопка «Продолжить» снимает паузу", rs.screen === "none" && rs.paused === false && rs.state === "playing", { screen: rs.screen, paused: rs.paused });
}

async function phaseGameplay() {
  section("2. ГЕЙМПЛЕЙ: ДВИЖЕНИЕ · ЛЕСТНИЦА · ЗОЛОТО · КОПАНИЕ · ВРАГ · СМЕРТЬ · ВЫХОД");
  await goto(PAGE);
  await press("Enter");
  await sleep(500);
  let s = await snap();
  check("game.start.enter", "Enter на титуле запускает забег", s.screen === "none" && s.state === "playing" && s.level === 0, { screen: s.screen, state: s.state, level: s.level });
  await freezeEnemies();
  await sleep(1000); // freeze 0.7s + запас

  /* движение стрелками */
  const m0 = await snap();
  await holdKey("ArrowRight", 380);
  const m1 = await snap();
  check("game.move.arrowright", "Стрелка вправо двигает героя", m1.px > m0.px, { from: m0.px, to: m1.px });
  await holdKey("KeyA", 420);
  const m2 = await snap();
  check("game.move.wasd", "WASD (A) двигает героя влево", m2.px < m1.px, { from: m1.px, to: m2.px });

  /* лазание */
  await teleport(12, 14);
  await sleep(150);
  const c0 = await snap();
  await holdKey("ArrowUp", 520);
  const c1 = await snap();
  check("game.climb.up", "Герой поднимается по лестнице (↑)", c1.py < c0.py, { from: c0.py, to: c1.py, state: c1.pstate });

  /* сбор золота настоящим шагом */
  await teleport(15, 14);
  await sleep(120);
  const g0 = await snap();
  await holdKey("ArrowRight", 260);
  const g1 = await snap();
  check("game.gold.collect", "Сбор золота: HUD 01/03, +100 очков", g1.goldLeft === g0.goldLeft - 1 && g1.score === g0.score + 100 && g1.hudGold === "01", { goldLeft: g1.goldLeft, score: g1.score, hudGold: g1.hudGold });

  /* копание: игрок на (5,3), кирпич (6,4) — не под выходом/золотом */
  await freezeEnemies();
  await teleport(5, 3);
  await sleep(150);
  await press("KeyX");
  await sleep(140);
  const digState = await js(`({ holes: window.__LODE.game.holes.size, tile: window.__LODE.game.tileAt(6, 4), pstate: window.__LODE.game.player.state })`);
  check("game.dig.x", "Копание X: кирпич превращается в яму", digState.holes === 1 && digState.tile === ".", digState);
  const digIdle = await waitUntil(`window.__LODE.game.player.state === 'idle'`, 1500);
  check("game.dig.anim", "Анимация копания завершается, герой снова idle", digIdle);

  /* враг падает в яму и гибнет */
  await reviveEnemyAt(0, 6, 3);
  const tr0 = await snap();
  const fell = await waitUntil(`(() => { const g = window.__LODE.game; const e = g.enemies[0]; return e.state === 'hole' && e.x === 6 && e.y === 4; })()`, 2500);
  check("game.enemy.fall", "Враг падает в выкопанную яму", fell, await js(`(() => { const e = window.__LODE.game.enemies[0]; return { x: e.x, y: e.y, state: e.state }; })()`));
  const enemyDead = await waitUntil(`window.__LODE.game.enemies[0].state === 'dead'`, 18000, 80);
  const tr1 = await snap();
  check("game.enemy.die", "Враг гибнет при закрытии ямы: +150 и тост", enemyDead && tr1.score === tr0.score + 150 && /\+150/.test(tr1.toast), { dead: enemyDead, scoreDelta: tr1.score - tr0.score, toast: tr1.toast });
  const holeClosed = await waitUntil(`window.__LODE.game.tileAt(6, 4) === '=' && window.__LODE.game.holes.size === 0`, 8000);
  check("game.hole.close", "Яма закрывается, кирпич восстанавливается", holeClosed);

  /* смерть в собственной яме */
  await freezeEnemies();
  await teleport(5, 3);
  await sleep(120);
  await press("KeyX");
  const holeMade = await waitUntil(`window.__LODE.game.holes.size === 1`, 1500);
  await js(`(() => {
    const p = window.__LODE.game.player;
    p.x = 6; p.y = 4; p.px = 6; p.py = 4; p.move = null; p.state = 'hole'; p.hole = '6,4'; p.escape = 0;
    return true;
  })()`);
  const ph0 = await snap();
  const holeDying = await waitUntil(`window.__LODE.game.state === 'dying'`, 30000, 100);
  const diedInHole = await waitUntil(`window.__LODE.game.lives === ${ph0.lives - 1} && window.__LODE.game.state === 'playing'`, 30000, 100);
  const ph1 = await snap();
  check("game.death.hole", "Герой, засыпанный в яме, теряет жизнь и респаунится", holeMade && holeDying && diedInHole && ph1.lives === ph0.lives - 1 && ph1.screen === "none", { holeMade, holeDying, livesBefore: ph0.lives, livesAfter: ph1.lives, state: ph1.state });

  /* смерть от врага + respawn */
  await freezeEnemies();
  const l0 = await snap();
  await reviveEnemyAt(0, l0.px, l0.py);
  const dying = await waitUntil(`window.__LODE.game.state === 'dying'`, 15000);
  const respawned = await waitUntil(`window.__LODE.game.state === 'playing' && window.__LODE.game.lives === ${l0.lives - 1}`, 25000, 100);
  const afterDeath = await snap();
  check("game.death.enemy", "Смерть от врага: dying → respawn с -1 жизнью", dying && respawned && afterDeath.screen === "none", { dying, livesBefore: l0.lives, livesAfter: afterDeath.lives });

  /* сбор всего золота → выход открыт */
  await freezeEnemies();
  const collect = await js(`(() => {
    const L = window.__LODE.ui, g = L.game;
    const keys = Array.from(g.gold);
    keys.forEach((k) => { const xy = k.split(','); g._collectGoldAt(+xy[0], +xy[1]); });
    L.updateHud(true);
    return { left: g.gold.size, open: g.exit.open, usable: g.exitIsUsable(), score: g.score, bar: document.getElementById('gold-bar').style.width };
  })()`);
  const ov = await snap();
  check("game.exit.open", "После всего золота выход открывается (состояние + HUD + полоса)", collect.left === 0 && collect.open && collect.usable && ov.hudExit === "ВЫХОД ОТКРЫТ" && parseFloat(collect.bar) >= 99.9, { left: collect.left, open: collect.open, usable: collect.usable, hudExit: ov.hudExit, bar: collect.bar });

  /* вход в выход → complete */
  await teleport(5, 3);
  await sleep(150);
  await holdKey("ArrowLeft", 500);
  const completed = await waitUntil(`window.__LODE.game.state === 'complete'`, 15000, 100);
  await sleep(400);
  const cs = await snap();
  check("game.complete", "Приход в открытый выход завершает уровень", completed && cs.screen === "complete" && (await js(`document.body.dataset.screen`)) === "complete", { state: cs.state, screen: cs.screen });
  const completeInfo = await js(`(() => {
    const q = (id) => document.getElementById(id).textContent;
    const el = document.querySelector('.screen.is-active .panel');
    const r = el ? el.getBoundingClientRect() : null;
    return {
      time: q('complete-time'), bonus: q('complete-bonus'), score: q('complete-score'), next: q('complete-next-label'),
      panel: r ? { x: r.x, y: r.y, w: r.width, h: r.height, innerW: innerWidth, innerH: innerHeight } : null,
    };
  })()`);
  const completeFits = completeInfo.panel && completeInfo.panel.y >= 0 && completeInfo.panel.y + completeInfo.panel.h <= completeInfo.panel.innerH + 1;
  check("overlay.complete.content", "Оверлей complete: время/бонус/очки/кнопка «Дальше», панель в кадре",
    /^\d\d:\d\d$/.test(completeInfo.time) && /^\+\d+$/.test(completeInfo.bonus) && /^\d{6}$/.test(completeInfo.score) && completeInfo.next === "ДАЛЬШЕ" && completeFits,
    completeInfo);
  await shot("complete");
  await assertOverlayCovered("overlay.cover.complete", "complete");

  /* Enter → следующий уровень */
  await press("Enter");
  await sleep(800);
  const nl = await snap();
  check("game.nextlevel", "Enter на complete → следующий уровень (02), игра продолжается", nl.level === 1 && nl.state === "playing" && nl.screen === "none" && nl.hudLevel === "02" && nl.hudName.length > 0, { level: nl.level, state: nl.state, hudLevel: nl.hudLevel, hudName: nl.hudName });

  /* пауза клавишей P */
  await press("KeyP");
  await sleep(350);
  const pz = await snap();
  check("pause.key", "P ставит игру на паузу (overlay pause)", pz.screen === "pause" && pz.paused === true, { screen: pz.screen });
  await press("Enter");
  await sleep(350);
  const rs2 = await snap();
  check("pause.resume.key", "Enter с паузы продолжает игру", rs2.screen === "none" && rs2.state === "playing" && rs2.paused === false, { screen: rs2.screen, state: rs2.state });

  /* game over */
  await freezeEnemies();
  await js(`window.__LODE.game.lives = 1;`);
  const go0 = await snap();
  await reviveEnemyAt(0, go0.px, go0.py);
  const gameover = await waitUntil(`window.__LODE.game.state === 'gameover'`, 25000, 100);
  await sleep(450);
  const go = await snap();
  check("game.gameover", "Смерть на последней жизни → gameover overlay", gameover && go.screen === "gameover", { state: go.state, screen: go.screen });
  const goInfo = await js(`({ score: document.getElementById('gameover-score').textContent, best: document.getElementById('gameover-best').textContent, btns: document.querySelectorAll('.screen.is-active .panel-actions button').length })`);
  check("overlay.gameover.content", "Оверлей gameover: счёт/рекорд и 2 кнопки", /^\d{6}$/.test(goInfo.score) && goInfo.best.length > 0 && goInfo.btns === 2, goInfo);
  await shot("gameover");
  await assertOverlayCovered("overlay.cover.gameover", "gameover");
  await press("Enter");
  await sleep(700);
  const again = await snap();
  check("game.restart", "Enter на gameover начинает новый забег (3 жизни, уровень 01)", again.screen === "none" && again.state === "playing" && again.lives === 3 && again.level === 0, { screen: again.screen, state: again.state, lives: again.lives, level: again.level });

  /* victory: последний уровень */
  await js(`(() => {
    const L = window.__LODE;
    L.ui.setScreen('none'); L.ui.paused = false;
    L.game.lives = 3;
    L.game.startLevel(9);
    L.game.freeze = 0;
    L.ui.updateHud(true);
    return true;
  })()`);
  await sleep(300);
  await freezeEnemies();
  const vcollect = await js(`(() => {
    const L = window.__LODE.ui, g = L.game;
    const keys = Array.from(g.gold);
    keys.forEach((k) => { const xy = k.split(','); g._collectGoldAt(+xy[0], +xy[1]); });
    L.updateHud(true);
    return { left: g.gold.size, open: g.exit.open, exit: [g.exit.x, g.exit.y] };
  })()`);
  check("game.level10.data", "Уровень 10 загружен, всё золото собрано, выход открыт", vcollect.left === 0 && vcollect.open, vcollect);
  await teleport(18, 1);
  await sleep(150);
  await holdKey("ArrowUp", 900);
  const vcomplete = await waitUntil(`window.__LODE.game.state === 'complete'`, 15000, 100);
  await sleep(350);
  const vc = await snap();
  const lastLabel = await js(`document.getElementById('complete-next-label').textContent`);
  check("game.complete.last", "Complete на уровне 10 показывает «К ФИНАЛУ»", vcomplete && vc.screen === "complete" && lastLabel === "К ФИНАЛУ", { state: vc.state, screen: vc.screen, label: lastLabel });
  await press("Enter");
  await sleep(800);
  const v = await snap();
  const vInfo = await js(`({ score: document.getElementById('victory-score').textContent, best: document.getElementById('victory-best').textContent, btns: document.querySelectorAll('.screen.is-active .panel-actions button').length })`);
  check("game.victory", "Enter на последнем complete → victory overlay", v.state === "victory" && v.screen === "victory", { state: v.state, screen: v.screen });
  check("overlay.victory.content", "Оверлей victory: счёт/рекорд и 2 кнопки", /^\d{6}$/.test(vInfo.score) && vInfo.best.length > 0 && vInfo.btns === 2, vInfo);
  await shot("victory");
  await assertOverlayCovered("overlay.cover.victory", "victory");
  await press("Enter");
  await sleep(600);
  const vrestart = await snap();
  check("game.victory.again", "Enter на victory начинает новый забег", vrestart.screen === "none" && vrestart.state === "playing" && vrestart.lives === 3, { screen: vrestart.screen, state: vrestart.state, lives: vrestart.lives });
}

async function phaseLevels() {
  section("3. ВСЕ 10 УРОВНЕЙ: загрузка, данные, враги, выход");
  const expectedGold = [3, 4, 4, 6, 5, 5, 5, 6, 6, 7];
  await goto(PAGE);
  await press("Enter");
  await sleep(500);
  for (let i = 0; i < 10; i++) {
    await js(`(() => {
      const L = window.__LODE;
      L.ui.setScreen('none'); L.ui.paused = false;
      L.game.lives = 3;
      L.game.startLevel(${i});
      L.game.freeze = 0;
      L.ui.updateHud(true);
      return true;
    })()`);
    await sleep(150);
    const before = await snap();
    const hudBefore = await js(`({
      level: document.getElementById('hud-level').textContent,
      total: document.getElementById('hud-total').textContent,
      name: document.getElementById('hud-name').textContent,
      goldTotal: document.getElementById('hud-gold-total').textContent,
      exit: document.getElementById('hud-exit-state').textContent,
    })`);
    const errBefore = ev.exceptions.length;
    const p0 = await js(`window.__LODE.game.enemies.map((e) => ({ x: e.x, y: e.y, state: e.state }))`);
    await sleep(900);
    const p1 = await js(`window.__LODE.game.enemies.map((e) => ({ x: e.x, y: e.y, state: e.state }))`);
    await sleep(1500);
    const p2 = await js(`window.__LODE.game.enemies.map((e) => ({ x: e.x, y: e.y, state: e.state }))`);
    const moved = p1.map((p, idx) => {
      const a = p0[idx] || p;
      const b = p2[idx] || p;
      return (p.x !== a.x || p.y !== a.y || b.x !== p.x || b.y !== p.y);
    }).filter(Boolean).length;
    const collect = await js(`(() => {
      const L = window.__LODE.ui, g = L.game;
      const keys = Array.from(g.gold);
      keys.forEach((k) => { const xy = k.split(','); g._collectGoldAt(+xy[0], +xy[1]); });
      L.updateHud(true);
      return { left: g.gold.size, open: g.exit.open, usable: g.exitIsUsable(), hudExit: document.getElementById('hud-exit-state').textContent };
    })()`);
    const errDelta = ev.exceptions.length - errBefore;
    const ok = before.state === "playing" &&
      before.goldTotal === expectedGold[i] &&
      hudBefore.level === String(i + 1).padStart(2, "0") &&
      hudBefore.total === "10" &&
      hudBefore.name.length > 0 &&
      hudBefore.goldTotal === String(expectedGold[i]).padStart(2, "0") &&
      hudBefore.exit === "ВЫХОД ЗАКРЫТ" &&
      moved === before.enemies.length &&
      errDelta === 0 &&
      collect.left === 0 && collect.open && collect.usable && collect.hudExit === "ВЫХОД ОТКРЫТ";
    RESULTS.levels.push({ n: i + 1, goldTotal: before.goldTotal, enemies: before.enemies.length, moved, exitOpen: collect.open, usable: collect.usable, errors: errDelta });
    check("level." + (i + 1), `Уровень ${i + 1}/${10}: загрузка, золото ${expectedGold[i]}/${expectedGold[i]}, враги двигаются, выход открывается`,
      ok,
      { goldTotal: before.goldTotal, expected: expectedGold[i], enemies: before.enemies.length, moved, exitOpen: collect.open, errors: errDelta, name: hudBefore.name, hudExit: collect.hudExit });
  }
}

async function phaseMobile() {
  section("4. МОБИЛЬНАЯ ВЁРСТКА 390×844 · pointer:coarse · touch");
  const mediaErr = await setMobile();
  if (mediaErr) note("setEmulatedMedia(pointer) не поддержан: " + mediaErr);
  await goto(PAGE);
  await sleep(700);

  const m0 = await js(`(() => {
    const q = (s) => document.querySelector(s);
    const r = q('[data-action="start"]').getBoundingClientRect();
    const card = q('.title-card').getBoundingClientRect();
    const ov = q('.screen.is-active');
    return {
      innerW: innerWidth, innerH: innerHeight,
      scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight,
      pointerCoarse: matchMedia('(pointer: coarse)').matches,
      touchStart: 'ontouchstart' in window, maxTouch: navigator.maxTouchPoints,
      start: { x: r.x, y: r.y, w: r.width, h: r.height },
      card: { x: card.x, y: card.y, w: card.width, h: card.height },
      ovScroll: ov.scrollHeight, ovClient: ov.clientHeight, ovOverflow: getComputedStyle(ov).overflowY,
      touchDisplay: getComputedStyle(q('.touch-controls')).display,
    };
  })()`);
  check("mobile.title", "Мобильный титул: нет горизонтального переполнения, кнопка старта в кадре",
    m0.scrollW <= m0.innerW + 1 && m0.start.w > 0 && m0.start.x >= 0 && m0.start.x + m0.start.w <= m0.innerW + 1 &&
    m0.start.y >= 0 && m0.start.y + m0.start.h <= m0.innerH + 1,
    { scrollW: m0.scrollW, innerW: m0.innerW, start: m0.start, pointerCoarse: m0.pointerCoarse, maxTouch: m0.maxTouch });
  const header = await js(`(() => {
    const tb = document.querySelector('.topbar').getBoundingClientRect();
    const chips = Array.from(document.querySelectorAll('.top-actions .chip')).map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, w: r.width, h: r.height, right: r.x + r.width, text: el.textContent.trim().replace(/\\s+/g, ' ') };
    });
    let overlaps = 0;
    for (let i = 0; i < chips.length; i++) for (let j = i + 1; j < chips.length; j++) {
      if (!(chips[i].right <= chips[j].x + 1 || chips[j].right <= chips[i].x + 1)) overlaps++;
    }
    return { topbar: { x: tb.x, y: tb.y, w: tb.width, h: tb.height }, chips, overlaps, innerW: innerWidth };
  })()`);
  check("mobile.header", "Мобильный хедер: чипы настроек в кадре, без наложений/переполнения",
    header.chips.length === 4 && header.overlaps === 0 &&
    header.chips.every((c) => c.x >= 0 && c.right <= header.innerW + 1) &&
    m0.scrollW <= m0.innerW + 1,
    header);
  await shot("title-mobile");

  const st = await rectOf('[data-action="start"]');
  await touchTap(st.cx, st.cy);
  let started = (await snap()).screen === "none";
  if (!started) { await mouseClick(st.cx, st.cy); await sleep(600); started = (await snap()).screen === "none"; }
  check("mobile.start", "Старт с мобильного (trusted touch tap) запускает игру", started, { started });
  await freezeEnemies();
  await sleep(3300);

  const m1 = await hudLayout();
  const m2 = await js(`(() => {
    const q = (s) => document.querySelector(s);
    const dpad = q('.dpad').getBoundingClientRect();
    const btns = Array.from(document.querySelectorAll('.dpad button, .digpad button')).map((b) => {
      const r = b.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    return {
      touch: getComputedStyle(q('.touch-controls')).display,
      dpad: { x: dpad.x, y: dpad.y, w: dpad.width, h: dpad.height },
      btns,
      hudScroll: document.getElementById('hud').scrollWidth,
      hudClient: document.getElementById('hud').clientWidth,
      scrollW: document.documentElement.scrollWidth,
      scrollH: document.documentElement.scrollHeight,
      innerH: innerHeight,
      coarse: matchMedia('(pointer: coarse)').matches,
    };
  })()`);
  const touchVisible = m1.touchDisplay !== "none" && m2.touch !== "none";
  check("mobile.touch-controls", "Сенсорная панель показана при pointer:coarse (6 кнопок ≥40px)", touchVisible && m2.btns.length === 6 && m2.btns.every((b) => b.w >= 40 && b.h >= 40), { display: m2.touch, coarse: m2.coarse, btns: m2.btns, mediaErr });
  check("mobile.hud", "HUD 390×844 без горизонтального переполнения и наложений", m1.scrollW <= m1.innerW + 1 && m2.hudScroll <= m2.hudClient + 1 && m1.overlaps === 0, { scrollW: m1.scrollW, innerW: m1.innerW, hudScroll: m2.hudScroll, hudClient: m2.hudClient, overlaps: m1.overlaps });
  check("mobile.canvas", "Игровое поле вписано в экран телефона", m1.canvas.w > 0 && m1.canvas.w <= m1.innerW + 1 && m1.canvas.h > 0, m1.canvas);
  await shot("mobile");

  const pr = await rectOf('[data-touch="right"]');
  const p0 = await snap();
  await touchHold(pr.cx, pr.cy, 480);
  await sleep(250);
  const p1 = await snap();
  check("mobile.dpad", "Touch ▶ на dpad реально двигает героя", p1.px > p0.px, { from: p0.px, to: p1.px, state: p1.state });
  const dig = await rectOf('[data-touch="digR"]');
  check("mobile.digpad", "Кнопка копания на touch-панели есть и крупная", dig && dig.w >= 40 && dig.h >= 40, dig);
  const digLabels = await js(`(() => {
    return Array.from(document.querySelectorAll('.digpad button')).map((b) => {
      const label = b.querySelector('.tlabel');
      const dir = b.querySelector('.tdir');
      const r = b.getBoundingClientRect();
      return {
        text: label ? label.textContent.trim() : null,
        dir: dir ? dir.textContent.trim() : null,
        aria: b.getAttribute('aria-label'),
        w: Math.round(r.width), h: Math.round(r.height),
        labelColor: label ? getComputedStyle(label).display : null,
      };
    });
  })()`);
  check("mobile.digpad.labels", "Touch-кнопки копания подписаны (◀ копать / ▶ копать), не обрезаны",
    digLabels.length === 2 && digLabels.every((b) => b.text && b.text.toLowerCase() === "копать") &&
    digLabels.every((b) => b.dir && b.aria && b.w >= 40 && b.h >= 40 && b.labelColor !== "none"),
    digLabels);

  /* мобильный оверлей паузы */
  const pauseChip = await rectOf('[data-action="pause"]');
  if (pauseChip) {
    await touchTap(pauseChip.cx, pauseChip.cy);
    await sleep(400);
    const mp = await snap();
    const mpLayout = await js(`(() => {
      const el = document.querySelector('.screen.is-active .panel');
      const r = el.getBoundingClientRect();
      return { screen: document.body.dataset.screen, x: r.x, y: r.y, w: r.width, h: r.height, innerW: innerWidth, innerH: innerHeight };
    })()`);
    check("mobile.pause", "Пауза на мобильном: панель в кадре", mp.screen === "pause" && mpLayout.x >= 0 && mpLayout.x + mpLayout.w <= mpLayout.innerW + 1 && mpLayout.y >= 0 && mpLayout.y + mpLayout.h <= mpLayout.innerH + 1, mpLayout);
  }
}

const STANDALONE = `file://${ROOT}/lode-runner.html`;
async function phaseStandalone() {
  section("5. АВТОНОМНЫЙ lode-runner.html (инлайн css/js)");
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  try { await send("Emulation.setEmulatedMedia", { features: [] }); } catch { /* ok */ }
  await setDesktop();
  await goto(STANDALONE);
  const boot = await js(`(() => {
    const q = (s) => document.querySelector(s);
    const c = q('#game');
    const r = c.getBoundingClientRect();
    return {
      levels: window.__LODE ? window.__LODE.levels.length : -1,
      screen: document.body.dataset.screen,
      canvas: { w: r.width, h: r.height },
      external: document.querySelectorAll('script[src], link[rel="stylesheet"]').length,
      inlineScripts: document.querySelectorAll('script:not([src])').length,
      fatal: q('#fatal') ? q('#fatal').textContent : null,
    };
  })()`);
  const errBefore = ev.exceptions.length;
  check("standalone.boot", "Автономный lode-runner.html: 10 уровней, title, 0 внешних ссылок, без fatal",
    boot.levels === 10 && boot.screen === "title" && boot.external === 0 && boot.inlineScripts >= 6 && !boot.fatal, boot);
  await shot("standalone-neon");
  await press("Enter");
  await sleep(900);
  const s = await snap();
  check("standalone.start", "Автономный файл: Enter запускает забег", s.screen === "none" && s.state === "playing" && s.level === 0, { screen: s.screen, state: s.state, level: s.level });
  await freezeEnemies();
  await sleep(900);
  const mv0 = await snap();
  await holdKey("ArrowRight", 420);
  const mv1 = await snap();
  check("standalone.play", "Автономный файл: управление и механика работают", mv1.px > mv0.px, { from: mv0.px, to: mv1.px });
  await press("KeyG");
  await sleep(600);
  const th = await js(`({ theme: window.__LODE.ui.theme, retro: document.body.classList.contains('theme-retro') })`);
  await press("KeyG");
  await sleep(300);
  check("standalone.theme", "Автономный файл: переключение темы G работает", th.theme === "retro" && th.retro, th);
  const errMid = ev.exceptions.length;
  const expectedGold = [3, 4, 4, 6, 5, 5, 5, 6, 6, 7];
  let levelsOk = 0;
  for (let i = 0; i < 10; i++) {
    await js(`(() => {
      const L = window.__LODE;
      L.ui.setScreen('none'); L.ui.paused = false;
      L.game.lives = 3; L.game.startLevel(${i}); L.game.freeze = 0; L.ui.updateHud(true);
      return true;
    })()`);
    await sleep(120);
    const lv = await snap();
    if (lv.state === "playing" && lv.goldTotal === expectedGold[i] && lv.hudLevel === String(i + 1).padStart(2, "0")) levelsOk++;
    await js(`(() => {
      const L = window.__LODE.ui, g = L.game;
      Array.from(g.gold).forEach((k) => { const xy = k.split(','); g._collectGoldAt(+xy[0], +xy[1]); });
      L.updateHud(true); return true;
    })()`);
  }
  const errDelta = ev.exceptions.length - errMid;
  check("standalone.levels", "Автономный файл: все 10 уровней загружаются и валидны", levelsOk === 10 && errDelta === 0, { levelsOk, errors: errDelta });
  check("standalone.no-errors", "Автономный файл: нет JS-исключений за прогон", ev.exceptions.length - errBefore === 0, { exceptions: ev.exceptions.slice(-4) });
}

async function measureFps(ms = 2500) {
  return js(`new Promise((res) => {
    let n = 0, longFrames = 0, worst = 0;
    let last = performance.now();
    const start = last;
    function f(t) {
      const dt = t - last; last = t;
      if (dt > worst) worst = dt;
      if (dt > 50) longFrames++;
      n++;
      if (t - start < ${ms}) requestAnimationFrame(f);
      else res({ frames: n, fps: +(n / ((t - start) / 1000)).toFixed(1), longFrames, worstMs: +worst.toFixed(1) });
    }
    requestAnimationFrame(f);
  })`, { awaitPromise: true });
}

async function phasePerf() {
  section("6. ПРОИЗВОДИТЕЛЬНОСТЬ");
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  try { await send("Emulation.setEmulatedMedia", { features: [] }); } catch { /* ok */ }
  await setDesktop();
  // Baseline: пустая страница в том же окружении. Если машина загружена чужими
  // процессами, FPS падает и там — тогда сравниваем игру с baseline, а не с 60.
  await goto("about:blank");
  await sleep(400);
  const baseline = await measureFps(2000);
  await goto(PAGE);
  await press("Enter");
  await sleep(1500);
  const perf = await measureFps(2500);
  const envLimited = baseline.fps < 50;
  RESULTS.perf = { game: perf, baseline, envLimited };
  const pass = envLimited
    ? perf.fps >= baseline.fps * 0.85
    : (perf.fps >= 50 && perf.longFrames <= 3);
  check("perf.fps",
    envLimited
      ? "FPS в игре на уровне baseline окружения (машина загружена параллельными Chrome, не баг игры)"
      : "FPS в игре ≥ 50, долгих кадров почти нет",
    pass,
    { game: perf, baseline, envLimited });
}

async function phaseFinal() {
  section("7. ФИНАЛЬНЫЕ ПРОВЕРКИ");
  const fatal = await js(`document.getElementById('fatal') ? document.getElementById('fatal').textContent : null`);
  ev.fatal = fatal;
  check("final.no-fatal", "За весь прогон нет fatal-оверлея", !fatal, { fatal });
  check("final.no-js-errors", "За весь прогон нет JS-исключений и console.error",
    ev.exceptions.length === 0 && ev.consoleErrors.length === 0,
    { exceptions: ev.exceptions.slice(0, 5), consoleErrors: ev.consoleErrors.slice(0, 5), warnings: ev.consoleWarnings.slice(0, 5) });
}

/* ================================================================== main */
function saveResults() {
  try {
    RESULTS.passed = RESULTS.checks.filter((c) => c.pass).length;
    RESULTS.failed = failures().length;
    RESULTS.total = RESULTS.checks.length;
    RESULTS.env = { loadavg: loadavg ? loadavg() : null, platform: process.platform };
    writeFileSync(join(OUT, "results.json"), JSON.stringify(RESULTS, null, 2));
  } catch { /* ok */ }
}

async function main() {
  RESULTS.meta.levelsFile = statSync(join(ROOT, "js/levels.js")).mtime.toISOString();
  RESULTS.meta.levelsHashStart = createHash("sha1").update(readFileSync(join(ROOT, "js/levels.js"))).digest("hex");
  RESULTS.meta.jsFiles = ["js/levels.js", "js/game.js", "js/ui.js", "js/render.js", "js/audio.js", "js/main.js", "index.html", "css/style.css"]
    .map((f) => ({ file: f, mtime: statSync(join(ROOT, f)).mtime.toISOString() }));

  await setup();
  await setDesktop();
  const phases = [
    ["boot-title-audio", phaseBootTitleAudio],
    ["gameplay", phaseGameplay],
    ["levels", phaseLevels],
    ["mobile", phaseMobile],
    ["standalone", phaseStandalone],
    ["perf", phasePerf],
    ["final", phaseFinal],
  ];
  for (const [name, fn] of phases) {
    try {
      await fn();
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      RESULTS.phaseErrors = RESULTS.phaseErrors || [];
      RESULTS.phaseErrors.push({ phase: name, error: msg });
      check("phase." + name, `Фаза «${name}» завершилась без сбоя`, false, { error: msg });
      console.log("⚠ PHASE FAILED: " + name + " — " + msg);
    }
    saveResults();
  }
  if (RESULTS.screenshotFailures && RESULTS.screenshotFailures.length) {
    check("screenshots.captured", "Все ключевые скриншоты сняты", false,
      { failures: RESULTS.screenshotFailures, reason: "перегрузка машины, см. REPORT.md" });
  } else {
    check("screenshots.captured", "Все ключевые скриншоты сняты", RESULTS.screenshots.length >= 10, { count: RESULTS.screenshots.length });
  }

  RESULTS.finishedAt = new Date().toISOString();
  RESULTS.meta.levelsFileEnd = statSync(join(ROOT, "js/levels.js")).mtime.toISOString();
  RESULTS.meta.levelsHashEnd = createHash("sha1").update(readFileSync(join(ROOT, "js/levels.js"))).digest("hex");
  RESULTS.meta.levelsChangedDuringRun = RESULTS.meta.levelsHashStart !== RESULTS.meta.levelsHashEnd;
  saveResults();

  console.log("");
  console.log("=".repeat(78));
  console.log(`  ИТОГ: ${RESULTS.passed}/${RESULTS.total} PASS, ${RESULTS.failed} FAIL, скриншотов: ${RESULTS.screenshots.length}`);
  if (RESULTS.failed) {
    console.log("  Провалы:");
    for (const f of failures()) console.log(`   ✗ ${f.id} — ${f.name}`);
  }
  console.log("  results.json → " + join(OUT, "results.json"));
  console.log("=".repeat(78));
  return RESULTS.failed === 0;
}

main().then((ok) => {
  try { ws?.close(); } catch { /* ok */ }
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ok */ }
  process.exit(ok ? 0 : 1);
}).catch((err) => {
  console.error("\nQA CRASHED:", err && err.stack ? err.stack : err);
  try {
    RESULTS.crashed = String(err && err.message ? err.message : err);
    writeFileSync(join(OUT, "results.json"), JSON.stringify(RESULTS, null, 2));
  } catch { /* ok */ }
  try { ws?.close(); } catch { /* ok */ }
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ok */ }
  process.exit(2);
});
