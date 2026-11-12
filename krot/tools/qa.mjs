/* ============================================================================
   КРОТ · tools/qa.mjs — финальные headless-проверки и скриншоты
   Владелец: qa-runner. Node без зависимостей (встроенные fetch/WebSocket).
   Chrome запускается один раз, управление — через Chrome DevTools Protocol:
   так мобильные layout'ы снимаются честным Emulation.setDeviceMetricsOverride
   (а не --window-size), а консоль/исключения и #test собираются в одной сессии.

   Что проверяет:
     1. #test на странице: KROT TESTS n/n PASS, без ошибок консоли;
     2. desktop-скриншоты §7.2 + ready/levelclear/pause в screenshots/;
     3. мобильные 390×844 и 844×390 (CDP mobile:true): нет горизонтального
        скролла, сцена в кадре, панели не обрезаны;
     4. консоль на всех #shot=... режимах в обеих графиках (err-box, exceptions,
        console.error, Log error);
     5. PNG валиден, >15 КБ, ровно ожидаемого размера.

   Запуск: node tools/qa.mjs [--only=name1,name2] [--no-audit] [--no-selftest]
   Код возврата: 0 — PASS, 1 — есть проблемы.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const INDEX = path.join(ROOT, 'legacy.html'); // v2: старый DOM-интерфейс (шоты/артефакты) живёт в legacy.html
const SHOT_DIR = path.join(ROOT, 'screenshots');
const TMP_DIR = path.join(ROOT, '.tmp');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIN_PNG_BYTES = 15 * 1024;

const DESKTOP = { width: 1280, height: 760, deviceScaleFactor: 1, mobile: false };
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 1, mobile: true };
const LANDSCAPE = { width: 844, height: 390, deviceScaleFactor: 1, mobile: true };

/* ------------------------------- наборы ----------------------------------- */
const DESKTOP_SHOTS = [
  { name: 'title_classic', group: 'core', hash: '#shot=title&gfx=classic&nofx', desc: 'титул, 8-бит' },
  { name: 'title_modern', group: 'core', hash: '#shot=title&gfx=modern&nofx', desc: 'титул, неон' },
  { name: 'play_classic', group: 'core', hash: '#shot=play&gfx=classic&nofx', desc: 'игра, 8-бит' },
  { name: 'play_modern', group: 'core', hash: '#shot=play&gfx=modern&nofx', desc: 'игра, неон' },
  { name: 'bonus_modern', group: 'core', hash: '#shot=bonus&gfx=modern&nofx', desc: 'бонус-режим, неон' },
  { name: 'gameover_modern', group: 'core', hash: '#shot=gameover&gfx=modern&nofx', desc: 'game over, неон' },
  { name: 'help_modern', group: 'core', hash: '#shot=help&gfx=modern&nofx', desc: 'справка, неон' },
  { name: 'settings_classic', group: 'core', hash: '#shot=settings&gfx=classic&nofx', desc: 'настройки, 8-бит' },
  { name: 'play_classic_en', group: 'core', hash: '#shot=play&gfx=classic&lang=en&nofx', desc: 'игра, 8-бит, English' },
  { name: 'ready_classic', group: 'extra', hash: '#shot=ready&gfx=classic&nofx', desc: 'баннер уровня, 8-бит' },
  { name: 'levelclear_modern', group: 'extra', hash: '#shot=levelclear&gfx=modern&nofx', desc: 'уровень пройден, неон' },
  { name: 'pause_modern', group: 'extra', hash: '#shot=pause&gfx=modern&nofx', desc: 'пауза, неон' }
];

const MOBILE_SHOTS = [
  { name: 'mobile_title', group: 'mobile', metrics: MOBILE, hash: '#shot=title&gfx=modern&nofx', desc: 'портрет 390×844, титул' },
  { name: 'mobile_play', group: 'mobile', metrics: MOBILE, hash: '#shot=play&gfx=modern&nofx', desc: 'портрет 390×844, игра' },
  { name: 'mobile_settings', group: 'mobile', metrics: MOBILE, hash: '#shot=settings&gfx=modern&nofx', desc: 'портрет 390×844, настройки' },
  { name: 'landscape_title', group: 'mobile', metrics: LANDSCAPE, hash: '#shot=title&gfx=classic&nofx', desc: 'ландшафт 844×390, титул' },
  { name: 'landscape_play', group: 'mobile', metrics: LANDSCAPE, hash: '#shot=play&gfx=modern&nofx', desc: 'ландшафт 844×390, игра' }
];

const AUDIT_MODES = ['title', 'play', 'ready', 'bonus', 'dying', 'levelclear', 'gameover', 'help', 'settings', 'about', 'pause'];
const AUDIT_GFX = ['classic', 'modern'];

/* ------------------------------- аргументы -------------------------------- */
const argv = process.argv.slice(2);
const onlyArg = argv.find((a) => a.startsWith('--only='));
const only = onlyArg
  ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean)
  : null;
const withAudit = !argv.includes('--no-audit');
const withSelfTest = !argv.includes('--no-selftest');
const unknownArgs = argv.filter((a) => !a.startsWith('--only=') && a !== '--no-audit' && a !== '--no-selftest');
if (unknownArgs.length) {
  console.error('Неизвестные аргументы: ' + unknownArgs.join(' '));
  console.error('Использование: node tools/qa.mjs [--only=name1,name2] [--no-audit] [--no-selftest]');
  process.exit(2);
}
const ALL_SHOTS = DESKTOP_SHOTS.concat(MOBILE_SHOTS);
if (only) {
  const unknown = only.filter((n) => !ALL_SHOTS.some((s) => s.name === n));
  if (unknown.length) {
    console.error('Неизвестные скриншоты: ' + unknown.join(', '));
    console.error('Доступные: ' + ALL_SHOTS.map((s) => s.name).join(', '));
    process.exit(2);
  }
}
const desktopShots = DESKTOP_SHOTS.filter((s) => !only || only.indexOf(s.name) >= 0);
const mobileShots = MOBILE_SHOTS.filter((s) => !only || only.indexOf(s.name) >= 0);

/* -------------------------------- утилиты --------------------------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bytesToKb = (n) => (n / 1024).toFixed(1) + ' KB';
const decodeEntities = (s) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
function nowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
    p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}
function fmtSize(m) { return m.width + '×' + m.height; }

/* PNG: сигнатура + IHDR-размеры. */
function pngInfo(file) {
  let buf;
  try { buf = fs.readFileSync(file); } catch (e) { return { ok: false, reason: 'файл не создан' }; }
  if (buf.length < 24) return { ok: false, reason: 'файл слишком мал (' + buf.length + ' Б)' };
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i++) if (buf[i] !== sig[i]) return { ok: false, reason: 'не PNG (сигнатура)' };
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return { ok: false, reason: 'нет IHDR' };
  return { ok: true, bytes: buf.length, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/* Проверка layout'а страницы: вьюпорт, скролл, обрезанные элементы, err-box. */
const LAYOUT_EXPR = `(() => {
  const de = document.documentElement;
  const vis = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0.01;
  };
  const over = [];
  const nodes = document.querySelectorAll('body *');
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.right > innerWidth + 1.5 || r.left < -1.5 || r.bottom > innerHeight + 1.5 || r.top < -1.5) {
      const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
      over.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls +
        ' [' + Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.right) + ',' + Math.round(r.bottom) + ']');
    }
  }
  const err = document.getElementById('err');
  const testout = document.getElementById('testout');
  const st = document.getElementById('stage');
  const sr = st ? st.getBoundingClientRect() : null;
  return {
    innerWidth: innerWidth, innerHeight: innerHeight, dpr: devicePixelRatio,
    scrollWidth: de.scrollWidth, scrollHeight: de.scrollHeight,
    bodyScrollWidth: document.body.scrollWidth, bodyScrollHeight: document.body.scrollHeight,
    title: document.title,
    errText: err ? (err.textContent || '').trim() : '',
    errVisible: err ? getComputedStyle(err).display !== 'none' : false,
    testout: testout ? (testout.textContent || '').trim() : '',
    stage: sr ? { left: sr.left, top: sr.top, right: sr.right, bottom: sr.bottom, width: sr.width, height: sr.height } : null,
    overflow: over.slice(0, 10), overflowCount: over.length,
    bodyClass: document.body.className,
    uiChildren: document.getElementById('ui') ? document.getElementById('ui').children.length : -1,
    canvas: (() => { const c = document.getElementById('game'); return c ? { w: c.width, h: c.height } : null; })()
  };
})()`;

/* ----------------------------- Chrome + CDP -------------------------------- */
async function launchChrome(profileDir) {
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  fs.mkdirSync(profileDir, { recursive: true });
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--user-data-dir=' + profileDir,
    '--remote-debugging-port=0',
    '--window-size=1280,760',
    '--force-device-scale-factor=1',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-sync',
    '--disable-default-apps',
    '--disable-component-update',
    '--disable-background-networking',
    '--disable-crashpad',
    '--disable-breakpad',
    '--mute-audio',
    '--metrics-recording-only',
    '--no-pings',
    'about:blank'
  ];
  const child = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  let exited = false;
  child.stderr.on('data', (d) => { stderr = (stderr + d.toString()).slice(-20000); });
  child.stdout.on('data', () => { /* вычитываем, чтобы не блокировать пайп */ });
  child.on('exit', () => { exited = true; });
  const die = () => { try { child.kill('SIGKILL'); } catch (e) { /* ignore */ } };

  const portFile = path.join(profileDir, 'DevToolsActivePort');
  let port = null;
  for (let i = 0; i < 300; i++) {
    if (fs.existsSync(portFile)) {
      try {
        const lines = fs.readFileSync(portFile, 'utf8').trim().split('\n');
        port = Number(lines[0]);
        if (port > 0) break;
      } catch (e) { /* файл ещё пишется */ }
    }
    if (exited) break;
    await sleep(50);
  }
  if (!port) { die(); throw new Error('Chrome не запустился (DevToolsActivePort). stderr: ' + stderr.slice(-1500)); }

  let targets = null;
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/list');
      targets = await res.json();
      if (targets && targets.length) break;
    } catch (e) { /* Chrome ещё поднимается */ }
    await sleep(50);
  }
  const page = (targets || []).find((t) => t.type === 'page');
  if (!page || !page.webSocketDebuggerUrl) { die(); throw new Error('CDP: нет page-таргета. stderr: ' + stderr.slice(-1500)); }
  let version = null;
  try { version = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json(); } catch (e) { /* ignore */ }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const openResult = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ error: new Error('CDP: WebSocket не открылся за 15 с') }), 15000);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve({ ws }); });
    ws.addEventListener('error', () => { clearTimeout(timer); resolve({ error: new Error('CDP: ошибка WebSocket') }); });
  });
  if (openResult.error) { die(); throw openResult.error; }

  const pending = new Map();
  const listeners = new Map();
  const waiters = new Map();
  let seq = 0;
  const emit = (method, params) => {
    const arr = waiters.get(method);
    if (arr && arr.length) {
      const w = arr.shift();
      clearTimeout(w.timer);
      w.resolve(params);
    }
    for (const cb of (listeners.get(method) || [])) {
      try { cb(params); } catch (e) { /* ignore */ }
    }
  };
  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8')); }
    catch (e) { return; }
    if (msg.id != null) {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(msg.error.message || 'CDP error'));
      else p.resolve(msg.result);
      return;
    }
    if (msg.method) emit(msg.method, msg.params || {});
  });

  const send = (method, params) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 25000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  const waitEvent = (method, timeoutMs) => new Promise((resolve, reject) => {
    const w = { resolve, reject };
    w.timer = setTimeout(() => {
      const arr = waiters.get(method) || [];
      const i = arr.indexOf(w);
      if (i >= 0) arr.splice(i, 1);
      reject(new Error('нет события ' + method + ' за ' + (timeoutMs || 15000) + ' мс'));
    }, timeoutMs || 15000);
    if (!waiters.has(method)) waiters.set(method, []);
    waiters.get(method).push(w);
  });
  const on = (method, cb) => {
    if (!listeners.has(method)) listeners.set(method, []);
    listeners.get(method).push(cb);
  };
  const close = async () => {
    try { await send('Browser.close'); } catch (e) { /* ignore */ }
    try { ws.close(); } catch (e) { /* ignore */ }
    die();
    await sleep(150);
  };

  return { send, waitEvent, on, close, stderr: () => stderr, version, exited: () => exited };
}

/* ------------------------------ QA-сессия --------------------------------- */
class Session {
  constructor(cdp) {
    this.cdp = cdp;
    this.consoleErrors = [];
    this.navSeq = 0;
    cdp.on('Runtime.exceptionThrown', (p) => {
      const d = p.exceptionDetails || {};
      const text = (d.exception && (d.exception.description || d.exception.value)) || d.text || 'unknown exception';
      this.consoleErrors.push('exception: ' + String(text).split('\n')[0]);
    });
    cdp.on('Runtime.consoleAPICalled', (p) => {
      if (p.type !== 'error') return;
      const parts = (p.args || []).map((a) => (a.value != null ? String(a.value) : (a.description || a.type || '')));
      this.consoleErrors.push('console.error: ' + parts.join(' '));
    });
    cdp.on('Log.entryAdded', (p) => {
      const e = p.entry || {};
      if (e.level !== 'error') return;
      const txt = String(e.text || '');
      const url = String(e.url || '');
      if (/favicon/i.test(txt) || /favicon/i.test(url)) return;
      this.consoleErrors.push('log: ' + txt + (url ? ' (' + url + ')' : ''));
    });
  }

  async init() {
    await this.cdp.send('Page.enable');
    await this.cdp.send('Runtime.enable');
    await this.cdp.send('Log.enable');
  }

  async navigate(hash, metrics) {
    this.consoleErrors = [];
    this.navSeq++;
    await this.cdp.send('Emulation.setDeviceMetricsOverride', {
      width: metrics.width, height: metrics.height,
      deviceScaleFactor: metrics.deviceScaleFactor || 1,
      mobile: !!metrics.mobile,
      screenWidth: metrics.width, screenHeight: metrics.height,
      dontSetVisibleSize: false
    });
    const url = pathToFileURL(INDEX).href + '?qa=' + this.navSeq + hash;
    const load = this.cdp.waitEvent('Page.loadEventFired', 20000);
    const nav = await this.cdp.send('Page.navigate', { url });
    if (nav.errorText) throw new Error('навигация: ' + nav.errorText);
    try { await load; } catch (e) { throw new Error('страница не загрузилась за 20 с: ' + url); }
    await sleep(350);
    return url;
  }

  async evaluate(expression) {
    const res = await this.cdp.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true
    });
    if (res.exceptionDetails) {
      const d = res.exceptionDetails;
      throw new Error('evaluate: ' + ((d.exception && d.exception.description) || d.text));
    }
    return res.result ? res.result.value : undefined;
  }

  async screenshot(file) {
    const res = await this.cdp.send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, captureBeyondViewport: false
    });
    fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
    return fs.statSync(file).size;
  }
}

function layoutProblems(layout, metrics, { mobile }) {
  const problems = [];
  if (layout.canvas && (layout.canvas.w !== 960 || layout.canvas.h !== 600)) {
    problems.push('canvas ' + layout.canvas.w + '×' + layout.canvas.h + ' вместо 960×600');
  }
  if (layout.innerWidth !== metrics.width || layout.innerHeight !== metrics.height) {
    problems.push('вьюпорт ' + layout.innerWidth + '×' + layout.innerHeight + ' вместо ' + fmtSize(metrics) +
      ' (deviceScaleFactor ' + layout.dpr + ')');
  }
  if (layout.scrollWidth > layout.innerWidth + 1) {
    problems.push('горизонтальный скролл: scrollWidth=' + layout.scrollWidth + ' > innerWidth=' + layout.innerWidth);
  }
  if (layout.scrollHeight > layout.innerHeight + 1 && !mobile) {
    problems.push('вертикальный скролл: scrollHeight=' + layout.scrollHeight + ' > innerHeight=' + layout.innerHeight);
  }
  if (layout.stage) {
    const s = layout.stage;
    const tol = 1.5;
    if (s.left < -tol || s.top < -tol || s.right > layout.innerWidth + tol || s.bottom > layout.innerHeight + tol) {
      problems.push('сцена вне кадра: [' + [s.left, s.top, s.right, s.bottom].map((v) => Math.round(v)).join(',') + ']');
    }
  } else {
    problems.push('нет #stage');
  }
  if (layout.errText) problems.push('исключение на странице: ' + layout.errText.split('\n')[0]);
  if (layout.innerWidth !== layout.scrollWidth && layout.scrollWidth > layout.innerWidth) {
    problems.push('ширина документа ' + layout.scrollWidth + ' больше вьюпорта');
  }
  return problems;
}

/* --------------------------------- main ----------------------------------- */
const report = [];
const failures = [];

function addReport(line) { report.push(line); }
function markProblem(section, name, problems) {
  if (problems.length) failures.push({ section, name, problems });
}

async function main() {
  if (!fs.existsSync(CHROME)) throw new Error('Chrome не найден: ' + CHROME);
  if (!fs.existsSync(INDEX)) throw new Error('index.html не найден: ' + INDEX);
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const html = fs.readFileSync(INDEX, 'utf8');
  const scriptSrcs = Array.from(html.matchAll(/<script[^>]*\bsrc="([^"]+)"/gi)).map((m) => m[1]);
  const missingScripts = scriptSrcs.filter((src) => !/^https?:/i.test(src) && !fs.existsSync(path.join(ROOT, src)));
  const externalScripts = scriptSrcs.filter((src) => /^https?:/i.test(src));

  const profileDir = path.join(TMP_DIR, 'qa-cdp-profile');
  const cdp = await launchChrome(profileDir);
  const session = new Session(cdp);
  await session.init();
  const chromeVersion = (cdp.version && cdp.version.Browser) || 'неизвестно';

  addReport('KROT QA · ' + nowStamp());
  addReport('Chrome: ' + chromeVersion + ' (CDP, headless=new)');
  addReport('index.html: ' + INDEX);
  addReport('Скриншоты: ' + SHOT_DIR);
  addReport('');

  /* 1. page self-tests #test */
  let selfTestOk = true;
  if (withSelfTest) {
    let layout = null;
    let selfTestsplit = [];
    try {
      await session.navigate('#test&mute', DESKTOP);
      layout = await session.evaluate(LAYOUT_EXPR);
    } catch (e) {
      selfTestOk = false;
      selfTestsplit.push(e.message);
    }
    addReport('# самопроверки страницы (#test)');
    if (layout) {
      const text = decodeEntities(layout.testout || '') + '\n' + decodeEntities(layout.title || '');
      const m = text.match(/KROT TESTS (\d+)\/(\d+) (PASS|FAIL)/);
      if (!m) {
        selfTestOk = false;
        selfTestsplit.push('результат #test не найден (title=' + JSON.stringify(layout.title) + ')');
      } else {
        const passed = Number(m[1]), total = Number(m[2]), status = m[3];
        const ok = status === 'PASS' && passed === total;
        selfTestOk = selfTestOk && ok;
        addReport((ok ? 'ok   ' : 'FAIL ') + m[0] + '  (title=' + layout.title + ')');
        if (!ok) {
          selfTestsplit = decodeEntities(layout.testout || '').split('\n')
            .map((l) => l.trim()).filter((l) => l.indexOf('FAIL') === 0);
          if (!selfTestsplit.length) selfTestsplit.push('FAIL ' + passed + '/' + total);
        }
      }
      if (layout.errText) { selfTestOk = false; selfTestsplit.push('исключение: ' + layout.errText.split('\n')[0]); }
      if (session.consoleErrors.length) {
        selfTestOk = false;
        selfTestsplit.push('консоль: ' + session.consoleErrors.join(' | '));
      }
    }
    if (selfTestsplit.length) {
      for (const p of selfTestsplit) addReport('       ! ' + p);
      failures.push({ section: 'selftest', name: '#test', problems: selfTestsplit });
    }
    addReport('');
  }

  /* 2. desktop-скриншоты */
  addReport('# desktop-скриншоты (§7.2 + ready/levelclear/pause), ' + fmtSize(DESKTOP));
  for (const shot of desktopShots) {
    const file = path.join(SHOT_DIR, shot.name + '.png');
    try { fs.rmSync(file, { force: true }); } catch (e) { /* ignore */ }
    const problems = [];
    let layout = null;
    try {
      await session.navigate(shot.hash, DESKTOP);
      layout = await session.evaluate(LAYOUT_EXPR);
      await session.screenshot(file);
    } catch (e) {
      problems.push(e.message);
    }
    const png = pngInfo(file);
    if (!problems.length) {
      if (!png.ok) problems.push(png.reason);
      else {
        if (png.bytes < MIN_PNG_BYTES) problems.push('PNG меньше 15 КБ (' + bytesToKb(png.bytes) + ')');
        if (png.width !== DESKTOP.width || png.height !== DESKTOP.height) {
          problems.push('PNG ' + png.width + '×' + png.height + ' вместо ' + fmtSize(DESKTOP));
        }
      }
      if (layout) problems.push(...layoutProblems(layout, DESKTOP, { mobile: false }));
      for (const e of session.consoleErrors) problems.push('консоль: ' + e);
    }
    markProblem('desktop', shot.name, problems);
    addReport((problems.length ? 'FAIL ' : 'ok   ') + shot.name.padEnd(20) + '  ' +
      (png.ok ? bytesToKb(png.bytes).padStart(9) + ' ' + fmtSize(png) : 'нет PNG') + '  ' + shot.desc);
    for (const p of problems) addReport('       ! ' + p);
    console.log((problems.length ? 'FAIL ' : 'ok   ') + shot.name.padEnd(20) + ' ' +
      (png.ok ? fmtSize(png) + ' ' + bytesToKb(png.bytes) : 'нет PNG') + '  ' + (problems[0] || ''));
  }
  addReport('');

  /* 3. мобильные layout'ы через CDP */
  addReport('# мобильные размеры (CDP Emulation.setDeviceMetricsOverride, mobile:true)');
  for (const shot of mobileShots) {
    const file = path.join(SHOT_DIR, shot.name + '.png');
    try { fs.rmSync(file, { force: true }); } catch (e) { /* ignore */ }
    const problems = [];
    const warnings = [];
    let layout = null;
    try {
      await session.navigate(shot.hash, shot.metrics);
      layout = await session.evaluate(LAYOUT_EXPR);
      await session.screenshot(file);
    } catch (e) {
      problems.push(e.message);
    }
    const png = pngInfo(file);
    if (!problems.length) {
      if (!png.ok) problems.push(png.reason);
      else {
        if (png.bytes < MIN_PNG_BYTES) problems.push('PNG меньше 15 КБ (' + bytesToKb(png.bytes) + ')');
        if (png.width !== shot.metrics.width || png.height !== shot.metrics.height) {
          problems.push('PNG ' + png.width + '×' + png.height + ' вместо ' + fmtSize(shot.metrics));
        }
      }
      if (layout) {
        problems.push(...layoutProblems(layout, shot.metrics, { mobile: true }));
        for (const el of layout.overflow || []) warnings.push('элемент выступает за кадр: ' + el);
        if (layout.uiChildren < 0) problems.push('нет #ui');
        if ((shot.hash.indexOf('shot=title') >= 0 || shot.hash.indexOf('shot=settings') >= 0) && layout.uiChildren < 1) {
          problems.push('оверлей не отрисован (uiChildren=' + layout.uiChildren + ')');
        }
      }
      for (const e of session.consoleErrors) problems.push('консоль: ' + e);
    }
    markProblem('mobile', shot.name, problems);
    addReport((problems.length ? 'FAIL ' : 'ok   ') + shot.name.padEnd(20) + '  ' +
      (png.ok ? bytesToKb(png.bytes).padStart(9) + ' ' + fmtSize(png) : 'нет PNG') + '  ' + shot.desc +
      '  scroll=' + (layout ? layout.scrollWidth + '×' + layout.scrollHeight + ' / ' + layout.innerWidth + '×' + layout.innerHeight : '—'));
    for (const p of problems) addReport('       ! ' + p);
    for (const w of warnings) addReport('       ~ ' + w);
    console.log((problems.length ? 'FAIL ' : 'ok   ') + shot.name.padEnd(20) + ' ' +
      (png.ok ? fmtSize(png) : 'нет PNG') + '  ' + (problems[0] || warnings[0] || ''));
  }
  addReport('');

  /* 4. консоль на всех режимах обеих график */
  if (withAudit && !only) {
    addReport('# консоль: все #shot=… режимы, обе графики (без скриншотов)');
    let auditOk = 0, auditTotal = 0;
    for (const gfx of AUDIT_GFX) {
      for (const mode of AUDIT_MODES) {
        auditTotal++;
        const hash = '#shot=' + mode + '&gfx=' + gfx + '&nofx';
        const problems = [];
        try {
          await session.navigate(hash, DESKTOP);
          const layout = await session.evaluate(LAYOUT_EXPR);
          if (layout.errText) problems.push('исключение: ' + layout.errText.split('\n')[0]);
          if (layout.errVisible) problems.push('блок #err виден');
          if (session.consoleErrors.length) problems.push('консоль: ' + session.consoleErrors.join(' | '));
          if (layout.bodyClass.indexOf('gfx-' + gfx) < 0) problems.push('body без класса gfx-' + gfx + ' (' + layout.bodyClass + ')');
          if (layout.canvas && (layout.canvas.w !== 960 || layout.canvas.h !== 600)) problems.push('canvas не 960×600');
        } catch (e) {
          problems.push(e.message);
        }
        markProblem('audit', mode + '/' + gfx, problems);
        if (!problems.length) auditOk++;
        else { addReport('FAIL ' + mode + '/' + gfx); for (const p of problems) addReport('       ! ' + p); }
      }
    }
    addReport((auditOk === auditTotal ? 'ok   ' : 'FAIL ') + 'режимы без ошибок: ' + auditOk + '/' + auditTotal);
    console.log('audit: ' + (auditOk === auditTotal ? 'ok   ' : 'FAIL ') + auditOk + '/' + auditTotal + ' режимов');
    addReport('');
  }

  /* 5. артефакты index.html */
  if (missingScripts.length || externalScripts.length) {
    addReport('# артефакты index.html');
    if (missingScripts.length) {
      addReport('FAIL отсутствуют подключённые скрипты: ' + missingScripts.join(', '));
      failures.push({ section: 'artifacts', name: 'index.html', problems: ['нет файлов: ' + missingScripts.join(', ')] });
    }
    if (externalScripts.length) {
      addReport('FAIL внешние скрипты (запрещены контрактом): ' + externalScripts.join(', '));
      failures.push({ section: 'artifacts', name: 'index.html', problems: ['внешние скрипты: ' + externalScripts.join(', ')] });
    }
    addReport('');
  }

  const chromeErr = cdp.stderr();
  if (failures.length && chromeErr) {
    addReport('# stderr Chrome (последние строки, для диагностики)');
    addReport(chromeErr.split('\n').slice(-6).join('\n'));
    addReport('');
  }

  await cdp.close();
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }

  const shotsTotal = desktopShots.length + mobileShots.length;
  const shotFailures = failures.filter((f) => f.section === 'desktop' || f.section === 'mobile').length;
  addReport('РЕЗУЛЬТАТ: ' + (failures.length === 0 ? 'PASS' : 'FAIL'));
  addReport('Скриншоты: ' + (shotsTotal - shotFailures) + '/' + shotsTotal +
    ' (desktop ' + desktopShots.length + ', mobile ' + mobileShots.length + ')' +
    (withSelfTest ? ', #test: ' + (selfTestOk ? 'PASS' : 'FAIL') : '') +
    (withAudit && !only ? ', консоль-аудит: ' + (failures.some((f) => f.section === 'audit') ? 'FAIL' : 'OK') : ''));
  if (failures.length) {
    addReport('');
    addReport('# проблемы');
    for (const f of failures) addReport('FAIL [' + f.section + '] ' + f.name + ': ' + f.problems.join('; '));
  }

  const text = report.join('\n');
  console.log('\n' + text);
  try {
    fs.writeFileSync(path.join(SHOT_DIR, 'qa-report.txt'), text + '\n', 'utf8');
    console.log('\nОтчёт сохранён: ' + path.join(SHOT_DIR, 'qa-report.txt'));
  } catch (e) {
    console.log('\nНе удалось записать отчёт: ' + (e && e.message));
  }
  return failures.length === 0 ? 0 : 1;
}

main().then((code) => {
  process.exit(code);
}).catch((err) => {
  console.error('QA фатальная ошибка: ' + (err && (err.stack || err.message)));
  try {
    fs.writeFileSync(path.join(SHOT_DIR, 'qa-report.txt'),
      'KROT QA · ' + nowStamp() + '\nFAIL: ' + (err && (err.stack || err.message)) + '\n', 'utf8');
  } catch (e) { /* ignore */ }
  process.exit(1);
});
