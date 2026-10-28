#!/usr/bin/env node
/**
 * shot.mjs — снимок экрана и проверка консоли страницы через Chrome DevTools Protocol.
 *
 * Зачем: все игры и каталог — статические страницы; для регрессии нужен настоящий
 * браузер. Скрипт поднимает headless Chrome с отладочным портом, открывает URL,
 * (опционально) нажимает клавишу, снимает PNG и отдаёт JSON с ошибками консоли.
 *
 * Примеры:
 *   node tools/shot.mjs --url "file://$PWD/catalog.html" --out /tmp/catalog.png
 *   node tools/shot.mjs --url "http://127.0.0.1:8080/contra/" --out /tmp/c.png --key g
 *   node tools/shot.mjs --url "http://127.0.0.1:8080/" --out /tmp/m.png --width 390 --height 844
 *
 * Требуется установленный Google Chrome (macOS) или Chromium; путь можно задать
 * переменной CHROME_BIN.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

function parseArgs(argv) {
  const out = {
    url: '',
    out: '',
    width: 1440,
    height: 900,
    scale: 1,
    wait: 1500,
    key: '',
    eval: '',
    fullPage: false,
    timeout: 30000,
    port: 0,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--url': out.url = next(); break;
      case '--out': out.out = next(); break;
      case '--width': out.width = Number(next()); break;
      case '--height': out.height = Number(next()); break;
      case '--scale': out.scale = Number(next()); break;
      case '--wait': out.wait = Number(next()); break;
      case '--key': out.key = next(); break;
      case '--eval': out.eval = next(); break;
      case '--full-page': out.fullPage = true; break;
      case '--timeout': out.timeout = Number(next()); break;
      case '--port': out.port = Number(next()); break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Неизвестный аргумент: ${arg}`);
    }
  }
  if (!out.url || !out.out) throw new Error('Нужны --url и --out');
  return out;
}

function printHelp() {
  console.log('usage: node tools/shot.mjs --url URL --out FILE [--key g] [--width 1440] [--height 900] [--wait 1500] [--eval "js"] [--full-page]');
}

function findChrome() {
  const hit = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!hit) throw new Error('Chrome не найден. Задайте CHROME_BIN.');
  return hit;
}

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
      const { resolve: resolvePromise, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolvePromise(message.result);
      return;
    }
    for (const listener of listeners) listener(message);
  });
  return {
    ready,
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolvePromise, reject) => {
        pending.set(id, { resolve: resolvePromise, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    on(listener) {
      listeners.add(listener);
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const chrome = findChrome();
  const port = args.port || 9300 + Math.floor(Math.random() * 500);
  const profile = resolve(process.env.TMPDIR || '/tmp', `dsh-chrome-${process.pid}`);
  cpMkdir(profile);

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
    '--force-device-scale-factor=1',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  const deadline = Date.now() + args.timeout;
  let cdp;
  let target;
  const consoleErrors = [];
  const pageErrors = [];

  try {
    await waitForDevtools(port, deadline);
    target = await openTarget(port, 'about:blank', deadline);
    cdp = connect(target.webSocketDebuggerUrl);
    await cdp.ready;

    cdp.on((message) => {
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        consoleErrors.push(message.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
      }
      if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails;
        pageErrors.push(details.exception?.description || details.text || 'unknown exception');
      }
    });

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: args.width,
      height: args.height,
      deviceScaleFactor: args.scale,
      mobile: args.width < 700,
    });

    const loaded = new Promise((resolvePromise) => {
      cdp.on((message) => {
        if (message.method === 'Page.loadEventFired') resolvePromise();
      });
    });
    await cdp.send('Page.navigate', { url: args.url });
    await Promise.race([loaded, sleep(8000)]);
    await sleep(args.wait);

    if (args.key) {
      const key = args.key;
      const upper = key.length === 1 ? key.toUpperCase() : key;
      const code = key.length === 1 ? `Key${upper}` : key;
      for (const type of ['keyDown', 'keyUp']) {
        await cdp.send('Input.dispatchKeyEvent', {
          type,
          key: key.length === 1 ? key.toLowerCase() : key,
          code,
          windowsVirtualKeyCode: upper.charCodeAt(0),
          nativeVirtualKeyCode: upper.charCodeAt(0),
          text: type === 'keyDown' ? key : undefined,
        });
      }
      await sleep(600);
    }

    let evalResult;
    if (args.eval) {
      const result = await cdp.send('Runtime.evaluate', {
        expression: args.eval,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'eval failed');
      evalResult = result.result ? result.result.value : undefined;
    }

    const metrics = await cdp.send('Page.getLayoutMetrics');
    const content = metrics.cssContentSize || metrics.contentSize;
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: args.fullPage,
      ...(args.fullPage
        ? { clip: { x: 0, y: 0, width: content.width, height: content.height, scale: 1 } }
        : {}),
    });

    mkdirSync(dirname(resolve(args.out)), { recursive: true });
    writeFileSync(resolve(args.out), Buffer.from(shot.data, 'base64'));

    const info = await cdp.send('Runtime.evaluate', {
      expression: 'JSON.stringify({title: document.title, url: location.href, readyState: document.readyState})',
      returnByValue: true,
    }).catch(() => null);

    console.log(JSON.stringify({
      ok: true,
      out: resolve(args.out),
      width: args.fullPage ? content.width : args.width,
      height: args.fullPage ? content.height : args.height,
      page: info?.result?.value ? JSON.parse(info.result.value) : null,
      consoleErrors,
      pageErrors,
      ...(evalResult === undefined ? {} : { evalResult }),
    }, null, 2));
  } finally {
    cdp?.close();
    if (target?.id) {
      try {
        await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
      } catch { /* окно уже закрыто */ }
    }
    child.kill('SIGKILL');
  }
}

function cpMkdir(path) {
  try {
    mkdirSync(path, { recursive: true });
  } catch {
    /* профиль может уже существовать */
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2));
  process.exit(1);
});
