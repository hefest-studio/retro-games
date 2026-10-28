#!/usr/bin/env node
/**
 * lib.mjs — минимальный CDP-клиент для QA-проверок каталога и игр.
 *
 * Зачем свой клиент, а не tools/shot.mjs: для интерактивных проверок нужны
 * переключение темы, клики/ввод, эмуляция media-фич, сетевые журналы и
 * последовательная навигация по множеству URL в одной вкладке.
 *
 * Требования: Node 26+ (глобальный WebSocket/ fetch), Google Chrome.
 * Профиль браузера складывается во временный каталог TMPDIR, не в воркспейс.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

export function findChrome() {
  const hit = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!hit) throw new Error('Chrome не найден. Задайте CHROME_BIN.');
  return hit;
}

export function parseArgs(argv, defaults = {}) {
  const out = { ...defaults };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`Неожиданный аргумент: ${arg}`);
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (key === 'help' || key === 'skipProd') {
      out[key] = true;
      continue;
    }
    const next = argv[++i];
    if (next === undefined) throw new Error(`Нет значения для ${arg}`);
    if (!(key in out) || ['width', 'height', 'wait', 'timeout', 'port', 'scale'].includes(key)) {
      out[key] = /^-?\d+(\.\d+)?$/.test(next) ? Number(next) : next;
    } else {
      out[key] = next;
    }
  }
  return out;
}

/** Ждём, пока Chrome откроет отладочный порт. */
async function waitForDevtools(port, deadline) {
  const url = `http://127.0.0.1:${port}/json/version`;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return response.json();
    } catch {
      /* Chrome ещё поднимается */
    }
    await sleep(120);
  }
  throw new Error('Chrome не открыл отладочный порт');
}

async function openTarget(port, pageUrl, deadline) {
  const endpoint = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(pageUrl)}`;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(endpoint, { method: 'PUT', signal: AbortSignal.timeout(2000) });
      if (response.ok) return response.json();
    } catch {
      /* порт ещё не готов */
    }
    await sleep(120);
  }
  throw new Error('Не удалось создать вкладку');
}

/** Минимальный CDP-клиент поверх встроенного в Node WebSocket. */
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  const ready = new Promise((resolvePromise, reject) => {
    ws.addEventListener('open', () => resolvePromise());
    ws.addEventListener('error', (event) => reject(new Error(`WebSocket: ${event.message || 'ошибка'}`)));
  });
  ws.addEventListener('message', (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.id && pending.has(message.id)) {
      const { resolve: res, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else res(message.result);
      return;
    }
    for (const listener of [...listeners]) listener(message);
  });
  return {
    ready,
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((res, reject) => {
        pending.set(id, { resolve: res, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      try {
        ws.close();
      } catch {
        /* уже закрыт */
      }
    },
  };
}

/** Сессия «браузер + вкладка + сбор диагностики». */
export class Session {
  constructor(cdp, child, port, targetId) {
    this.cdp = cdp;
    this.child = child;
    this.port = port;
    this.targetId = targetId;
    this.consoleErrors = [];
    this.consoleWarnings = [];
    this.pageErrors = [];
    this.logErrors = [];
    this.requests = new Map();
    this.responses = [];
    this.failedRequests = [];
    this._listeners = new Set();
  }

  async start({ width = 1440, height = 900, mobile = false, scale = 1 } = {}) {
    this.cdp.on((message) => {
      const { method, params } = message;
      switch (method) {
        case 'Runtime.consoleAPICalled': {
          const text = params.args
            .map((a) => (a.value !== undefined ? String(a.value) : (a.description ?? a.type)))
            .join(' ');
          if (params.type === 'error') this.consoleErrors.push(text);
          else if (params.type === 'warning') this.consoleWarnings.push(text);
          break;
        }
        case 'Runtime.exceptionThrown': {
          const d = params.exceptionDetails;
          this.pageErrors.push(d.exception?.description || d.text || 'unknown exception');
          break;
        }
        case 'Log.entryAdded': {
          const e = params.entry;
          if (e.level === 'error') this.logErrors.push(`${e.source}: ${e.text} ${e.url || ''}`.trim());
          break;
        }
        case 'Network.requestWillBeSent':
          this.requests.set(params.requestId, {
            url: params.request.url,
            type: params.type,
            method: params.request.method,
          });
          break;
        case 'Network.responseReceived':
          this.responses.push({
            url: params.response.url,
            status: params.response.status,
            mimeType: params.response.mimeType,
            type: params.type,
            requestId: params.requestId,
          });
          break;
        case 'Network.loadingFailed': {
          const req = this.requests.get(params.requestId);
          this.failedRequests.push({
            url: req?.url || params.requestId,
            errorText: params.errorText,
            blockedReason: params.blockedReason || null,
          });
          break;
        }
        default:
          break;
      }
      for (const listener of [...this._listeners]) listener(message);
    });

    await this.cdp.send('Page.enable');
    await this.cdp.send('Runtime.enable');
    await this.cdp.send('Network.enable');
    await this.cdp.send('Log.enable');
    await this.setViewport({ width, height, mobile, scale });
    return this;
  }

  resetDiagnostics() {
    this.consoleErrors = [];
    this.consoleWarnings = [];
    this.pageErrors = [];
    this.logErrors = [];
    this.requests = new Map();
    this.responses = [];
    this.failedRequests = [];
  }

  on(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  waitEvent(method, timeout = 15000, predicate = () => true) {
    return new Promise((resolvePromise) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          off();
          resolvePromise(null);
        }
      }, timeout);
      const off = this.on((message) => {
        if (done || message.method !== method) return;
        if (!predicate(message.params)) return;
        done = true;
        clearTimeout(timer);
        off();
        resolvePromise(message.params);
      });
    });
  }

  async setViewport({ width, height, mobile = width < 700, scale = 1 }) {
    this.viewport = { width, height, mobile };
    await this.cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: scale,
      mobile,
    });
  }

  async setEmulatedMedia(features) {
    const mediaFeatures = Object.entries(features).map(([name, value]) => ({ name, value }));
    await this.cdp.send('Emulation.setEmulatedMedia', {
      features: mediaFeatures,
      media: '',
    });
  }

  async evaluate(expression, { awaitPromise = true, timeout = 15000 } = {}) {
    const result = await this.cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
      timeout,
    });
    if (result.exceptionDetails) {
      const details = result.exceptionDetails;
      throw new Error(details.exception?.description || details.text || 'eval failed');
    }
    return result.result?.value;
  }

  /** Навигация с ожиданием load + стабилизации. */
  async goto(url, { wait = 1500, timeout = 20000 } = {}) {
    this.resetDiagnostics();
    this.navigationUrl = url;
    this.navStart = Date.now();
    const loaded = this.waitEvent('Page.loadEventFired', timeout);
    await this.cdp.send('Page.navigate', { url });
    await loaded;
    // ждём readyState=complete (на случай late-скриптов)
    const deadline = Date.now() + Math.max(3000, timeout - (Date.now() - this.navStart));
    let state = '';
    while (Date.now() < deadline) {
      try {
        state = await this.evaluate('document.readyState', { awaitPromise: false, timeout: 2000 });
      } catch {
        state = '';
      }
      if (state === 'complete') break;
      await sleep(100);
    }
    await sleep(wait);
    return { state, elapsedMs: Date.now() - this.navStart };
  }

  async screenshot(outPath, { fullPage = false } = {}) {
    let clip;
    if (fullPage) {
      const metrics = await this.cdp.send('Page.getLayoutMetrics');
      const content = metrics.cssContentSize || metrics.contentSize;
      clip = { x: 0, y: 0, width: content.width, height: content.height, scale: 1 };
    }
    const shot = await this.cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: fullPage,
      ...(clip ? { clip } : {}),
    });
    mkdirSync(dirname(resolve(outPath)), { recursive: true });
    writeFileSync(resolve(outPath), Buffer.from(shot.data, 'base64'));
    return resolve(outPath);
  }

  async pressKey(key, { code, text, modifiers = 0 } = {}) {
    let keyCode = key;
    let virtualKey = key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0;
    if (key === 'Enter') virtualKey = 13;
    if (key === 'Tab') virtualKey = 9;
    if (key === 'Escape') virtualKey = 27;
    if (key === ' ') virtualKey = 32;
    if (key === 'ArrowLeft') virtualKey = 37;
    if (key === 'ArrowUp') virtualKey = 38;
    if (key === 'ArrowRight') virtualKey = 39;
    if (key === 'ArrowDown') virtualKey = 40;
    const codeName = code || (key.length === 1 ? `Key${key.toUpperCase()}` : key);
    for (const type of ['keyDown', 'keyUp']) {
      const eventText = text
        ?? (key === 'Enter' ? '\r' : key === ' ' ? ' ' : key.length === 1 ? key : undefined);
      await this.cdp.send('Input.dispatchKeyEvent', {
        type,
        key: key === ' ' ? ' ' : keyCode,
        code: codeName,
        windowsVirtualKeyCode: virtualKey,
        nativeVirtualKeyCode: virtualKey,
        modifiers,
        unmodifiedText: type === 'keyDown' ? eventText : undefined,
        text: type === 'keyDown' ? eventText : undefined,
      });
    }
  }

  async click(selector) {
    const rect = await this.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
    })()`);
    if (!rect || rect.w === 0) throw new Error(`Не найден/не виден элемент: ${selector}`);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await this.cdp.send('Input.dispatchMouseEvent', {
        type,
        x: rect.x,
        y: rect.y,
        button: 'left',
        clickCount: 1,
      });
    }
  }

  async typeText(text) {
    for (const ch of text) {
      await this.cdp.send('Input.dispatchKeyEvent', { type: 'char', text: ch });
    }
  }

  /** Найти и сфокусировать элемент, вернуть активный элемент после Tab-нажатий. */
  async focusInfo() {
    return this.evaluate(`(() => {
      const el = document.activeElement;
      if (!el) return null;
      return {
        tag: el.tagName,
        text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 120),
        href: el.getAttribute('href') || '',
        role: el.getAttribute('role') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        id: el.id || '',
        className: String(el.className || '').slice(0, 120),
      };
    })()`);
  }

  async close() {
    try {
      this.cdp.close();
    } catch {
      /* ok */
    }
    if (this.targetId) {
      try {
        await fetch(`http://127.0.0.1:${this.port}/json/close/${this.targetId}`);
      } catch {
        /* окно уже закрыто */
      }
    }
    try {
      this.child.kill('SIGKILL');
    } catch {
      /* ok */
    }
  }
}

/** Запуск headless Chrome и открытие вкладки. */
export async function launch({ width = 1440, height = 900, mobile = false, timeout = 30000 } = {}) {
  const chrome = findChrome();
  const port = 9400 + Math.floor(Math.random() * 500);
  const profile = resolve(process.env.TMPDIR || '/tmp', `qa-chrome-${process.pid}-${Math.floor(Math.random() * 1e6)}`);
  try {
    mkdirSync(profile, { recursive: true });
  } catch {
    /* профиль может уже существовать */
  }
  const child = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-breakpad',
    '--disable-crash-reporter',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--mute-audio',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-domain-reliability',
    '--force-device-scale-factor=1',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  const deadline = Date.now() + timeout;
  try {
    await waitForDevtools(port, deadline);
    const target = await openTarget(port, 'about:blank', deadline);
    const cdp = connect(target.webSocketDebuggerUrl);
    await cdp.ready;
    const session = new Session(cdp, child, port, target.id);
    await session.start({ width, height, mobile });
    return session;
  } catch (error) {
    child.kill('SIGKILL');
    throw error;
  }
}

/** HTTP-проверка URL (код ответа + content-type + длина). Ретраи — dev-сервер
 *  python http.server иногда рвёт соединение при параллельных запросах. */
export async function httpCheck(url, { timeout = 10000, attempts = 3 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
        headers: { 'user-agent': 'qa-runner/1.0', connection: 'close' },
      });
      const text = await response.text();
      return {
        url,
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get('content-type') || '',
        bytes: text.length,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
  return {
    url,
    status: 0,
    ok: false,
    error: String(lastError?.message || lastError),
    cause: lastError?.cause?.code || '',
    attempts,
    bytes: 0,
  };
}
