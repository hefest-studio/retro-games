#!/usr/bin/env node
/**
 * Мини-харнесс на Chrome DevTools Protocol: загружает страницу, выполняет JS,
 * делает скриншот, печатает console/exception. Без npm-зависимостей.
 *
 * Использование:
 *   node tools/cdp.mjs eval --page legacy.html --script tools/probe.js [--wait 600] [--settle 400]
 *   node tools/cdp.mjs shot --page legacy.html --out screenshots/x.png [--width 1280 --height 900]
 *   node tools/cdp.mjs eval ... --shot screenshots/x.png
 *
 * Скрипт выполняется как `(async (args) => { <код скрипта> })(<args>)`;
 * результат возвращается через return/последнее выражение и печатается JSON-ом.
 * Окружение скрипта: `args` (объект из --args), `sleep(ms)`.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

/* ---------- аргументы ---------- */
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      out[key] = val;
    } else out._.push(a);
  }
  return out;
}
const A = parseArgs(process.argv.slice(2));
const cmd = A._[0] || "shot";
const ROOT = resolve(process.cwd());

function fileUrl(p) {
  if (/^(file|https?):/.test(p)) return p;
  return "file://" + resolve(ROOT, p);
}

function findChrome() {
  for (const c of CHROME_CANDIDATES) {
    try { readFileSync(c); return c; } catch { /* продолжаем */ }
  }
  throw new Error("Chrome не найден");
}

/* ---------- соединение ---------- */
const profile = mkdtempSync(join(tmpdir(), "rr-chrome-"));
let PORT = 0;
const chrome = spawn(findChrome(), [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--disable-crashpad",
  "--disable-breakpad",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--mute-audio",
  "--autoplay-policy=no-user-gesture-required",
  "--allow-file-access-from-files",
  `--remote-debugging-port=0`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore" });

let ws;
let seq = 0;
const pending = new Map();
const logs = [];
const errors = [];

function send(method, params = {}) {
  const id = ++seq;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); rej(new Error("CDP timeout: " + method)); }
    }, 30000);
  });
}

async function connect() {
  // Chrome сам выбирает свободный порт и пишет его в DevToolsActivePort профиля.
  for (let i = 0; i < 120; i++) {
    try {
      const portFile = join(profile, "DevToolsActivePort");
      if (existsSync(portFile)) {
        const port = Number(readFileSync(portFile, "utf8").split("\n")[0]);
        if (port > 0) {
          PORT = port;
          const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
          if (r.ok) return await r.json();
        }
      }
    } catch { /* ещё стартует */ }
    await sleep(150);
  }
  throw new Error("Chrome DevTools не отвечает");
}

async function open() {
  const tab = await connect();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      return;
    }
    if (msg.method === "Runtime.consoleAPICalled") {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(" ");
      logs.push(`[${msg.params.type}] ${text}`);
    } else if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      errors.push(d.exception?.description || d.text);
    } else if (msg.method === "Log.entryAdded") {
      logs.push(`[log:${msg.params.entry.level}] ${msg.params.entry.text}`);
    }
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  const w = Number(A.width || 1280), h = Number(A.height || 900);
  await send("Emulation.setDeviceMetricsOverride", {
    width: w, height: h, deviceScaleFactor: Number(A.dpr || 1), mobile: false,
  });
}

async function navigate(url) {
  const loaded = new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("load timeout")), 25000);
    const handler = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === "Page.loadEventFired") {
        clearTimeout(t); ws.removeEventListener("message", handler); res();
      }
    };
    ws.addEventListener("message", handler);
  });
  await send("Page.navigate", { url });
  await loaded;
  await sleep(Number(A.wait || 500));
}

async function evaluate(code, args = {}) {
  const wrapped = `(async (args) => { const sleep = (ms) => new Promise(r => setTimeout(r, ms));\n${code}\n})(${JSON.stringify(args)})`;
  const r = await send("Runtime.evaluate", {
    expression: wrapped,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (r.exceptionDetails) {
    errors.push(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return undefined;
  }
  return r.result.value;
}

async function screenshot(out) {
  await send("Page.bringToFront");
  const r = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const path = resolve(ROOT, out);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(r.data, "base64"));
  console.log("🖼  " + out);
}

/* ---------- main ---------- */
try {
  await open();
  const page = fileUrl(A.page || "legacy.html"); // v2: старый интерфейс — legacy.html
  await navigate(page);

  if (A.scenes) {
    const scenes = JSON.parse(readFileSync(resolve(ROOT, A.scenes), "utf8"));
    for (const sc of scenes) {
      if (sc.width || sc.height || sc.dpr || sc.mobile) {
        await send("Emulation.setDeviceMetricsOverride", {
          width: Number(sc.width || A.width || 1280),
          height: Number(sc.height || A.height || 900),
          deviceScaleFactor: Number(sc.dpr || 1),
          mobile: !!sc.mobile,
        });
        await send("Emulation.setTouchEmulationEnabled", { enabled: !!sc.mobile, maxTouchPoints: sc.mobile ? 5 : 1 });
        await sleep(250);
      }
      if (sc.reload) await navigate(page);
      if (sc.js) {
        const r = await evaluate(sc.js.replace(/\bSCENE\b/g, JSON.stringify(sc.args || {})));
        if (r !== undefined) console.log(`  ${sc.shot}: ${JSON.stringify(r).slice(0, 400)}`);
      }
      await sleep(Number(sc.settle || 220));
      await screenshot(sc.shot);
    }
  } else if (A.script) {
    const code = readFileSync(resolve(ROOT, A.script), "utf8");
    const result = await evaluate(code, A.args ? JSON.parse(A.args) : {});
    console.log("— JS result —");
    console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
  } else if (cmd === "eval" && A.code) {
    const result = await evaluate(A.code);
    console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
  }

  if (A.shot) {
    await sleep(Number(A.settle || 250));
    await screenshot(A.shot);
  }

  if (logs.length) {
    console.log("— console —");
    for (const l of logs.slice(-40)) console.log("  " + l);
  }
  if (errors.length) {
    console.log("— JS ERRORS (" + errors.length + ") —");
    for (const e of errors.slice(0, 20)) console.log("  ✖ " + e.split("\n").slice(0, 4).join("\n    "));
    process.exitCode = 1;
  }
  console.log(errors.length ? "❌ есть ошибки" : "✅ чисто");
} catch (e) {
  console.error("✖ harness:", e.message);
  process.exitCode = 2;
} finally {
  try { ws?.close(); } catch { /* noop */ }
  chrome.kill("SIGKILL");
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* noop */ }
}
