#!/usr/bin/env node
/* tools/touch-sweep.browser.mjs — проход по ВСЕМ играм каталога с тач-пультом (движок v2.10, Arcade.touchOk).
   Запуск: node tools/touch-sweep.browser.mjs [slug …] [--port 8514] [--skip slug,slug] [--shared] [--json файл]
     без slug — все игры из assets/catalog/games.json; --skip — исключить (папки, которые сейчас переделываются);
     --shared — отдавать _shared/engine.js вместо <игра>/engine.js (до bash build.sh); --json — записать результаты.
   Свой статический сервер (127.0.0.1:<port>, корень — репо), один браузер на весь прогон, телефон 390×844 (isMobile+hasTouch).
   Что делает: старт игры (тап по «Играть», затем Enter); собирает тач-цели — элементы, на которые КОД ИГРЫ повесил touch*-слушатель
   (кроме window/document/body), + button, [data-d], [data-act]; по каждой — тапы на 3 px за краями (сверху, снизу, слева, справа: такое
   касание Chrome шлёт НЕотменяемым, цель подбирает touch adjustment, следом идёт эмуляция мыши) и по центру.
   Ждём (иначе FAIL):
     · 0 «Ignored attempt to cancel a touch…» в консоли и 0 вызовов preventDefault у неотменяемых касаний (с виновником);
     · 0 двойных нажатий: в одном касании на элементе отработал touch-слушатель игры (позвал touchOk/preventDefault) и ещё mouse/click-
       слушатель игры на том же элементе, не отсеянный Arcade.touchOk (вернул false) — значит, эмуляция мыши дала второе нажатие;
       у кнопок тач-дпада движка [data-d] — не больше одного нажатия на касание;
     · эффективный touch-action у каждой тач-цели игры — none (у неё или у предка: [data-arcade-touch] / CSS игры);
     · 0 pageerror; страница не прокрутилась и не зумится.
   Игры без тач-целей (только холст движка / свой pointer-ввод) — «нет тач-пульта», не провал. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const av = process.argv.slice(2);
const opt = (k, d) => { const i = av.indexOf('--' + k); return i >= 0 ? av[i + 1] : d; };
const SHARED = av.includes('--shared'), PORT = +opt('port', 8514), JSON_OUT = opt('json', '');
const SKIPS = new Set(String(opt('skip', '')).split(',').filter(Boolean));
const VALUED = new Set(['--port', '--skip', '--json']);
let SLUGS = av.filter((a, i) => !a.startsWith('--') && !VALUED.has(av[i - 1]));
if (!SLUGS.length) SLUGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/catalog/games.json'), 'utf8')).games.map((g) => g.slug);
SLUGS = SLUGS.filter((s) => !SKIPS.has(s) && fs.existsSync(path.join(ROOT, s, 'index.html')));
const ENG = fs.readFileSync(path.join(ROOT, '_shared/engine.js'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const server = http.createServer((q, s) => {
  let u = decodeURIComponent(q.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
  const f = path.join(ROOT, path.normalize(u)); if (!f.startsWith(ROOT)) { s.writeHead(403); return s.end(); }
  if (SHARED && /\/engine\.js$/.test(u) && !u.startsWith('/_shared/')) { s.writeHead(200, { 'content-type': TYPES['.js'] }); return s.end(ENG); }
  fs.readFile(f, (e, b) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); s.end(b); });
});
await new Promise((r, j) => { server.once('error', j); server.listen(PORT, '127.0.0.1', r); });
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// До скриптов игры: слушатели касаний/мыши, повешенные кодом игры (не engine.js), оборачиваются — считаем, кто сработал за касание.
const INSTR = () => {
  const S = window.__ts = { bad: [], tap: 0, hits: {}, doubles: [], emits: 0, n: 0 };
  const pd = Event.prototype.preventDefault;
  let depth = 0, cur = null;
  Event.prototype.preventDefault = function () {
    if (cur) cur.pd = true;
    if (!this.cancelable && /^touch/.test(this.type) && S.bad.length < 10) S.bad.push(this.type + ' ' + ((new Error().stack || '').split('\n')[2] || '').trim().replace(location.origin, ''));
    return pd.call(this);
  };
  const id = (el) => { if (!el.__tsId) el.__tsId = 'e' + (++S.n); return el.__tsId; };
  const ael = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, o) {
    if (typeof fn === 'function' && /^(touch|mouse|click)/.test(type) && this instanceof Element && this !== document.body && this !== document.documentElement) {
      const st = new Error().stack || '';
      const caller = (st.split('\n').slice(2).find((l) => !/touch-sweep/.test(l)) || '');
      if (!/\/engine\.js/.test(caller)) {
        const el = this; id(el); el.__tsGame = el.__tsGame || {}; el.__tsGame[type] = 1;
        const w = function (e) {
          const prev = cur; cur = { okFalse: false, ok: false, pd: false }; depth++;
          try { return fn.apply(this, arguments); } finally {
            const c = cur; cur = prev; depth--;
            const k = S.tap + ':' + el.__tsId, h = S.hits[k] = S.hits[k] || { touch: false, mouse: [] };
            if (/^touch/.test(e.type)) { if (c.ok || c.pd) h.touch = true; }
            else if (/^(mousedown|mouseup|click)$/.test(e.type) && !c.okFalse) h.mouse.push(e.type);
          }
        };
        fn.__tsW = w; return ael.call(this, type, w, o);
      }
    }
    return ael.call(this, type, fn, o);
  };
  const rel = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.removeEventListener = function (type, fn, o) { return rel.call(this, type, (fn && fn.__tsW) || fn, o); };
  // Arcade.touchOk из кода игры: обёртка ставится, как только движок объявил Arcade
  let A;
  Object.defineProperty(window, 'Arcade', { configurable: true, get: () => A, set: (v) => {
    A = v;
    if (v && typeof v.touchOk === 'function' && !v.touchOk.__ts) {
      const t = v.touchOk; const w = function (e) { const r = t.apply(this, arguments); if (cur) { if (r === false) cur.okFalse = true; else cur.ok = true; } return r; }; w.__ts = 1;
      try { v.touchOk = w; } catch (er) {}
    }
  } });
};

const scene = (p) => p.evaluate(() => window.Arcade && Arcade.last ? Arcade.last._sceneName : null).catch(() => null);
const browser = await chromium.launch();
const results = []; let passed = 0, failed = 0, nopad = 0;

for (const slug of SLUGS) {
  const r = { slug, targets: 0, taps: 0, warn: [], bad: [], doubles: [], ta: [], perr: [], scroll: '', status: 'ok' };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (/Ignored attempt to cancel a touch/.test(m.text())) r.warn.push(m.text().slice(0, 90)); });
  p.on('pageerror', (e) => r.perr.push(String(e.message).slice(0, 160)));
  await p.addInitScript(INSTR);
  try {
    await p.goto(`${BASE}/${slug}/`, { waitUntil: 'load' }); await sleep(1200);
    const ver = await p.evaluate(() => window.Arcade && Arcade.version).catch(() => null);
    if (ver !== '2.10.0') r.notes = `движок ${ver} (нужен 2.10.0: bash build.sh или --shared)`;
    const pt = await p.evaluate(() => { const g = Arcade.last; if (!g || !g.canvas) return null; const rc = g.canvas.getBoundingClientRect(), m = g.current && g.current._menu; const it = m && m.items && (m.items.find((x) => x.key === 'play') || m.items[0]); return { x: rc.left + rc.width / 2, y: it && it._y != null ? rc.top + (it._y - 6) * rc.height / g.H : rc.top + rc.height / 2 }; }).catch(() => null);
    if (pt) { await p.touchscreen.tap(pt.x, pt.y); await sleep(700); }
    for (let k = 0; k < 3; k++) { const sc = await scene(p); if (sc === 'play') break; await p.keyboard.press('Enter'); await sleep(450); }
    await p.evaluate(() => { const g = window.Arcade && Arcade.last; if (!g || !g.input) return; const i = g.input, o = i._emit; i._emit = function (a) { window.__ts.emits++; return o.call(this, a); }; }).catch(() => {});
    const targets = await p.evaluate(() => {
      const els = new Set([...document.querySelectorAll('button, [data-d], [data-act]')]);
      document.querySelectorAll('*').forEach((el) => { if (el.__tsGame && Object.keys(el.__tsGame).some((t) => /^touch/.test(t))) els.add(el); });
      const eff = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const t = getComputedStyle(e).touchAction; if (t === 'none') return 'none'; } return getComputedStyle(el).touchAction; };
      return [...els].filter((el) => !el.closest('a[href]')).map((el) => { const rc = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return { id: el.__tsId || '', name: (el.id ? '#' + el.id : el.tagName.toLowerCase()) + (el.getAttribute('data-d') ? `[data-d=${el.getAttribute('data-d')}]` : el.getAttribute('data-act') ? `[data-act=${el.getAttribute('data-act')}]` : el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''),
          d: el.getAttribute('data-d'), game: !!(el.__tsGame && Object.keys(el.__tsGame).some((t) => /^touch/.test(t))), canvas: el.tagName === 'CANVAS', ta: eff(el),
          x: rc.left + rc.width / 2, y: rc.top + rc.height / 2, l: rc.left, r: rc.right, t: rc.top, b: rc.bottom, w: rc.width, h: rc.height, vis: cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 };
      }).filter((b) => b.vis && b.w > 4 && b.h > 4 && b.b > 4 && b.t < innerHeight - 2 && b.r > 2 && b.l < innerWidth - 2);
    });
    r.targets = targets.length;
    for (const b of targets) if (b.game && !b.canvas && b.ta !== 'none') r.ta.push(`${b.name}: ${b.ta}`);
    for (const b of targets) {
      const pts = b.canvas ? [[b.x, b.y]] : [[b.x, b.t - 3], [b.x, b.b + 3], [b.l - 3, b.y], [b.r + 3, b.y], [b.x, b.y]];
      for (const [x, y] of pts) {
        if (x < 1 || y < 1 || x > 389 || y > 843) continue;
        const sc = await scene(p); if (sc === 'pause') await p.evaluate(() => Arcade.last.goto('play', { resume: true })).catch(() => {});
        const e0 = await p.evaluate(() => { const S = window.__ts; S.tap++; return S.emits; });
        await p.touchscreen.tap(x, y).catch(() => {}); await sleep(130); r.taps++;
        const st = await p.evaluate(() => { const S = window.__ts, out = []; for (const k in S.hits) { if (+k.split(':')[0] !== S.tap) continue; const h = S.hits[k]; if (h.touch && h.mouse.length) out.push(k.split(':')[1] + ' ' + h.mouse.join('+')); } return { d: out, e: S.emits }; });
        for (const d of st.d) { const t = targets.find((q) => q.id === d.split(' ')[0]); r.doubles.push(`${t ? t.name : d.split(' ')[0]} (${d.split(' ').slice(1).join(' ')}) @${Math.round(x)},${Math.round(y)}`); }
        if (b.d && x === b.x && y === b.y && st.e - e0 > 1) r.doubles.push(`${b.name}: нажатий ${st.e - e0}`);
        if (!p.url().startsWith(`${BASE}/${slug}/`)) { await p.goBack().catch(() => {}); await sleep(800); }
      }
    }
    const st = await p.evaluate(() => ({ bad: window.__ts.bad, sy: scrollY, scale: visualViewport ? visualViewport.scale : 1 }));
    r.bad = st.bad; if (!(st.sy === 0 && Math.abs(st.scale - 1) < 0.01)) r.scroll = `scrollY=${st.sy}, scale=${st.scale}`;
  } catch (e) { r.perr.push('прогон: ' + String(e && e.message || e).split('\n')[0]); }
  finally { await ctx.close(); }
  r.doubles = [...new Set(r.doubles)];
  const gameTargets = r.targets;
  if (r.warn.length || r.bad.length || r.doubles.length || r.ta.length || r.perr.length || r.scroll) { r.status = 'FAIL'; failed++; }
  else if (!gameTargets) { r.status = 'нет тач-пульта'; nopad++; } else passed++;
  results.push(r);
  console.log(`${r.status === 'FAIL' ? 'FAIL' : 'ok  '} ${slug}: целей ${r.targets}, касаний ${r.taps}` + (r.status === 'нет тач-пульта' ? ' — нет тач-пульта' : '') + (r.notes ? ' · ' + r.notes : '') +
    (r.warn.length ? ` · предупреждений Chrome: ${r.warn.length}` : '') + (r.bad.length ? ' · preventDefault у неотменяемых: ' + r.bad.slice(0, 2).join(' | ') : '') +
    (r.doubles.length ? ' · двойные: ' + r.doubles.slice(0, 4).join('; ') : '') + (r.ta.length ? ' · touch-action не none: ' + r.ta.slice(0, 4).join('; ') : '') +
    (r.perr.length ? ' · pageerror: ' + r.perr.slice(0, 2).join(' | ') : '') + (r.scroll ? ' · ' + r.scroll : ''));
}
await browser.close(); server.close();
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 1));
console.log(`\nигр: ${results.length}; ok ${passed}, без тач-пульта ${nopad}, FAIL ${failed}; касаний всего ${results.reduce((s, r) => s + r.taps, 0)}`);
process.exit(failed ? 1 : 0);
