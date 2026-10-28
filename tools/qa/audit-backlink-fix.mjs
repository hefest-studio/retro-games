#!/usr/bin/env node
/**
 * audit-backlink-fix.mjs — переприёмка адаптивной плашки «← Каталог» (task-6).
 *
 * Проверяет после фикса P2 (коммит df4d320):
 *  • P2 digger: на 360/375/390 плашка не перекрывает «НАСТРОЙКИ», центр кнопки не
 *    перехвачен, тап по центру открывает настройки, тап по плашке — каталог;
 *  • матрицу «11 игр × 360/375/390/414/430/1440×900/844×390»: выбранная позиция
 *    (dataset.place), пересечения с интерактивными элементами, перехват центров,
 *    выход за вьюпорт, h-scroll, позиция по ожиданиям;
 *  • регрессию: клик по плашке на всех 11 (локально и прод), старт игры (Enter),
 *    G, file://, каталог после возврата;
 *  • что прод отдаёт новую версию (interactiveBoxes / dataset.place в HTML).
 *
 * Пишет скриншоты в reports/qa-shots/backlink-fix/ и JSON рядом.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, parseArgs, httpCheck } from './lib.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WORKSPACE = resolve(process.env.QA_WORKSPACE || '/Users/sergio/My/code/projects/retro_games');

const GAMES = [
  'river-raid', 'digger', 'lode-runner', 'boulder-dash', 'contra', 'exolon',
  'the-last-mission', 'silkworm', 'lost-vikings', 'double-dragon-battletoads', 'lost-vikings-2',
];
const VIEWPORTS = [
  { w: 360, h: 640, label: '360x640' },
  { w: 375, h: 667, label: '375x667' },
  { w: 390, h: 844, label: '390x844' },
  { w: 414, h: 896, label: '414x896' },
  { w: 430, h: 932, label: '430x932' },
  { w: 1440, h: 900, label: '1440x900' },
  { w: 844, h: 390, label: '844x390' },
];
const EXPECT = {
  digger: { '360x640': 'bottom-left', '375x667': 'bottom-left', '390x844': 'bottom-left' },
  'lode-runner': { '360x640': 'bottom-left', '375x667': 'bottom-left', '390x844': 'bottom-left' },
  'river-raid': { '360x640': 'bottom-left', '375x667': 'bottom-left', '390x844': 'bottom-left' },
  'boulder-dash': { '360x640': 'bottom-left' },
};

const BENIGN = [/AudioContext was not allowed to start/i, /favicon\.ico/i];
const isBenign = (t) => BENIGN.some((re) => re.test(t));
const errorsOf = (s) => ({
  console: s.consoleErrors.filter((e) => !isBenign(e)),
  page: [...s.pageErrors],
  log: s.logErrors.filter((e) => !isBenign(e)),
});

const PLACEMENT_EXPR = `(() => {
  const el = document.getElementById('catalog-back');
  if (!el) return { found: false };
  const br = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  const boxes = [];
  const textHits = [];
  const sel = 'a,button,input,select,textarea,[role="button"],[tabindex],[onclick]';
  for (const o of document.querySelectorAll(sel)) {
    if (o === el || el.contains(o) || o.contains(el)) continue;
    const r = o.getBoundingClientRect();
    const st = getComputedStyle(o);
    if (r.width < 4 || r.height < 4) continue;
    if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) < 0.05) continue;
    if (st.pointerEvents === 'none') continue;
    const ox = Math.min(br.right, r.right) - Math.max(br.left, r.left);
    const oy = Math.min(br.bottom, r.bottom) - Math.max(br.top, r.top);
    if (ox > 0 && oy > 0) {
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const c = document.elementFromPoint(cx, cy);
      boxes.push({
        text: (o.innerText || o.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 50),
        tag: o.tagName, cls: String(o.className || '').slice(0, 40),
        overlap: { x: Math.round(ox), y: Math.round(oy) },
        centerBlocked: Boolean(c && (c === el || el.contains(c))),
        centerHits: c ? c.tagName + '.' + String(c.className || '').split(' ')[0] : null,
      });
    }
  }
  // диагностика: перекрытие с текстовыми/важными неинтерактивными элементами
  const brArea = Math.max(1, br.width * br.height);
  for (const o of document.querySelectorAll('h1,h2,h3,p,strong,b,label,img,canvas')) {
    if (el.contains(o)) continue;
    const r = o.getBoundingClientRect();
    if (r.width < 12 || r.height < 12) continue;
    const st = getComputedStyle(o);
    if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) < 0.05) continue;
    const ox = Math.min(br.right, r.right) - Math.max(br.left, r.left);
    const oy = Math.min(br.bottom, r.bottom) - Math.max(br.top, r.top);
    if (ox <= 2 || oy <= 2) continue;
    const ownText = (o.innerText || '').replace(/\\s+/g, ' ').trim();
    if (o.tagName !== 'IMG' && o.tagName !== 'CANVAS' && ownText.length < 2) continue;
    textHits.push({ tag: o.tagName, cls: String(o.className || '').slice(0, 40), text: ownText.slice(0, 40), areaRatio: Math.round((ox * oy) / brArea * 100) / 100 });
    if (textHits.length >= 6) break;
  }
  const centerEl = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
  return {
    found: true,
    place: el.dataset.place || '',
    rect: { x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height), right: Math.round(br.right), bottom: Math.round(br.bottom) },
    position: s.position, zIndex: s.zIndex, opacity: s.opacity,
    visible: br.width > 0 && br.height > 0 && s.visibility !== 'hidden' && s.display !== 'none',
    inViewport: br.left >= -0.5 && br.top >= -0.5 && br.right <= window.innerWidth + 0.5 && br.bottom <= window.innerHeight + 0.5,
    centerHitsSelf: Boolean(centerEl && (centerEl === el || el.contains(centerEl))),
    hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    viewport: { w: window.innerWidth, h: window.innerHeight, scrollWidth: document.documentElement.scrollWidth },
    overlaps: boxes,
    blockedCenters: boxes.filter((b) => b.centerBlocked).length,
    textHits,
    href: el.getAttribute('href'),
    ariaLabel: el.getAttribute('aria-label') || '',
    title: el.getAttribute('title') || '',
    dataAttr: el.getAttribute('data-catalog-back'),
  };
})()`;

const CANVAS_EXPR = `(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { found: false };
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return { found: true, paint: 'non-2d' };
    const w = canvas.width, h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    let hash = 2166136261 >>> 0;
    const colors = new Set();
    const stepX = Math.max(1, Math.floor(w / 40));
    const stepY = Math.max(1, Math.floor(h / 40));
    for (let y = 0; y < h; y += stepY) {
      for (let x = 0; x < w; x += stepX) {
        const i = (y * w + x) * 4;
        colors.add(data[i] + ',' + data[i + 1] + ',' + data[i + 2]);
        hash ^= data[i]; hash = Math.imul(hash, 16777619) >>> 0;
        hash ^= data[i + 1]; hash = Math.imul(hash, 16777619) >>> 0;
        hash ^= data[i + 2]; hash = Math.imul(hash, 16777619) >>> 0;
      }
    }
    return { found: true, paint: colors.size === 1 ? 'blank' : 'painted', hash: hash.toString(16), colors: colors.size };
  } catch (e) { return { found: true, paint: 'error:' + String(e && e.message || e) }; }
})()`;

const UI_STATE_EXPR = `(() => {
  const html = document.documentElement, body = document.body;
  const text = (body.innerText || '').replace(/\\s+/g, ' ').trim();
  const overlays = [...document.querySelectorAll('.overlay, [class*=overlay], [class*=menu], [class*=screen], [class*=title], [class*=panel]')]
    .filter((e) => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.1 && r.width > 20 && r.height > 20;
    }).length;
  return {
    bodyClass: String(body.className || ''), htmlClass: String(html.className || ''),
    attrs: ['data-gfx', 'data-theme', 'data-mode', 'data-state', 'data-screen'].map((a) => (body.getAttribute(a) || html.getAttribute(a) || '')),
    textLen: text.length, textHead: text.slice(0, 120), overlays,
  };
})()`;

async function fetchText(url, attempts = 3) {
  let last;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { connection: 'close' } });
      return { status: r.status, text: await r.text(), contentType: r.headers.get('content-type') || '' };
    } catch (e) { last = e; if (i < attempts) await sleep(250 * i); }
  }
  return { status: 0, text: '', error: String(last && last.message || last) };
}

function externalHosts(requests, allowed) {
  const map = new Map();
  for (const req of requests.values()) {
    let u; try { u = new URL(req.url); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    if (allowed.includes(u.hostname)) continue;
    if (!map.has(u.hostname)) map.set(u.hostname, []);
    map.get(u.hostname).push(req.url);
  }
  return [...map.entries()].map(([host, urls]) => ({ host, urls: [...new Set(urls)] }));
}

function positionName(rect, vp) {
  const midY = (rect.y + rect.bottom) / 2;
  const midX = (rect.x + rect.right) / 2;
  const vertical = midY < vp.h / 3 ? 'top' : midY > (2 * vp.h) / 3 ? 'bottom' : 'mid';
  const horizontal = midX < vp.w / 3 ? 'left' : midX > (2 * vp.w) / 3 ? 'right' : 'center';
  if (horizontal === 'left' && vertical === 'mid') return 'left-mid';
  return `${vertical}-${horizontal}`;
}

async function clickAt(session, x, y) {
  for (const type of ['mousePressed', 'mouseReleased']) {
    await session.cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  }
}

async function clickBacklink(session, timeout = 12000) {
  const loaded = session.waitEvent('Page.loadEventFired', timeout);
  const pt = await session.evaluate(`(() => {
    const el = document.getElementById('catalog-back');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, hit: (() => { const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return Boolean(e && (e === el || el.contains(e))); })() };
  })()`);
  if (!pt) throw new Error('плашка не найдена');
  await clickAt(session, pt.x, pt.y);
  await loaded;
  await sleep(800);
  return session.evaluate(`(() => ({
    url: location.href, path: location.pathname, title: document.title,
    cards: document.querySelectorAll('#game-grid .card').length,
    isCatalog: Boolean(document.querySelector('#game-grid')) && document.querySelectorAll('#game-grid .card').length >= 11,
  }))()`);
}

async function checkMatrix(session, base, { prod = false, only = null, outDir = null } = {}) {
  const rows = [];
  const screenshots = [];
  const games = only ? GAMES.filter((g) => only.has(g)) : GAMES;
  for (const vp of VIEWPORTS) {
    await session.setViewport({ width: vp.w, height: vp.h, mobile: vp.w < 700 });
    for (const slug of games) {
      const url = `${base}/${slug}/`;
      try {
        await session.goto(url, { wait: prod ? 2000 : 1600 });
        const p = await session.evaluate(PLACEMENT_EXPR);
        const errors = errorsOf(session);
        const row = { slug, viewport: vp.label, ...p, errors, external: externalHosts(session.requests, ['127.0.0.1', 'localhost', '[::1]', '::1', new URL(base).hostname]) };
        row.positionName = p.found ? positionName(p.rect, p.viewport) : null;
        row.matchesExpected = EXPECT[slug]?.[vp.label] ? row.positionName === EXPECT[slug][vp.label] : null;
        rows.push(row);
        if (vp.w === 390 && !prod) {
          screenshots.push({ slug, path: await session.screenshot(`${outDir}/mobile-${slug}-390x844.png`) });
        }
      } catch (e) {
        rows.push({ slug, viewport: vp.label, fatal: String(e && e.message || e) });
      }
    }
  }
  return { rows, screenshots };
}

async function p2Digger(session, outDir) {
  const out = [];
  for (const vp of VIEWPORTS.filter((v) => [360, 375, 390].includes(v.w))) {
    await session.setViewport({ width: vp.w, height: vp.h, mobile: true });
    await session.goto('http://127.0.0.1:8098/digger/', { wait: 1800 });
    const geo = await session.evaluate(`(() => {
      const el = document.getElementById('catalog-back');
      const btn = [...document.querySelectorAll('button,a')].find((o) => /НАСТРОЙКИ/i.test(o.innerText || ''));
      const br = el.getBoundingClientRect();
      const r = btn ? btn.getBoundingClientRect() : null;
      if (!r) return { backlink: { x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height) }, place: el.dataset.place || '', button: null };
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const c = document.elementFromPoint(cx, cy);
      const ox = Math.min(br.right, r.right) - Math.max(br.left, r.left);
      const oy = Math.min(br.bottom, r.bottom) - Math.max(br.top, r.top);
      return {
        place: el.dataset.place || '',
        backlink: { x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height), right: Math.round(br.right), bottom: Math.round(br.bottom) },
        button: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), center: { x: Math.round(cx), y: Math.round(cy) } },
        overlap: { x: Math.round(ox), y: Math.round(oy) },
        centerBlocked: Boolean(c && (c === el || el.contains(c))),
        centerHits: c ? c.tagName + '.' + String(c.className || '').split(' ')[0] : null,
      };
    })()`);
    const stateBefore = await session.evaluate(UI_STATE_EXPR);
    const shot = await session.screenshot(`${outDir}/digger-${vp.label}.png`);
    // тап по центру кнопки «НАСТРОЙКИ» — должен открыть настройки, а не каталог
    let centerClick = null;
    if (geo.button) {
      await clickAt(session, geo.button.center.x, geo.button.center.y);
      await sleep(1000);
      centerClick = {
        ...(await session.evaluate(`({ url: location.href, path: location.pathname, title: document.title })`)),
        state: await session.evaluate(UI_STATE_EXPR),
      };
      centerClick.stayedOnGame = centerClick.path === '/digger/';
      centerClick.navigatedToCatalog = centerClick.path === '/';
      centerClick.uiChanged = JSON.stringify(stateBefore) !== JSON.stringify(centerClick.state);
    }
    // тап по плашке → каталог
    let backlinkClick = null;
    try { backlinkClick = await clickBacklink(session); } catch (e) { backlinkClick = { error: String(e && e.message || e) }; }
    const zoomShot = await session.screenshot(`${outDir}/digger-${vp.label}-after.png`).catch(() => null);
    out.push({ viewport: vp.label, geo, shot, zoomShot, stateBefore, centerClick, backlinkClick, errors: errorsOf(session) });
  }
  return out;
}

async function clickAllBacklinks(session, base, outDir, { prod = false } = {}) {
  const rows = [];
  await session.setViewport({ width: 390, height: 844, mobile: true });
  for (const slug of GAMES) {
    try {
      await session.goto(`${base}/${slug}/`, { wait: prod ? 2000 : 1600 });
      const before = await session.evaluate(`(() => {
        const el = document.getElementById('catalog-back');
        if (!el) return { found: false };
        const b = el.getBoundingClientRect();
        return { found: true, place: el.dataset.place || '', visible: b.width > 0 && b.height > 0, href: el.getAttribute('href') };
      })()`);
      const click = await clickBacklink(session);
      rows.push({ slug, before, click, errors: errorsOf(session) });
      if (!prod) await session.screenshot(`${outDir}/click-${slug}-390x844.png`).catch(() => null);
    } catch (e) {
      rows.push({ slug, fatal: String(e && e.message || e) });
    }
  }
  return rows;
}

async function startAndGraphics(session, outDir) {
  const out = [];
  await session.setViewport({ width: 1440, height: 900, mobile: false });
  for (const slug of GAMES) {
    try {
      await session.goto(`http://127.0.0.1:8098/${slug}/`, { wait: 1800 });
      const before = { canvas: await session.evaluate(CANVAS_EXPR), state: await session.evaluate(UI_STATE_EXPR) };
      await session.evaluate(`window.__qaKeys = []; window.addEventListener('keydown', function (e) { window.__qaKeys.push(e.code); }, true);`);
      await session.pressKey('Enter');
      await sleep(1200);
      const after = { canvas: await session.evaluate(CANVAS_EXPR), state: await session.evaluate(UI_STATE_EXPR) };
      const startedSignals = [];
      if (before.canvas?.hash !== after.canvas?.hash || before.canvas?.paint !== after.canvas?.paint) startedSignals.push('canvas');
      if (JSON.stringify(before.state) !== JSON.stringify(after.state)) startedSignals.push('ui');
      let startedBy = startedSignals.length ? 'Enter' : null;
      if (!startedBy) {
        const btn = await session.evaluate(`(() => {
          const el = [...document.querySelectorAll('button,a,[role=button]')].find((o) => {
            const t = (o.innerText || o.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
            const r = o.getBoundingClientRect();
            return r.width > 20 && r.height > 10 && /играть|начать|старт|play|start|новая сага/i.test(t) && !o.closest('#catalog-back');
          });
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40), x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()`);
        if (btn) {
          await clickAt(session, btn.x, btn.y);
          await sleep(1300);
          const after2 = { canvas: await session.evaluate(CANVAS_EXPR), state: await session.evaluate(UI_STATE_EXPR) };
          if (after2.canvas?.hash !== before.canvas?.hash) startedSignals.push('canvas-after-button');
          if (JSON.stringify(after2.state) !== JSON.stringify(before.state)) startedSignals.push('ui-after-button');
          startedBy = startedSignals.length ? 'button:' + btn.text : null;
        }
      }
      const keys = await session.evaluate('(window.__qaKeys || []).slice(-6)');
      const backVisible = await session.evaluate(`(() => { const el = document.getElementById('catalog-back'); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()`);
      const gBefore = { canvas: await session.evaluate(CANVAS_EXPR), state: await session.evaluate(UI_STATE_EXPR) };
      await session.evaluate(`window.__qaKeys = []`);
      await session.pressKey('g');
      await sleep(1000);
      const gAfter = { canvas: await session.evaluate(CANVAS_EXPR), state: await session.evaluate(UI_STATE_EXPR) };
      const gSignals = [];
      if (gBefore.canvas?.hash !== gAfter.canvas?.hash || gBefore.canvas?.paint !== gAfter.canvas?.paint) gSignals.push('canvas');
      if (JSON.stringify(gBefore.state) !== JSON.stringify(gAfter.state)) gSignals.push('ui');
      const gKeys = await session.evaluate('(window.__qaKeys || []).slice(-6)');
      out.push({ slug, started: startedSignals.length > 0, startedBy, startedSignals, keys, backVisibleAfterStart: backVisible, graphicsOk: gSignals.length > 0, gSignals, gKeys, errors: errorsOf(session) });
    } catch (e) {
      out.push({ slug, fatal: String(e && e.message || e) });
    }
  }
  return out;
}

async function fileChecks(session, outDir) {
  const out = {};
  await session.setViewport({ width: 1440, height: 900, mobile: false });
  for (const slug of ['boulder-dash', 'digger', 'lost-vikings-2']) {
    const fileUrl = `file://${WORKSPACE}/${slug}/index.html`;
    try {
      await session.goto(fileUrl, { wait: 1700 });
      const b = await session.evaluate(PLACEMENT_EXPR);
      const click = await clickBacklink(session);
      out[slug] = { fileUrl, hrefAttr: b.href, visible: b.visible, place: b.place, click, errors: errorsOf(session) };
      await session.screenshot(`${outDir}/file-${slug}.png`).catch(() => null);
    } catch (e) { out[slug] = { fileUrl, fatal: String(e && e.message || e) }; }
  }
  return out;
}

async function catalogRegression(session, base, { prod = false } = {}) {
  await session.setViewport({ width: 1440, height: 900, mobile: false });
  await session.goto(`${base}/`, { wait: 1800 });
  const before = await session.evaluate(`(async () => {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline && [...document.images].some((i) => i.naturalWidth === 0)) await new Promise((r) => setTimeout(r, 150));
    return { cards: document.querySelectorAll('#game-grid .card').length, theme: document.documentElement.getAttribute('data-theme'), thumbs: [...document.images].filter((i) => i.naturalWidth > 0).length, imgs: document.images.length };
  })()`);
  await session.pressKey('g');
  await sleep(900);
  const after = await session.evaluate(`({ theme: document.documentElement.getAttribute('data-theme'), pressed: document.querySelector('#theme-toggle')?.getAttribute('aria-pressed'), firstThumb: document.querySelector('#game-grid .card-img')?.getAttribute('src') || '' })`);
  return { before, after, errors: errorsOf(session) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    base: 'http://127.0.0.1:8098',
    prod: 'https://retro-games-psi.vercel.app',
    outDir: 'reports/qa-shots/backlink-fix',
    json: 'reports/qa-shots/backlink-fix/backlink-fix-audit.json',
  });
  if (args.help) { console.log('usage: node tools/qa/audit-backlink-fix.mjs [--base URL] [--prod URL] [--out-dir DIR] [--json FILE] [--skip-prod] [--only slugs]'); return; }
  const base = String(args.base).replace(/\/$/, '');
  const prod = !args.skipProd && args.prod ? String(args.prod).replace(/\/$/, '') : '';
  const only = args.only ? new Set(String(args.only).split(',').map((x) => x.trim()).filter(Boolean)) : null;
  mkdirSync(args.outDir, { recursive: true });

  const report = { when: new Date().toISOString(), base, prod, matrix: [], prodMatrix: [], p2: [], clicks: {}, prodClicks: [], start: [], file: {}, catalog: {}, prodVersion: [], external: [], errors: [] };
  const session = await launch({ width: 1440, height: 900 });

  try {
    // 1) версия на проде
    if (prod) {
      for (const slug of GAMES) {
        const res = await fetchText(`${prod}/${slug}/`);
        report.prodVersion.push({
          slug, status: res.status,
          hasBacklink: /data-catalog-back/.test(res.text || ''),
          hasAdaptive: /interactiveBoxes/.test(res.text || '') && /dataset\.place/.test(res.text || ''),
        });
      }
    }

    // 2) локальная матрица
    const localMatrix = await checkMatrix(session, base, { outDir: args.outDir, only });
    report.matrix = localMatrix.rows;
    report.screenshots = localMatrix.screenshots;

    // 3) P2 digger + клик по плашке на всех 11 (локально)
    report.p2 = await p2Digger(session, args.outDir);
    report.clicks.local = await clickAllBacklinks(session, base, args.outDir);

    // 4) регрессия: старт + G
    report.start = await startAndGraphics(session, args.outDir);

    // 5) file://
    report.file = await fileChecks(session, args.outDir);

    // 6) каталог локально
    report.catalog.local = await catalogRegression(session, base);

    // 7) прод-матрица + клики + каталог
    if (prod) {
      const prodMatrix = await checkMatrix(session, prod, { prod: true, only, outDir: args.outDir });
      report.prodMatrix = prodMatrix.rows;
      report.prodClicks = await clickAllBacklinks(session, prod, args.outDir, { prod: true });
      report.catalog.prod = await catalogRegression(session, prod, { prod: true });
    }

    // 8) агрегаты ошибок/внешних
    const allRows = [...report.matrix, ...report.prodMatrix];
    report.errors = allRows.filter((r) => r.errors && (r.errors.console.length || r.errors.page.length));
    report.external = allRows.filter((r) => r.external && r.external.length);
  } finally {
    await session.close();
  }

  // ── сводка ──
  const summarizeRow = (r) => {
    if (r.fatal) return { fatal: true };
    return {
      place: r.place, positionName: r.positionName, matchesExpected: r.matchesExpected,
      visible: r.visible, inViewport: r.inViewport, hscroll: r.hscroll,
      overlaps: (r.overlaps || []).length, blockedCenters: r.blockedCenters, centerHitsSelf: r.centerHitsSelf,
      textHits: (r.textHits || []).length,
    };
  };
  report.matrixSummary = report.matrix.map((r) => ({
    slug: r.slug, viewport: r.viewport, ...summarizeRow(r),
    overlapDetail: (r.overlaps || []).map((o) => ({ text: o.text, overlap: o.overlap, centerBlocked: o.centerBlocked })),
    textHitDetail: (r.textHits || []).map((t) => ({ tag: t.tag, cls: t.cls, text: t.text, areaRatio: t.areaRatio })),
    matchesExpected: r.matchesExpected,
  }));
  report.prodMatrixSummary = report.prodMatrix.map((r) => ({ slug: r.slug, viewport: r.viewport, ...summarizeRow(r) }));
  report.p2Summary = report.p2.map((p) => ({
    viewport: p.viewport,
    place: p.geo?.place,
    overlap: p.geo?.overlap,
    centerBlocked: p.geo?.centerBlocked,
    button: p.geo?.button,
    centerClickStayedOnGame: p.centerClick?.stayedOnGame,
    centerClickNavigatedToCatalog: p.centerClick?.navigatedToCatalog,
    centerClickUiChanged: p.centerClick?.uiChanged,
    backlinkClickCatalog: p.backlinkClick?.isCatalog,
    errors: p.errors,
  }));

  writeFileSync(args.json, JSON.stringify(report, null, 2));
  mkdirSync(args.outDir, { recursive: true });

  // ── краткий вывод ──
  const issues = report.matrixSummary.filter((r) => !r.fatal && (!r.visible || !r.inViewport || r.hscroll || r.overlaps > 0 || r.blockedCenters > 0 || r.matchesExpected === false));
  console.log('\n=== BACKLINK FIX AUDIT ===');
  console.log('matrix rows:', report.matrixSummary.length, '| rows with overlaps/blocked/expected-fail:', issues.length);
  for (const i of issues) console.log(' !', i.slug, i.viewport, 'place=', i.place, 'overlaps=', i.overlaps, 'blocked=', i.blockedCenters, 'expected=', i.matchesExpected);
  console.log('\nP2 digger:');
  for (const p of report.p2Summary) console.log(` ${p.viewport} place=${p.place} overlap=${JSON.stringify(p.overlap)} centerBlocked=${p.centerBlocked} centerClickStayed=${p.centerClickStayedOnGame} centerClickCatalog=${p.centerClickNavigatedToCatalog} backlinkClickCatalog=${p.backlinkClickCatalog}`);
  console.log('\nclicks local:', report.clicks.local.filter((c) => !c.click?.isCatalog).map((c) => c.slug), '| prod:', report.prodClicks.filter((c) => !c.click?.isCatalog).map((c) => c.slug));
  console.log('start fails:', report.start.filter((s) => !s.started).map((s) => s.slug), '| G fails:', report.start.filter((s) => !s.graphicsOk).map((s) => s.slug));
  console.log('file:', JSON.stringify(Object.fromEntries(Object.entries(report.file).map(([k, v]) => [k, { href: v.hrefAttr, visible: v.visible, catalog: v.click?.isCatalog }]))));
  console.log('catalog local:', JSON.stringify(report.catalog.local?.before), '| prod:', JSON.stringify(report.catalog.prod?.before || null));
  console.log('prod version ok:', report.prodVersion.filter((p) => p.status === 200 && p.hasBacklink && p.hasAdaptive).length, '/', report.prodVersion.length);
  console.log('errors rows:', report.errors.length, '| external rows:', report.external.length);
  console.log('JSON:', args.json);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
