/**
 * QA-харнесс на CDP (не трогает продакшн-код).
 * Умеет: открыть file:// страницу, eval, скриншоты, собрать console/exception/log/network.
 * Использование:
 *   const qa = await openQa({ page: 'index.html', width: 1440, height: 900 });
 *   await qa.navigate('index.html?mode=retro');
 *   await qa.eval('...'); await qa.shot('tmp/qa/x.png');
 *   qa.report(); await qa.close();
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => { try { return !!readFileSync(p); } catch { return false; } });

export async function openQa(opts = {}) {
  const ROOT = resolve(opts.root || process.cwd());
  const width = opts.width || 1440;
  const height = opts.height || 900;
  const PORT = 9400 + ((process.pid + Date.now()) % 3000);
  const profile = mkdtempSync(join(tmpdir(), "saga2-qa-"));
  const chrome = spawn(CHROME || "google-chrome", [
    "--headless=new",
    ...(opts.gpu ? [] : ["--disable-gpu"]),
    "--no-sandbox",
    "--disable-crashpad",
    "--disable-breakpad",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
    "--allow-file-access-from-files",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: "ignore" });

  let ws, seq = 0;
  const pending = new Map();
  const state = {
    console: [], errors: [], logs: [], requests: [], failed: [], responses: [],
  };

  function send(method, params = {}) {
    const id = ++seq;
    return new Promise((res, rej) => {
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (pending.has(id)) { pending.delete(id); rej(new Error("CDP timeout: " + method)); }
      }, 60000);
    });
  }

  // ждём DevTools
  let tab = null;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
      if (r.ok) { tab = await r.json(); break; }
    } catch { /* стартует */ }
    await sleep(200);
  }
  if (!tab) throw new Error("Chrome DevTools не отвечает");

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
    const m = msg.method, p = msg.params || {};
    if (m === "Runtime.consoleAPICalled") {
      const text = (p.args || []).map((a) => a.value ?? a.description ?? a.type).join(" ");
      state.console.push({ type: p.type, text });
    } else if (m === "Runtime.exceptionThrown") {
      const d = p.exceptionDetails || {};
      state.errors.push(d.exception?.description || d.text || "exception");
    } else if (m === "Log.entryAdded") {
      const e = p.entry || {};
      state.logs.push({ level: e.level, text: e.text, source: e.source, url: e.url });
      if (e.level === "error") state.errors.push("[log] " + e.text + (e.url ? " @ " + e.url : ""));
    } else if (m === "Network.requestWillBeSent") {
      state.requests.push({ url: p.request.url, type: p.type, method: p.request.method });
    } else if (m === "Network.loadingFailed") {
      state.failed.push({ url: p.documentURL || "", error: p.errorText, type: p.type });
    } else if (m === "Network.responseReceived") {
      state.responses.push({ url: p.response.url, status: p.response.status, mime: p.response.mimeType });
    }
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: opts.dpr || 1, mobile: !!opts.mobile,
  });

  async function navigate(path, waitMs = 700) {
    const loaded = new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("load timeout")), 30000);
      const handler = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.method === "Page.loadEventFired") {
          clearTimeout(t); ws.removeEventListener("message", handler); res();
        }
      };
      ws.addEventListener("message", handler);
    });
    const url = /^(file|https?):/.test(path) ? path : "file://" + resolve(ROOT, path);
    await send("Page.navigate", { url });
    await loaded;
    await sleep(waitMs);
    return url;
  }

  async function evaluate(code, args = {}) {
    const wrapped = `(async (args) => { const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const key = async (code, ms) => {
        const fire = (type) => window.dispatchEvent(new KeyboardEvent(type, { code: code, key: code, bubbles: true }));
        fire('keydown'); await sleep(ms || 90); fire('keyup');
      };
      ${code}
    })(${JSON.stringify(args)})`;
    const r = await send("Runtime.evaluate", {
      expression: wrapped,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (r.exceptionDetails) {
      const txt = r.exceptionDetails.exception?.description || r.exceptionDetails.text;
      state.errors.push("eval: " + txt);
      return { __evalError: txt };
    }
    return r.result.value;
  }

  async function shot(out, settle = 220) {
    await sleep(settle);
    const r = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
    const p = resolve(ROOT, out);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, Buffer.from(r.data, "base64"));
    return out;
  }

  async function close() {
    try { ws?.close(); } catch { /* noop */ }
    chrome.kill("SIGKILL");
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* noop */ }
  }

  function clearLogs() {
    state.console.length = 0; state.errors.length = 0; state.logs.length = 0;
    state.requests.length = 0; state.failed.length = 0; state.responses.length = 0;
  }

  return { send, navigate, eval: evaluate, shot, close, state, clearLogs, opts: { width, height, ROOT } };
}

/* вспомогательное: клик по кнопке с заданным текстом/селектором */
export const helpers = {
  clickText: (txt) => `
    const all = Array.from(document.querySelectorAll('button'));
    const el = all.find(b => (b.textContent || '').replace(/\\s+/g,' ').trim().includes(${JSON.stringify(txt)}));
    if (!el) return { clicked: false, buttons: all.map(b => (b.textContent||'').trim()).slice(0, 20) };
    el.click(); await sleep(350);
    return { clicked: true, screen: document.body.dataset.screen };`,
  clickSel: (sel) => `
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return { clicked: false };
    el.click(); await sleep(350);
    return { clicked: true, screen: document.body.dataset.screen };`,
  screen: "({ screen: document.body.dataset.screen, mode: document.body.dataset.mode, lang: document.documentElement.lang })",
};
