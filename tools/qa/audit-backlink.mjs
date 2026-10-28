#!/usr/bin/env node
/**
 * audit-backlink.mjs — приёмка навигационной плашки «← Каталог» на страницах игр.
 *
 * Проверяет локально (http://127.0.0.1:8098), на проде и в режиме file://:
 *  • наличие/видимость плашки #catalog-back, её стили, текст, aria-label/title, href;
 *  • реальный клик по плашке → переход в каталог (не только href);
 *  • отсутствие console/page errors и внешних запросов;
 *  • что плашка не мешает запуску игры (Enter/клик), не перехватывает клик по центру,
 *    не ломает смену графики (G);
 *  • клавиатурный фокус (Tab/Enter) на плашке;
 *  • мобильные 390×844 и 844×390: видимость, обрезка, h-scroll, перекрытия;
 *  • file://: href ../index.html, клик открывает каталог (не листинг);
 *  • регрессию каталога (тема G, 11 карточек, превью).
 *
 * Пишет скриншоты в reports/qa-shots/backlink/ и JSON рядом.
 *
 * Пример:
 *   node tools/qa/audit-backlink.mjs --base http://127.0.0.1:8098 \
 *     --prod https://retro-games-psi.vercel.app --out-dir reports/qa-shots/backlink
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, parseArgs, httpCheck } from './lib.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const WORKSPACE = resolve(process.env.QA_WORKSPACE || '/Users/sergio/My/code/projects/retro_games');

const PAGES = [
  { id: 'river-raid', url: 'river-raid/', kind: 'game' },
  { id: 'digger', url: 'digger/', kind: 'game' },
  { id: 'lode-runner', url: 'lode-runner/', kind: 'game' },
  { id: 'boulder-dash', url: 'boulder-dash/', kind: 'game' },
  { id: 'contra', url: 'contra/', kind: 'game' },
  { id: 'exolon', url: 'exolon/', kind: 'game' },
  { id: 'the-last-mission', url: 'the-last-mission/', kind: 'game' },
  { id: 'silkworm', url: 'silkworm/', kind: 'game' },
  { id: 'lost-vikings', url: 'lost-vikings/', kind: 'game' },
  { id: 'double-dragon-battletoads', url: 'double-dragon-battletoads/', kind: 'game' },
  { id: 'lost-vikings-2', url: 'lost-vikings-2/', kind: 'game' },
  { id: 'lode-runner-standalone', url: 'lode-runner/lode-runner.html', kind: 'standalone' },
];

const BENIGN = [
  /AudioContext was not allowed to start/i,
  /The AudioContext was not allowed to start/i,
  /play\(\) failed because the user didn't interact/i,
  /favicon\.ico/i,
];
const isBenign = (t) => BENIGN.some((re) => re.test(t));

const BACKLINK_EXPR = `(() => {
  const el = document.getElementById('catalog-back') || document.querySelector('[data-catalog-back]');
  if (!el) return { found: false };
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const topEl = document.elementFromPoint(cx, cy);
  const centerEl = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  let resolved = null;
  try {
    const u = new URL(el.getAttribute('href') || '', location.href);
    resolved = { href: u.href, pathname: u.pathname, protocol: u.protocol };
  } catch (e) { resolved = { error: String(e) }; }
  const overlaps = [];
  for (const other of document.querySelectorAll('button, a, input, select, textarea, [role=button], [role=switch]')) {
    if (other === el || el.contains(other) || other.contains(el)) continue;
    const or = other.getBoundingClientRect();
    const os = getComputedStyle(other);
    if (or.width < 8 || or.height < 8) continue;
    if (os.visibility === 'hidden' || os.display === 'none' || Number(os.opacity) === 0) continue;
    const ox = Math.min(r.right, or.right) - Math.max(r.left, or.left);
    const oy = Math.min(r.bottom, or.bottom) - Math.max(r.top, or.top);
    if (ox > 4 && oy > 4) {
      overlaps.push({
        tag: other.tagName, id: other.id || '', cls: String(other.className || '').slice(0, 50),
        text: (other.innerText || other.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 50),
        overlap: { x: Math.round(ox), y: Math.round(oy) },
      });
      if (overlaps.length >= 6) break;
    }
  }
  return {
    found: true,
    tag: el.tagName,
    id: el.id || '',
    hasDataAttr: el.getAttribute('data-catalog-back'),
    text: (el.innerText || '').replace(/\\s+/g, ' ').trim(),
    textContent: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
    hrefAttr: el.getAttribute('href') || '',
    href: el.href || '',
    resolved,
    ariaLabel: el.getAttribute('aria-label') || '',
    title: el.getAttribute('title') || '',
    visible: r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none',
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) },
    position: s.position,
    zIndex: s.zIndex,
    opacity: s.opacity,
    fontSize: s.fontSize,
    letterSpacing: s.letterSpacing,
    cursor: s.cursor,
    centeredLeft: Math.abs(r.left) <= 1.5 && Math.abs((r.top + r.bottom) / 2 - window.innerHeight / 2) <= 2,
    inViewport: r.left >= -1 && r.top >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1,
    hitSelf: Boolean(topEl && (topEl === el || el.contains(topEl))),
    centerScreenHitsBacklink: Boolean(centerEl && centerEl.closest && centerEl.closest('#catalog-back')),
    centerScreenElement: centerEl ? centerEl.tagName + (centerEl.id ? '#' + centerEl.id : '') + (centerEl.className ? '.' + String(centerEl.className).split(' ')[0] : '') : null,
    overlapsInteractive: overlaps,
    focusable: el.tabIndex >= 0 || el.hasAttribute('href'),
    viewport: {
      innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
      hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    },
  };
})()`;

const CANVAS_EXPR = `(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { found: false };
  const info = { found: true, w: canvas.width, h: canvas.height };
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ...info, paint: 'non-2d' };
    const w = canvas.width, h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    const colors = new Set();
    let hash = 2166136261 >>> 0;
    const stepX = Math.max(1, Math.floor(w / 40));
    const stepY = Math.max(1, Math.floor(h / 40));
    for (let y = 0; y < h; y += stepY) {
      for (let x = 0; x < w; x += stepX) {
        const i = (y * w + x) * 4;
        colors.add(data[i] + ',' + data[i + 1] + ',' + data[i + 2] + ',' + data[i + 3]);
        hash ^= data[i]; hash = Math.imul(hash, 16777619) >>> 0;
        hash ^= data[i + 1]; hash = Math.imul(hash, 16777619) >>> 0;
        hash ^= data[i + 2]; hash = Math.imul(hash, 16777619) >>> 0;
      }
    }
    return { ...info, paint: colors.size === 1 ? 'blank' : 'painted', colors: colors.size, hash: hash.toString(16) };
  } catch (e) {
    return { ...info, paint: 'error:' + String(e && e.message || e) };
  }
})()`;

const STATE_EXPR = `(() => {
  const html = document.documentElement, body = document.body;
  const text = (body.innerText || '').replace(/\\s+/g, ' ').trim();
  const attr = (name) => body.getAttribute(name) || html.getAttribute(name) || '';
  const overlays = [...document.querySelectorAll('.overlay, [class*=overlay], [class*=menu], [class*=screen], [class*=title]')]
    .filter((e) => {
      const s = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.1 && r.width > 20 && r.height > 20;
    }).length;
  const labels = [...document.querySelectorAll('button, [class*=chip], [class*=toggle], [class*=theme], [class*=gfx]')]
    .map((e) => (e.innerText || e.textContent || '').replace(/\\s+/g, ' ').trim())
    .filter((t) => t && t.length <= 30).slice(0, 14);
  return {
    htmlClass: String(html.className || ''),
    bodyClass: String(body.className || ''),
    attrs: { gfx: attr('data-gfx'), theme: attr('data-theme'), mode: attr('data-mode'), state: attr('data-state'), screen: attr('data-screen'), lang: attr('data-lang') },
    textHead: text.slice(0, 140),
    textLen: text.length,
    overlaysVisible: overlays,
    labels,
  };
})()`;

function pageState() {
  return `(async () => {
    const backlink = ${BACKLINK_EXPR};
    const canvas = ${CANVAS_EXPR};
    const state = ${STATE_EXPR};
    return { backlink, canvas, state, url: location.href, title: document.title };
  })()`;
}

function diffState(a, b) {
  const changes = [];
  if (!a || !b) return changes;
  if (a.canvas?.paint !== b.canvas?.paint || a.canvas?.colors !== b.canvas?.colors || a.canvas?.hash !== b.canvas?.hash) changes.push('canvas');
  if (a.state?.overlaysVisible !== b.state?.overlaysVisible) changes.push('overlays');
  if (a.state?.bodyClass !== b.state?.bodyClass) changes.push('bodyClass');
  if (a.state?.htmlClass !== b.state?.htmlClass) changes.push('htmlClass');
  if (JSON.stringify(a.state?.attrs) !== JSON.stringify(b.state?.attrs)) changes.push('attrs');
  if (a.state?.textHead !== b.state?.textHead || Math.abs((a.state?.textLen || 0) - (b.state?.textLen || 0)) > 15) changes.push('text');
  if (JSON.stringify(a.state?.labels) !== JSON.stringify(b.state?.labels)) changes.push('labels');
  return changes;
}

async function fetchText(url, attempts = 3) {
  let last;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { connection: 'close' } });
      const text = await r.text();
      return { status: r.status, text, contentType: r.headers.get('content-type') || '' };
    } catch (e) {
      last = e;
      if (i < attempts) await sleep(250 * i);
    }
  }
  return { status: 0, text: '', error: String(last && last.message || last) };
}

function externalHosts(requests, allowed = ['127.0.0.1', 'localhost', '[::1]', '::1']) {
  const map = new Map();
  for (const req of requests.values()) {
    let u;
    try { u = new URL(req.url); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    if (allowed.includes(u.hostname)) continue;
    if (!map.has(u.hostname)) map.set(u.hostname, []);
    map.get(u.hostname).push(req.url);
  }
  return [...map.entries()].map(([host, urls]) => ({ host, urls: [...new Set(urls)] }));
}

async function waitForCatalog(session) {
  await sleep(900);
  return session.evaluate(`(() => ({
    url: location.href,
    path: location.pathname,
    title: document.title,
    cards: document.querySelectorAll('#game-grid .card').length,
    isCatalog: Boolean(document.querySelector('#game-grid')) && document.querySelectorAll('#game-grid .card').length >= 11,
  }))()`);
}

async function clickBacklink(session) {
  const loaded = session.waitEvent('Page.loadEventFired', 10000);
  await session.click('#catalog-back');
  await loaded;
  return waitForCatalog(session);
}

function collectErrors(session) {
  return {
    console: session.consoleErrors.filter((e) => !isBenign(e)),
    page: [...session.pageErrors],
    log: session.logErrors.filter((e) => !isBenign(e)),
  };
}

async function auditPage(session, url, { wait = 1900, screenshot, prod = false, externalAllowed = [] } = {}) {
  const rec = { url, prod };
  await session.goto(url, { wait });
  rec.http = null; // заполняется отдельно
  rec.initial = await session.evaluate(pageState());
  rec.loadErrors = collectErrors(session);
  rec.external = externalHosts(session.requests, ['127.0.0.1', 'localhost', '[::1]', '::1', ...externalAllowed]);
  if (screenshot) rec.screenshot = await session.screenshot(screenshot);
  rec.loadLocation = rec.initial.url;

  // ── запуск игры: Enter → кнопка «Играть/Начать» → клик по центру поля ──
  const before = { canvas: rec.initial.canvas, state: rec.initial.state };
  await session.evaluate(`(() => {
    window.__qaKeyLog = [];
    if (!window.__qaKeyHook) {
      window.__qaKeyHook = true;
      window.addEventListener('keydown', function (e) {
        try { window.__qaKeyLog.push({ code: e.code, key: e.key, target: (e.target && e.target.tagName) || '' }); } catch (err) {}
      }, true);
    }
    return true;
  })()`);
  let startedBy = null;
  let after = null;
  let startedChanges = [];
  const attempt = async (label) => {
    await sleep(1250);
    after = await session.evaluate(pageState());
    const changes = diffState(before, after);
    if (changes.length && !startedBy) {
      startedBy = label;
      startedChanges = changes;
    }
    return changes;
  };
  await session.pressKey('Enter');
  startedChanges = await attempt('Enter');
  rec.startButton = null;
  if (!startedBy) {
    const btn = await session.evaluate(`(() => {
      const cands = [...document.querySelectorAll('button, a, [role=button]')].filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (r.width < 24 || r.height < 12) return false;
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.1) return false;
        if (el.closest('#catalog-back')) return false;
        const text = (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
        return /играть|начать|старт|play|start|новая сага|new saga|продолжить|resume/i.test(text);
      });
      if (!cands.length) return null;
      cands.sort((a, b) => {
        const ta = (a.innerText || '').trim(), tb = (b.innerText || '').trim();
        const score = (t) => (/играть|play/i.test(t) ? 0 : /начать|старт|start/i.test(t) ? 1 : 2);
        return score(ta) - score(tb);
      });
      const el = cands[0];
      const r = el.getBoundingClientRect();
      return { text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60), x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    rec.startButton = btn;
    if (btn) {
      for (const type of ['mousePressed', 'mouseReleased']) {
        await session.cdp.send('Input.dispatchMouseEvent', { type, x: btn.x, y: btn.y, button: 'left', clickCount: 1 });
      }
      startedChanges = await attempt('button:' + btn.text);
    }
  }
  if (!startedBy) {
    const clicked = await session.evaluate(`(() => {
      const c = document.querySelector('canvas');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const el = document.elementFromPoint(x, y);
      if (!el || (el.closest && el.closest('#catalog-back'))) return null;
      return { x, y, tag: el.tagName, cls: String(el.className || '') };
    })()`);
    if (clicked) {
      for (const type of ['mousePressed', 'mouseReleased']) {
        await session.cdp.send('Input.dispatchMouseEvent', { type, x: clicked.x, y: clicked.y, button: 'left', clickCount: 1 });
      }
      startedChanges = await attempt('canvas-click');
      rec.startClick = clicked;
    }
  }
  const keyLog = await session.evaluate(`(window.__qaKeyLog || []).slice(-8)`);
  rec.start = {
    started: Boolean(startedBy),
    startedBy,
    changes: (after ? diffState(before, after) : []),
    attemptedChanges: startedChanges,
    stayedOnGame: after ? after.url === rec.loadLocation : false,
    backlinkVisibleAfterStart: after ? after.backlink.visible : false,
    location: after ? after.url : null,
    canvas: after ? after.canvas : null,
    keyEvents: keyLog,
    enterReachedPage: keyLog.some((k) => k.code === 'Enter'),
    errors: collectErrors(session),
  };

  // ── G: переключение графики не должно ломаться из-за плашки ──
  await session.evaluate(`window.__qaKeyLog = []`);
  const gBefore = await session.evaluate(pageState());
  await session.pressKey('g');
  await sleep(1050);
  const gAfter = await session.evaluate(pageState());
  rec.graphics = {
    responded: diffState(gBefore, gAfter).length > 0,
    changes: diffState(gBefore, gAfter),
    stayedOnGame: gAfter.url === rec.loadLocation,
    backlinkVisible: gAfter.backlink.visible,
    location: gAfter.url,
    gKeyReachedPage: (await session.evaluate(`(window.__qaKeyLog || []).some((k) => k.code === 'KeyG')`)),
    errors: collectErrors(session),
  };

  // ── клик по плашке → каталог ──
  rec.click = { before: { url: gAfter.url, centerScreenElement: gAfter.backlink.centerScreenElement, centerScreenHitsBacklink: gAfter.backlink.centerScreenHitsBacklink } };
  try {
    rec.click.navigation = await clickBacklink(session);
    rec.click.errors = collectErrors(session);
  } catch (error) {
    rec.click.error = String(error && error.message || error);
    rec.click.errors = collectErrors(session);
  }
  return rec;
}

async function inspectMobile(session, url, { width, height }) {
  await session.setViewport({ width, height, mobile: width < 700 });
  await session.goto(url, { wait: 1600 });
  const info = await session.evaluate(pageState());
  return {
    viewport: { width, height },
    backlink: info.backlink,
    hscroll: info.backlink.viewport.hscroll,
    innerWidth: info.backlink.viewport.innerWidth,
    innerHeight: info.backlink.viewport.innerHeight,
    scrollWidth: info.backlink.viewport.scrollWidth,
    errors: collectErrors(session),
  };
}

async function focusEnterTest(session, url) {
  await session.goto(url, { wait: 1700 });
  // 1) программный фокус + видимость кольца
  const direct = await session.evaluate(`(() => {
    const el = document.getElementById('catalog-back');
    if (!el) return { found: false };
    el.focus();
    const s = getComputedStyle(el);
    return {
      found: true,
      focused: document.activeElement === el,
      focusVisible: el.matches(':focus-visible'),
      outline: s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.outlineColor,
      opacity: s.opacity,
    };
  })()`);
  // 1b) Tab с плашки уводит фокус на следующий элемент
  await session.evaluate(`document.getElementById('catalog-back')?.focus()`);
  await session.pressKey('Tab');
  await sleep(160);
  const afterTabFromPlaque = await session.evaluate(`(() => {
    const el = document.activeElement;
    return el ? { id: el.id || '', tag: el.tagName, text: (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 60) } : null;
  })()`);
  // 2) Tab-навигация до плашки (если быстро находится)
  await session.goto(url, { wait: 1500 });
  let tabStops = 0;
  let reachedByTab = false;
  let tabFocus = null;
  for (let i = 0; i < 24; i += 1) {
    await session.pressKey('Tab');
    await sleep(110);
    tabStops += 1;
    tabFocus = await session.evaluate(`(() => {
      const el = document.activeElement;
      if (!el) return null;
      const s = getComputedStyle(el);
      return { id: el.id || '', tag: el.tagName, focusVisible: el.matches(':focus-visible'), outline: s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.outlineColor };
    })()`);
    if (tabFocus && tabFocus.id === 'catalog-back') { reachedByTab = true; break; }
  }
  let enterResult = null;
  let enterError = null;
  if (reachedByTab) {
    try {
      const loaded = session.waitEvent('Page.loadEventFired', 10000);
      await session.pressKey('Enter');
      await loaded;
      enterResult = await waitForCatalog(session);
    } catch (e) { enterError = String(e && e.message || e); }
  } else {
    // фолбэк: фокус + Enter
    try {
      await session.evaluate(`document.getElementById('catalog-back')?.focus()`);
      const loaded = session.waitEvent('Page.loadEventFired', 10000);
      await session.pressKey('Enter');
      await loaded;
      enterResult = await waitForCatalog(session);
    } catch (e) { enterError = String(e && e.message || e); }
  }
  return { direct, afterTabFromPlaque, tabStops, reachedByTab, tabFocus, enterResult, enterError, errors: collectErrors(session) };
}

async function catalogRegression(session, base) {
  await session.setViewport({ width: 1440, height: 900, mobile: false });
  await session.goto(`${base}/`, { wait: 1800 });
  const before = await session.evaluate(`(async () => {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline && [...document.images].some((i) => i.naturalWidth === 0)) await new Promise((r) => setTimeout(r, 150));
    return {
      url: location.href,
      theme: document.documentElement.getAttribute('data-theme'),
      cards: document.querySelectorAll('#game-grid .card').length,
      links: [...document.querySelectorAll('#game-grid a[href]')].map((a) => a.getAttribute('href')),
      thumbsLoaded: [...document.images].filter((i) => i.naturalWidth > 0).length,
      thumbsTotal: document.images.length,
      errors: null,
    };
  })()`);
  await session.pressKey('g');
  await sleep(900);
  const after = await session.evaluate(`(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    pressed: document.querySelector('#theme-toggle')?.getAttribute('aria-pressed'),
    thumbsLoaded: [...document.images].filter((i) => i.naturalWidth > 0).length,
    firstThumb: document.querySelector('#game-grid .card-img')?.getAttribute('src') || '',
  }))()`);
  const errors = collectErrors(session);
  // каталог → игра → плашка → каталог
  let roundTrip = null;
  try {
    await session.setViewport({ width: 1440, height: 900, mobile: false });
    await session.goto(`${base}/`, { wait: 1600 });
    await session.evaluate(`document.querySelector('#game-grid a[href]')?.scrollIntoView({ block: 'center', behavior: 'instant' })`);
    await sleep(450);
    const loaded = session.waitEvent('Page.loadEventFired', 12000);
    await session.click('#game-grid a[href]');
    await loaded;
    await sleep(1700);
    const gamePage = await session.evaluate(`(() => {
      const el = document.getElementById('catalog-back');
      return { url: location.href, hasBacklink: Boolean(el), visible: el ? el.getBoundingClientRect().width > 0 : false };
    })()`);
    const back = await clickBacklink(session);
    roundTrip = { gamePage, backToCatalog: back };
  } catch (e) {
    roundTrip = { error: String(e && e.message || e) };
  }
  return { before, after, errors, roundTrip };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    base: 'http://127.0.0.1:8098',
    prod: 'https://retro-games-psi.vercel.app',
    outDir: 'reports/qa-shots/backlink',
    json: 'reports/qa-shots/backlink/backlink-audit.json',
    mobileShots: '2',
  });
  if (args.help) {
    console.log('usage: node tools/qa/audit-backlink.mjs [--base URL] [--prod URL] [--out-dir DIR] [--json FILE]');
    return;
  }
  const base = String(args.base).replace(/\/$/, '');
  const prod = args.prod ? String(args.prod).replace(/\/$/, '') : '';
  const only = args.only ? new Set(String(args.only).split(',').map((x) => x.trim()).filter(Boolean)) : null;
  const pages = only ? PAGES.filter((p) => only.has(p.id)) : PAGES;
  mkdirSync(args.outDir, { recursive: true });
  const shots = {
    local: async (name) => session.screenshot(`${args.outDir}/${name}`),
  };

  const report = {
    when: new Date().toISOString(),
    base,
    prod,
    pages: [],
    mobile: {},
    prodPages: [],
    file: {},
    regression: {},
  };
  const session = await launch({ width: 1440, height: 900 });

  try {
    // ── HTTP-статусы и наличие разметки в исходном HTML ──
    const httpLocal = {};
    const httpLocalText = {};
    const httpProd = {};
    for (const page of pages) {
      httpLocal[page.id] = await httpCheck(`${base}/${page.url}`);
      httpLocalText[page.id] = await fetchText(`${base}/${page.url}`);
      if (prod) httpProd[page.id] = await fetchText(`${prod}/${page.url}`);
    }

    // ── ЛОКАЛЬНО: desktop, запуск, G, клик ──
    for (const page of pages) {
      const shotName = `${page.id}-1440.png`;
      const rec = await auditPage(session, `${base}/${page.url}`, {
        wait: page.kind === 'standalone' ? 1600 : 1900,
        screenshot: `${args.outDir}/${shotName}`,
        externalAllowed: ['127.0.0.1'],
      });
      rec.id = page.id;
      rec.kind = page.kind;
      rec.http = httpLocal[page.id];
      rec.htmlHasMarker = /data-catalog-back/.test(httpLocalText[page.id]?.text || '');
      rec.html = { bytes: (httpLocalText[page.id]?.text || '').length, hasId: /id="catalog-back"/.test(httpLocalText[page.id]?.text || '') };
      report.pages.push(rec);
    }

    // ── МОБИЛЬНЫЕ 390×844 и 844×390 ──
    const landscapeShotSlugs = new Set(['river-raid', 'digger']);
    for (const page of pages) {
      const url = `${base}/${page.url}`;
      const portrait = await inspectMobile(session, url, { width: 390, height: 844 });
      const portraitShot = await session.screenshot(`${args.outDir}/mobile-${page.id}-390x844.png`);
      const landscape = await inspectMobile(session, url, { width: 844, height: 390 });
      const landscapeShot = landscapeShotSlugs.has(page.id)
        ? await session.screenshot(`${args.outDir}/landscape-${page.id}-844x390.png`)
        : null;
      report.mobile[page.id] = { portrait, landscape, portraitShot, landscapeShot };
    }

    // ── FOCUS / TAB / ENTER на подмножестве ──
    for (const id of ['river-raid', 'lost-vikings-2', 'lode-runner-standalone']) {
      const page = PAGES.find((p) => p.id === id);
      if (!page) continue;
      await session.setViewport({ width: 1440, height: 900, mobile: false });
      report[`focus_${id}`] = await focusEnterTest(session, `${base}/${page.url}`);
    }

    // ── file:// ──
    await session.setViewport({ width: 1440, height: 900, mobile: false });
    for (const id of ['boulder-dash', 'digger', 'lost-vikings-2']) {
      const page = PAGES.find((p) => p.id === id);
      const fileRel = page.url + (page.url.endsWith('/') ? 'index.html' : '');
      const fileUrl = `file://${WORKSPACE}/${fileRel}`;
      const rec = { fileUrl };
      try {
        await session.goto(fileUrl, { wait: 1700 });
        rec.backlink = await session.evaluate(BACKLINK_EXPR);
        rec.errorsOnLoad = collectErrors(session);
        rec.screenshot = await session.screenshot(`${args.outDir}/file-${id}-1440.png`);
        rec.click = await clickBacklink(session);
        rec.errorsAfterClick = collectErrors(session);
      } catch (error) {
        rec.fatal = String(error && error.message || error);
      }
      report.file[id] = rec;
    }

    // ── ПРОД ──
    if (prod) {
      await session.setViewport({ width: 1440, height: 900, mobile: false });
      const prodShots = new Set(['river-raid', 'boulder-dash', 'lost-vikings-2']);
      for (const page of pages) {
        const rec = await auditPage(session, `${prod}/${page.url}`, {
          wait: 2100,
          screenshot: prodShots.has(page.id) ? `${args.outDir}/prod-${page.id}-1440.png` : null,
          prod: true,
          externalAllowed: [new URL(prod).hostname],
        });
        rec.id = page.id;
        rec.kind = page.kind;
        rec.http = { status: httpProd[page.id]?.status, contentType: httpProd[page.id]?.contentType };
        rec.htmlHasMarker = /data-catalog-back/.test(httpProd[page.id]?.text || '');
        rec.html = { bytes: (httpProd[page.id]?.text || '').length, hasId: /id="catalog-back"/.test(httpProd[page.id]?.text || '') };
        report.prodPages.push(rec);
      }
      // мобильный прод — одна игра как контроль
      await session.setViewport({ width: 390, height: 844, mobile: true });
      await session.goto(`${prod}/lost-vikings/`, { wait: 1800 });
      const prodMobile = await session.evaluate(pageState());
      report.prodMobile = { backlink: prodMobile.backlink, errors: collectErrors(session), shot: await session.screenshot(`${args.outDir}/prod-mobile-lost-vikings-390x844.png`) };
    }

    // ── РЕГРЕССИЯ КАТАЛОГА ──
    report.regression.local = await catalogRegression(session, base);
    if (prod) report.regression.prod = await catalogRegression(session, prod);
  } finally {
    await session.close();
  }

  // ── сводные вердикты ──
  const summarize = (rec) => {
    const b = rec.initial?.backlink || {};
    const clickNav = rec.click?.navigation || {};
    return {
      exists: Boolean(b.found),
      visible: b.visible === true && b.inViewport === true,
      fixedLeftCenter: b.position === 'fixed' && b.centeredLeft === true,
      textOk: /^←\s*Каталог$/i.test((b.text || '').replace(/\s+/g, ' ').trim()),
      ariaOk: Boolean(b.ariaLabel && b.title),
      dataAttr: b.hasDataAttr === '1',
      hrefRoot: Boolean(b.resolved && (/\/$/.test(b.resolved.pathname) || b.resolved.pathname === '/' || /\/index\.html$/.test(b.resolved.pathname))),
      clickOk: clickNav.isCatalog === true,
      consoleOk: (rec.loadErrors?.console.length || 0) === 0 && (rec.loadErrors?.page.length || 0) === 0 && (rec.click?.errors?.console.length || 0) === 0 && (rec.click?.errors?.page.length || 0) === 0,
      externalOk: (rec.external || []).length === 0,
      zIndexMax: b.zIndex === '2147483647',
      opacityOk: Math.abs(Number(b.opacity) - 0.82) < 0.05,
      size: b.rect ? `${b.rect.w}×${b.rect.h}` : '',
      overlaps: (b.overlapsInteractive || []).length,
      centerFree: b.centerScreenHitsBacklink === false,
      startOk: rec.start ? rec.start.started === true && rec.start.stayedOnGame === true : null,
      graphicsOk: rec.graphics ? rec.graphics.responded === true && rec.graphics.stayedOnGame === true : null,
    };
  };
  report.pages.forEach((p) => { p.summary = summarize(p); });
  report.prodPages.forEach((p) => { p.summary = summarize(p); });
  report.mobileSummary = Object.fromEntries(Object.entries(report.mobile).filter(([k]) => !k.startsWith('_')).map(([id, m]) => {
    const chk = (info) => ({
      visible: info.backlink?.visible === true && info.backlink?.inViewport === true,
      fixed: info.backlink?.position === 'fixed',
      noHscroll: info.hscroll === false,
      overlaps: (info.backlink?.overlapsInteractive || []).length,
      overlapDetails: (info.backlink?.overlapsInteractive || []),
      rect: info.backlink?.rect,
    });
    return [id, { portrait: chk(m.portrait), landscape: chk(m.landscape) }];
  }));
  report.fileSummary = Object.fromEntries(Object.entries(report.file).map(([id, f]) => [id, {
    hrefAttr: f.backlink?.hrefAttr,
    resolved: f.backlink?.resolved?.href,
    visible: f.backlink?.visible,
    clickReachedCatalog: f.click?.isCatalog === true,
    errors: (f.errorsOnLoad?.console.length || 0) + (f.errorsOnLoad?.page.length || 0) + ((f.errorsAfterClick?.console.length || 0) + (f.errorsAfterClick?.page.length || 0)),
  }]));

  mkdirSync(args.outDir, { recursive: true });
  writeFileSync(args.json, JSON.stringify(report, null, 2));

  // ── краткий вывод ──
  const flagLine = (s) => Object.entries(s).filter(([, v]) => v === false).map(([k]) => k);
  console.log('\n=== BACKLINK AUDIT ===');
  for (const p of report.pages) {
    const flags = flagLine(p.summary).filter((f) => !['startOk', 'graphicsOk'].includes(f));
    console.log(`${p.id}: ${p.http?.status} ${p.summary.visible ? 'visible' : 'HIDDEN'} ${p.summary.size} click=${p.summary.clickOk} start=${p.summary.startOk} G=${p.summary.graphicsOk} overlaps=${p.summary.overlaps}${flags.length ? ' FLAGS=' + flags.join(',') : ''}`);
  }
  console.log('\nPROD:');
  for (const p of report.prodPages) {
    const flags = flagLine(p.summary).filter((f) => !['startOk', 'graphicsOk'].includes(f));
    console.log(`${p.id}: ${p.http?.status} marker=${p.htmlHasMarker} ${p.summary.visible ? 'visible' : 'HIDDEN'} click=${p.summary.clickOk}${flags.length ? ' FLAGS=' + flags.join(',') : ''}`);
  }
  console.log('\nfile://:', JSON.stringify(report.fileSummary));
  console.log('mobile all no hscroll:', Object.values(report.mobileSummary).every((m) => m.portrait.noHscroll && m.landscape.noHscroll));
  console.log('regression:', JSON.stringify({ local: { cards: report.regression.local?.before?.cards, themeChanged: report.regression.local?.after?.theme, roundTrip: report.regression.local?.roundTrip?.backToCatalog?.isCatalog } }));
  console.log('JSON:', args.json);
}

main().catch((error) => {
  console.error('FATAL', error);
  process.exit(1);
});
