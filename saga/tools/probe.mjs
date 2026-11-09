#!/usr/bin/env node
/**
 * Headless-проверка страницы через Chrome DevTools Protocol:
 * скриншот + ошибки консоли/исключения + необязательный JS-eval.
 *
 *   node lost-vikings/tools/probe.mjs <file.html|http://url> out.png \
 *        [--w=1280] [--h=800] [--wait=900] [--eval='EX.state.mode'] [--keys=Enter,Space] [--mobile=1]
 *
 * --eval печатает результат (JSON или строку). --keys отправляет нажатия
 * (по одному keydown/keyup c паузой --keydelay мс, по умолчанию 120).
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const opt = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const url = positional[0];
const outPath = resolve(positional[1] || "lost-vikings/tmp/probe.png");
if (!url) {
  console.error("usage: node probe.mjs <url|file> <out.png> [--w=1280] [--h=800] [--wait=900] [--eval='js'] [--keys=Enter,Space]");
  process.exit(2);
}
const width = +(opt("w", 1280));
const height = +(opt("h", 800));
const wait = +(opt("wait", 900));
const evalExpr = opt("eval", "");
const keys = opt("keys", "").split(",").filter(Boolean);
const keyDelay = +(opt("keydelay", 130));
const mobile = opt("mobile", "") === "1";
const pageUrl = /^https?:|^file:/.test(url) ? url : `file://${resolve(url)}`;

mkdirSync(dirname(outPath), { recursive: true });
const port = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), "dsh-probe-"));

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--disable-crashpad",
  "--disable-breakpad",
  "--hide-scrollbars",
  "--no-first-run",
  "--mute-audio",
  "--autoplay-policy=no-user-gesture-required",
  "--allow-file-access-from-files",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore" });

const errors = [];
let ws;
let seq = 0;
const pending = new Map();
const listeners = new Map();

function send(method, params = {}) {
  const id = ++seq;
  return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
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
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
      if (r.ok) return await r.json();
    } catch { /* ещё поднимается */ }
    await sleep(150);
  }
  throw new Error("Chrome DevTools не отвечает");
}

try {
  const tab = await connect();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      return;
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      errors.push("exception: " + (d.exception?.description || d.text));
    }
    if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
      errors.push("console." + msg.params.type + ": " + msg.params.args.map((a) => a.value ?? a.description).join(" "));
    }
    if (msg.method === "Log.entryAdded" && ["error", "warning"].includes(msg.params.entry.level)) {
      errors.push("log." + msg.params.entry.level + ": " + msg.params.entry.text);
    }
    const arr = listeners.get(msg.method);
    if (arr) { listeners.delete(msg.method); arr.forEach((fn) => fn(msg.params)); }
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: mobile });
  if (mobile) {
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await send("Emulation.setEmitTouchEventsForMouse", { enabled: true, configuration: "mobile" });
  }

  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: pageUrl });
  await loaded;
  await sleep(wait);

  const press = async (key) => {
    const vk = { Enter: 13, Space: 32, Escape: 27, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 }[key] || key.toUpperCase().charCodeAt(0);
    const code = key === "Space" ? "Space" : key;
    await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    await sleep(60);
    await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    await sleep(keyDelay);
  };
  for (const k of keys) await press(k);

  if (evalExpr) {
    const r = await send("Runtime.evaluate", { expression: evalExpr, returnByValue: true, awaitPromise: true });
    const v = r.result?.value;
    console.log("eval:", typeof v === "object" ? JSON.stringify(v) : v, r.exceptionDetails ? "⚠ " + r.exceptionDetails.text : "");
  }

  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(outPath, Buffer.from(shot.data, "base64"));

  const title = await send("Runtime.evaluate", { expression: "document.title", returnByValue: true });
  console.log(`→ ${outPath}  (${width}×${height})  title="${title.result.value}"`);
  if (errors.length) {
    console.log("⚠ ОШИБКИ (" + errors.length + "):");
    for (const e of errors.slice(0, 12)) console.log("   " + e);
    process.exitCode = 3;
  } else {
    console.log("✓ ошибок в консоли нет");
  }
} catch (err) {
  console.error("✗", err.message);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch {}
  chrome.kill("SIGKILL");
}
