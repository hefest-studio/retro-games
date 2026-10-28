#!/usr/bin/env node
/**
 * audit-gamefixes.mjs — финальная приёмка исправлений игр (task-7, коммит 91b76ee).
 *
 * 1) Contra: непрерывная стрельба (J/X; rifle/machine/spread/laser) — доверенный
 *    CDP keyDown, серия замеров __CONTRA.state().bullets, скриншоты с пулями.
 * 2) Lode Runner: кирпичи в row[13] на всех 10 уровнях, копание Z/X рядом,
 *    падение врага в вырытую яму, лог врагов (движение/падения/сквозь стены),
 *    standalone lode-runner.html. Проходимость уровней — tools/validate-levels.mjs.
 * 3) Регрессия: плашка «← Каталог» на 11 играх + standalone (прод, клик → каталог),
 *    мобильный digger 390×844 («НАСТРОЙКИ» открываются), каталог (G, 11 карточек).
 * 4) Прод отдаёт 91b76ee: фикс shootCd в contra, кирпичи y=13 в levels.js.
 *
 * Пишет reports/qa-shots/gamefixes/*.png и JSON рядом.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { launch, parseArgs, httpCheck } from './lib.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WORKSPACE = resolve('/Users/sergio/My/code/projects/retro_games');
const GAMES = ['river-raid', 'digger', 'lode-runner', 'boulder-dash', 'contra', 'exolon', 'the-last-mission', 'silkworm', 'lost-vikings', 'double-dragon-battletoads', 'lost-vikings-2'];
const BENIGN = [/AudioContext was not allowed to start/i, /favicon\.ico/i];
const isBenign = (t) => BENIGN.some((re) => re.test(t));
const errorsOf = (s) => ({ console: s.consoleErrors.filter((e) => !isBenign(e)), page: [...s.pageErrors], log: s.logErrors.filter((e) => !isBenign(e)) });

async function fetchText(url, attempts = 3) {
  let last;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { connection: 'close' } });
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

async function keyDown(session, code, key) {
  await session.cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown', key, code, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0), nativeVirtualKeyCode: key.toUpperCase().charCodeAt(0),
    text: key, unmodifiedText: key,
  });
}
async function keyUp(session, code, key) {
  await session.cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp', key, code, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0), nativeVirtualKeyCode: key.toUpperCase().charCodeAt(0),
  });
}

/* ------------------------------------------------------------------ Contra */

async function contraShooting(session, base, outDir, { prod = false } = {}) {
  const tag = prod ? 'prod' : 'local';
  const out = { url: `${base}/contra/`, prod, weapons: [], errors: null, external: [] };
  await session.setViewport({ width: 1440, height: 900, mobile: false });
  await session.goto(`${base}/contra/`, { wait: 2200 });
  out.api = await session.evaluate(`(() => Boolean(window.__CONTRA && window.__CONTRA.start && window.__CONTRA.state))()`);
  if (!out.api) { out.fatal = 'window.__CONTRA API не найден'; return out; }
  await session.evaluate(`window.__CONTRA.start(0)`);
  await sleep(500);
  out.startState = await session.evaluate(`window.__CONTRA.state()`);
  if (out.startState.mode !== 'play') {
    await session.evaluate(`window.__CONTRA.tick(2.5)`);
    await sleep(200);
    out.startState = await session.evaluate(`window.__CONTRA.state()`);
  }

  const sampleExpr = (ms, step) => `(async () => {
    const out = [];
    const t0 = performance.now();
    while (performance.now() - t0 < ${ms}) {
      const st = window.__CONTRA.state();
      out.push({ t: Math.round(performance.now() - t0), bullets: st.bullets, player: st.player });
      await new Promise((r) => setTimeout(r, ${step}));
    }
    return out;
  })()`;

  const testFire = async (weapon, code, key) => {
    const rec = { weapon, key: `${code}/${key}` };
    await session.evaluate(`window.__CONTRA.start(0)`);
    await sleep(250);
    await session.evaluate(`window.__CONTRA.tick(0.6)`);
    await session.evaluate(`window.__CONTRA.giveWeapon(${JSON.stringify(weapon)})`);
    await sleep(250);
    const before = await session.evaluate(`window.__CONTRA.state()`);
    rec.before = { bullets: before.bullets, weapon: before.player?.weapon };
    await keyDown(session, code, key);
    await sleep(650);
    rec.screenshot = await session.screenshot(`${outDir}/contra-${tag}-${weapon}-${key}.png`);
    rec.series = await session.evaluate(sampleExpr(750, 50));
    await keyUp(session, code, key);
    await sleep(250);
    const maxBullets = Math.max(0, ...rec.series.map((s) => s.bullets));
    let increases = 0;
    let prev = rec.before.bullets;
    for (const s of rec.series) {
      if (s.bullets > prev) increases += 1;
      prev = s.bullets;
    }
    rec.maxBullets = maxBullets;
    rec.increases = increases;
    rec.everPositive = maxBullets > 0;
    rec.continuous = rec.everPositive && increases >= 2;
    return rec;
  };

  try {
    out.weapons.push(await testFire('rifle', 'KeyJ', 'j'));
    out.weapons.push(await testFire('rifle', 'KeyX', 'x'));
    out.weapons.push(await testFire('machine', 'KeyJ', 'j'));
    out.weapons.push(await testFire('spread', 'KeyJ', 'j'));
    out.weapons.push(await testFire('laser', 'KeyJ', 'j'));
  } catch (e) {
    out.fatal = String(e && e.message || e);
  }
  out.errors = errorsOf(session);
  out.external = externalHosts(session.requests, ['127.0.0.1', 'localhost', '[::1]', '::1', new URL(base).hostname]);
  return out;
}

/* -------------------------------------------------------------- Lode Runner */

async function lodeRunnerChecks(session, base, outDir, { prod = false, path = '/lode-runner/', name = 'local' } = {}) {
  const tag = prod ? 'prod' : 'local';
  const out = { url: `${base}${path}`, prod, path, name };
  await session.setViewport({ width: 1440, height: 900, mobile: false });
  await session.goto(`${base}${path}`, { wait: 2200 });
  out.api = await session.evaluate(`(() => Boolean(window.__LODE && window.__LODE.game))()`);
  if (!out.api) { out.fatal = 'window.__LODE API не найден'; return out; }
  out.levelsBricks = await session.evaluate(`(() => {
    const levels = window.__LODE.levels || [];
    return {
      levels: levels.length,
      row13: levels.map((l) => String(l.rows && l.rows[13] || '')),
      bricks13: levels.map((l) => (String(l.rows && l.rows[13] || '').match(/=/g) || []).length),
      allHaveBricks13: levels.length === 10 && levels.every((l) => /./.test(String(l.rows && l.rows[13] || '')) && String(l.rows[13]).includes('=')),
    };
  })()`);

  // Enter → старт уровня 1
  await session.pressKey('Enter');
  await sleep(1000);
  out.started = await session.evaluate(`(() => {
    const g = window.__LODE.game;
    return {
      state: g.state, level: g.levelIndex + 1,
      base13: (g.base[13] || []).join(''),
      bricks13: (g.base[13] || []).filter((c) => c === '=').length,
      enemies: g.enemies.map((e) => ({ x: e.x, y: e.y, state: e.state })),
      player: { x: g.player.x, y: g.player.y },
    };
  })()`);
  out.screenshotStart = await session.screenshot(`${outDir}/loderunner-${tag}-start-1440.png`);

  // Копание: ставим игрока над кирпичом (10,12), над brick (9,13)/(10,13); Z → hole 9,13
  out.dig = await session.evaluate(`(() => {
    const g = window.__LODE.game;
    g.freeze = 0;
    g.player.x = 10; g.player.y = 12; g.player.px = 10; g.player.py = 12;
    g.player.move = null; g.player.state = 'idle'; g.player.digSide = 0; g.player.digT = 0;
    return { brickLeft: g.tileAt(9, 13), brickRight: g.tileAt(11, 13), before: g.tileAt(9, 13) };
  })()`);
  await keyDown(session, 'KeyZ', 'z');
  await sleep(80);
  await keyUp(session, 'KeyZ', 'z');
  await sleep(500);
  out.dig.afterZ = await session.evaluate(`(() => {
    const g = window.__LODE.game;
    return { tile: g.tileAt(9, 13), hasHole: g.holes.has('9,13'), holes: g.holes.size, playerState: g.player.state };
  })()`);
  out.dig.screenshot = await session.screenshot(`${outDir}/loderunner-${tag}-dig-hole-1440.png`);

  // X-копание с другой стороны: игрок (14,12) → brick (15,13)
  out.dig2 = await session.evaluate(`(() => {
    const g = window.__LODE.game;
    g.player.x = 14; g.player.y = 12; g.player.px = 14; g.player.py = 12;
    g.player.move = null; g.player.state = 'idle'; g.player.digT = 0;
    return { brickRight: g.tileAt(15, 13) };
  })()`);
  await keyDown(session, 'KeyX', 'x');
  await sleep(80);
  await keyUp(session, 'KeyX', 'x');
  await sleep(500);
  out.dig2.afterX = await session.evaluate(`(() => {
    const g = window.__LODE.game;
    return { tile: g.tileAt(15, 13), hasHole: g.holes.has('15,13'), holes: g.holes.size };
  })()`);

  // Враг может упасть в яму: ставим врага над вырытой ямой (9,13)
  out.enemyFall = await session.evaluate(`(async () => {
    const g = window.__LODE.game;
    if (!g.enemies.length) return { noEnemy: true };
    const en = g.enemies[0];
    en.x = 9; en.y = 12; en.px = 9; en.py = 12; en.move = null; en.state = 'idle'; en.path = null;
    const states = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 2500) {
      states.push({ t: Math.round(performance.now() - t0), state: en.state, x: en.x, y: en.y, holes: g.holes.size });
      await new Promise((r) => setTimeout(r, 100));
    }
    return { states, fell: states.some((s) => s.state === 'fall' || s.state === 'hole'), dead: states.some((s) => s.state === 'dead') };
  })()`, { timeout: 20000 });

  // Лог врагов: перезапуск уровня 1 (без вмешательства), 5 с с шагом 50 мс
  await session.goto(`${base}${path}`, { wait: 1800 });
  await session.pressKey('Enter');
  await sleep(1800);
  out.enemyLog = await session.evaluate(`(async () => {
    const g = window.__LODE.game;
    const log = [];
    const per = {};
    const t0 = performance.now();
    while (performance.now() - t0 < 5000) {
      const t = Math.round(performance.now() - t0);
      const row = { t, state: g.state, holes: g.holes.size, enemies: [] };
      for (const e of g.enemies) {
        const solid = g.isPassable(e.x, e.y);
        let illegal = false;
        if (!per[e.id]) per[e.id] = { cell: { x: e.x, y: e.y }, lastPx: e.px, lastPy: e.py, lastChangeT: t, maxStall: 0, stalls: 0, changes: 0, falls: 0, illegal: 0, solid: 0, states: new Set() };
        const p = per[e.id];
        if (p.cell && (e.x !== p.cell.x || e.y !== p.cell.y)) {
          const moves = g._enemyMoves(p.cell.x, p.cell.y);
          if (!moves.some((m) => m.land.x === e.x && m.land.y === e.y)) illegal = true;
        }
        p.states.add(e.state);
        if (!solid) p.solid += 1;
        if (illegal) p.illegal += 1;
        if (e.state === 'fall') p.falls += 1;
        const moved = Math.abs(e.px - p.lastPx) > 0.001 || Math.abs(e.py - p.lastPy) > 0.001;
        const movingState = e.state === 'walk' || e.state === 'climb' || e.state === 'fall';
        if (moved) {
          p.changes += 1;
          const stall = t - p.lastChangeT;
          if (movingState) {
            if (stall > p.maxStall) p.maxStall = stall;
            if (stall > 100) p.stalls += 1;
          }
          p.lastChangeT = t;
          p.lastPx = e.px; p.lastPy = e.py;
        }
        p.cell = { x: e.x, y: e.y };
        if (movingState) p.movingSamples = (p.movingSamples || 0) + 1;
        row.enemies.push({ id: e.id, x: e.x, y: e.y, px: +e.px.toFixed(3), py: +e.py.toFixed(3), state: e.state, moving: Boolean(e.move), solid, illegal });
      }
      log.push(row);
      await new Promise((r) => setTimeout(r, 50));
    }
    const perObj = {};
    for (const id of Object.keys(per)) {
      const p = per[id];
      perObj[id] = { changes: p.changes, movingSamples: p.movingSamples || 0, maxStallMs: p.maxStall, stallsOver100ms: p.stalls, falls: p.falls, illegalMoves: p.illegal, solidViolations: p.solid, states: [...p.states] };
    }
    return {
      sampleCount: log.length,
      per: perObj,
      summary: {
        enemies: Object.keys(per).length,
        totalChanges: Object.values(perObj).reduce((a, b) => a + b.changes, 0),
        maxStallMs: Math.max(0, ...Object.values(perObj).map((p) => p.maxStallMs)),
        stallsOver100ms: Object.values(perObj).reduce((a, b) => a + b.stallsOver100ms, 0),
        fallsWithoutHoles: log.filter((r) => r.holes === 0 && r.enemies.some((e) => e.state === 'fall')).length,
        solidViolations: Object.values(perObj).reduce((a, b) => a + b.solidViolations, 0),
        illegalMoves: Object.values(perObj).reduce((a, b) => a + b.illegalMoves, 0),
      },
      sampleRows: log.slice(0, 4),
    };
  })()`, { timeout: 25000 });

  out.errors = errorsOf(session);
  out.external = externalHosts(session.requests, ['127.0.0.1', 'localhost', '[::1]', '::1', new URL(base).hostname]);
  return out;
}

/* ------------------------------------------------------------------ regression */

async function prodBacklink(session, prod, outDir) {
  const out = [];
  await session.setViewport({ width: 1440, height: 900, mobile: false });
  for (const slug of [...GAMES, 'lode-runner/lode-runner.html']) {
    const url = `${prod}/${slug}${slug.endsWith('.html') ? '' : '/'}`;
    try {
      await session.goto(url, { wait: 1700 });
      const presence = await session.evaluate(`(() => {
        const el = document.getElementById('catalog-back');
        if (!el) return { found: false };
        const r = el.getBoundingClientRect();
        return { found: true, visible: r.width > 0 && r.height > 0, place: el.dataset.place || '' };
      })()`);
      const loaded = session.waitEvent('Page.loadEventFired', 12000);
      await session.click('#catalog-back').catch(() => null);
      await loaded.catch(() => null);
      await sleep(800);
      const nav = await session.evaluate(`({ url: location.href, cards: document.querySelectorAll('#game-grid .card').length, isCatalog: Boolean(document.querySelector('#game-grid')) && document.querySelectorAll('#game-grid .card').length >= 11 })`);
      out.push({ slug, presence, nav, errors: errorsOf(session) });
    } catch (e) {
      out.push({ slug, fatal: String(e && e.message || e) });
    }
  }
  return out;
}

async function diggerMobile(session, base, outDir, { prod = false } = {}) {
  const tag = prod ? 'prod' : 'local';
  await session.setViewport({ width: 390, height: 844, mobile: true });
  await session.goto(`${base}/digger/`, { wait: 1800 });
  const geo = await session.evaluate(`(() => {
    const el = document.getElementById('catalog-back');
    const btn = [...document.querySelectorAll('button,a')].find((o) => /НАСТРОЙКИ/i.test(o.innerText || ''));
    const br = el.getBoundingClientRect();
    const r = btn.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const c = document.elementFromPoint(cx, cy);
    return {
      place: el.dataset.place || '',
      backlink: { x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height) },
      button: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), center: { x: Math.round(cx), y: Math.round(cy) } },
      centerBlocked: Boolean(c && (c === el || el.contains(c))),
      centerHits: c ? c.tagName : null,
    };
  })()`);
  const before = await session.evaluate(`({ url: location.href, text: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80) })`);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await session.cdp.send('Input.dispatchMouseEvent', { type, x: geo.button.center.x, y: geo.button.center.y, button: 'left', clickCount: 1 });
  }
  await sleep(1000);
  const after = await session.evaluate(`({ url: location.href, text: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 200) })`);
  const settingsOpened = after.url === before.url && /НАСТРОЙКИ/.test(after.text) && after.text !== before.text;
  const shot = await session.screenshot(`${outDir}/digger-${tag}-390x844-settings.png`);
  const back = await (async () => {
    const loaded = session.waitEvent('Page.loadEventFired', 12000);
    await session.click('#catalog-back').catch(() => null);
    await loaded.catch(() => null);
    await sleep(800);
    return session.evaluate(`({ cards: document.querySelectorAll('#game-grid .card').length, isCatalog: Boolean(document.querySelector('#game-grid')) })`);
  })();
  return { geo, settingsOpened, stayedOnGame: after.url === before.url, backlinkToCatalog: back, shot, errors: errorsOf(session) };
}

async function catalogChecks(session, base, { prod = false } = {}) {
  await session.setViewport({ width: 1440, height: 900, mobile: false });
  await session.goto(`${base}/`, { wait: 2000 });
  const before = await session.evaluate(`(async () => {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline && [...document.images].some((i) => i.naturalWidth === 0)) await new Promise((r) => setTimeout(r, 150));
    return {
      cards: document.querySelectorAll('#game-grid .card').length,
      theme: document.documentElement.getAttribute('data-theme'),
      thumbLoaded: [...document.images].filter((i) => i.naturalWidth > 0).length,
      thumbTotal: document.images.length,
      links: [...document.querySelectorAll('#game-grid a[href]')].map((a) => a.getAttribute('href')),
    };
  })()`);
  await session.pressKey('g');
  await sleep(900);
  const after = await session.evaluate(`({ theme: document.documentElement.getAttribute('data-theme'), pressed: document.querySelector('#theme-toggle')?.getAttribute('aria-pressed') })`);
  const links = [];
  for (const href of before.links) links.push(await httpCheck(`${base}/${href}`));
  return { before, after, links, errors: errorsOf(session) };
}

/* ---------------------------------------------------------------------- main */

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    base: 'http://127.0.0.1:8098',
    prod: 'https://retro-games-psi.vercel.app',
    outDir: 'reports/qa-shots/gamefixes',
    json: 'reports/qa-shots/gamefixes/gamefixes-audit.json',
    skipProd: false,
  });
  if (args.help) { console.log('usage: node tools/qa/audit-gamefixes.mjs [--base URL] [--prod URL] [--skip-prod]'); return; }
  const base = String(args.base).replace(/\/$/, '');
  const prod = args.skipProd ? '' : String(args.prod).replace(/\/$/, '');
  mkdirSync(args.outDir, { recursive: true });
  const report = { when: new Date().toISOString(), base, prod, contra: {}, lodeRunner: {}, regression: {}, prodVersion: {} };
  const session = await launch({ width: 1440, height: 900 });

  try {
    // 1) Contra
    report.contra.local = await contraShooting(session, base, args.outDir, { prod: false });
    if (prod) report.contra.prod = await contraShooting(session, prod, args.outDir, { prod: true });

    // 2) Lode Runner (+ standalone)
    report.lodeRunner.local = await lodeRunnerChecks(session, base, args.outDir, { prod: false });
    report.lodeRunner.standalone = await lodeRunnerChecks(session, base, args.outDir, { prod: false, path: '/lode-runner/lode-runner.html', name: 'standalone' });
    if (prod) report.lodeRunner.prod = await lodeRunnerChecks(session, prod, args.outDir, { prod: true });
    if (prod) report.lodeRunner.prodStandalone = await lodeRunnerChecks(session, prod, args.outDir, { prod: true, path: '/lode-runner/lode-runner.html', name: 'prod-standalone' });

    // 3) Регрессия
    if (prod) report.regression.backlinkProd = await prodBacklink(session, prod, args.outDir);
    report.regression.diggerLocal = await diggerMobile(session, base, args.outDir, { prod: false });
    if (prod) report.regression.diggerProd = await diggerMobile(session, prod, args.outDir, { prod: true });
    report.regression.catalogLocal = await catalogChecks(session, base);
    if (prod) report.regression.catalogProd = await catalogChecks(session, prod, { prod: true });

    // 4) Прод-версия
    if (prod) {
      const paths = [...GAMES.map((s) => `/${s}/`), '/lode-runner/lode-runner.html'];
      report.prodVersion.pages = [];
      for (const p of paths) {
        const r = await httpCheck(`${prod}${p}`);
        report.prodVersion.pages.push({ path: p, status: r.status, contentType: r.contentType });
      }
      const contraHtml = await fetchText(`${prod}/contra/`);
      let contraSrc = { text: '', status: 0 };
      const shootFixRe = /Math\.max\(0,\s*p\.shootCd\s*-\s*dt\)/;
      if (!shootFixRe.test(contraHtml.text || '')) contraSrc = await fetchText(`${prod}/contra/src/game.js`);
      report.prodVersion.contra = {
        status: contraHtml.status,
        bytes: (contraHtml.text || '').length,
        hasShootCdFix: shootFixRe.test(contraHtml.text || '') || shootFixRe.test(contraSrc.text || ''),
        hasShootCd: /shootCd/.test(contraHtml.text || '') || /shootCd/.test(contraSrc.text || ''),
        source: shootFixRe.test(contraHtml.text || '') ? 'inline' : (contraSrc.status ? 'src/game.js' : 'none'),
      };
      const levelsJs = await fetchText(`${prod}/lode-runner/js/levels.js`);
      let levelsParsed = null;
      try {
        const sandbox = { window: {} };
        vm.createContext(sandbox);
        vm.runInContext(levelsJs.text, sandbox);
        const levels = sandbox.window.LR_LEVELS || [];
        levelsParsed = {
          levels: levels.length,
          bricks13: levels.map((l) => (String(l.rows && l.rows[13] || '').match(/=/g) || []).length),
          allHaveBricks13: levels.length >= 10 && levels.every((l) => String(l.rows && l.rows[13] || '').includes('=')),
        };
      } catch (e) { levelsParsed = { error: String(e && e.message || e) }; }
      report.prodVersion.levels = { status: levelsJs.status, ...levelsParsed };
    }
  } finally {
    await session.close();
  }

  writeFileSync(args.json, JSON.stringify(report, null, 2));

  // ── сводка ──
  const c = report.contra;
  const line = (tag, x) => {
    if (!x) return console.log(`${tag}: —`);
    if (x.fatal) return console.log(`${tag}: FATAL ${x.fatal}`);
    console.log(`${tag}: api=${x.api} weapons=${x.weapons.map((w) => `${w.weapon}/${w.key}:max=${w.maxBullets},inc=${w.increases}${w.continuous ? '' : ' FAIL'}`).join(' ')} errors=${x.errors.console.length}/${x.errors.page.length}`);
  };
  console.log('\n=== CONTRA ===');
  line('local', c.local); line('prod', c.prod);
  console.log('\n=== LODE RUNNER ===');
  for (const [k, v] of Object.entries(report.lodeRunner)) {
    if (!v) continue;
    if (v.fatal) { console.log(k, 'FATAL', v.fatal); continue; }
    console.log(k, `started=${v.started?.state}/${v.started?.level} bricks13=${v.started?.bricks13} digZ=${JSON.stringify(v.dig?.afterZ)} digX=${JSON.stringify(v.dig2?.afterX)} enemyFell=${v.enemyFall?.fell} enemyStats=${JSON.stringify(v.enemyLog?.summary)} errors=${v.errors.console.length}/${v.errors.page.length}`);
  }
  console.log('\n=== REGRESSION ===');
  console.log('backlink prod:', (report.regression.backlinkProd || []).map((r) => `${r.slug}:${r.presence?.found}/${r.nav?.isCatalog}`).join(' '));
  console.log('digger local:', JSON.stringify({ place: report.regression.diggerLocal?.geo?.place, settingsOpened: report.regression.diggerLocal?.settingsOpened, back: report.regression.diggerLocal?.backlinkToCatalog?.isCatalog }));
  console.log('digger prod:', JSON.stringify({ place: report.regression.diggerProd?.geo?.place, settingsOpened: report.regression.diggerProd?.settingsOpened }));
  console.log('catalog local:', JSON.stringify({ cards: report.regression.catalogLocal?.before?.cards, themeAfterG: report.regression.catalogLocal?.after?.theme, links200: report.regression.catalogLocal?.links?.filter((l) => l.status === 200).length }));
  console.log('catalog prod:', JSON.stringify({ cards: report.regression.catalogProd?.before?.cards, themeAfterG: report.regression.catalogProd?.after?.theme, links200: report.regression.catalogProd?.links?.filter((l) => l.status === 200).length }));
  console.log('\n=== PROD VERSION ===');
  console.log('pages200:', (report.prodVersion.pages || []).filter((p) => p.status === 200).length, '/', (report.prodVersion.pages || []).length);
  console.log('contra fix:', JSON.stringify(report.prodVersion.contra), '| levels:', JSON.stringify(report.prodVersion.levels));
  console.log('JSON:', args.json);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
