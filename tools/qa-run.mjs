#!/usr/bin/env node
/* tools/qa-run.mjs — регулярный QA-прогон всего каталога аркады. Один запуск — один отчёт qa-report/<дата>.md + .json.
   Что проверяет (раздел «QA-прогон» в README репо):
     static   — каталог ↔ папки игр; копии общих файлов (engine.js во всех играх = _shared/engine.js, версия; host/mouse/кампании/площадка —
                там, где build.sh их пересинхронизирует); sitemap.xml и robots.txt; счётчики «N игр / N games» в RU/EN-страницах и README (EN и RU);
                запрещённые слова (tools/lib/banned-words.mjs) в файлах, которые попадают в сборку игры.
     tests    — <игра>/tests/*.test.mjs и _shared/tests/*.test.mjs: параллельно (--jobs, по умолчанию — число ядер), таймаут на файл
                (--timeout, 900 с), медленные (> --slow, 120 с) — жёлтым.
     browser  — Playwright, каждая игра в 390×844 (тач) и 1280×720: загрузка, 0 ошибок консоли/страницы, 0 ответов 4xx/5xx,
                звук не стартует без жеста, старт Enter (десктоп) / тап по «Играть» (телефон), автопауза и сон звука при потере фокуса,
                10 с случайного ввода без исключений, тексты canvas не вылезают за холст (проба fillText, как tools/promo/i18n-overflow.mjs;
                + EN-проход 390×844), нет горизонтального скролла страницы.
     catalog  — /, /en/ (1280×720 и 390×844): 0 ошибок, все карточки, счётчик, пейджинг (страницы, «на странице: все»), фильтры по жанрам,
                все ссылки на игры и картинки превью обеих тем — HTTP 200; sitemap — каждый адрес отдаётся локально.
     touch    — tools/touch-sweep.browser.mjs по тем же играм (порт --port + 1, свой браузер — после раздела browser): тапы у краёв и по
                центру каждой тач-цели — 0 «Ignored attempt to cancel a touch…», 0 двойных нажатий, touch-action:none у целей, без прокрутки/зума.
   Статусы: ok / warn (жёлтый: стоит посмотреть) / fail (красный). Код выхода 1 — есть красные.
   Запуск:  node tools/qa-run.mjs [--port 8463] [--only slug,slug] [--skip tests,browser,catalog,static,touch] [--jobs N] [--timeout 900]
                                  [--slow 120] [--input 10] [--pages 2] [--out qa-report]
   Сервер статики поднимается сам (127.0.0.1:<port>), браузер — один на прогон, вкладок одновременно — --pages. */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { scanBuild } from './lib/banned-words.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://arcade.hefest.ru';

// ---------- аргументы ----------
const A = { port: 8463, only: '', skip: '', jobs: Math.max(1, os.cpus().length), timeout: 900, slow: 120, input: 10, pages: 2, out: 'qa-report' };
{ const av = process.argv.slice(2);
  for (let i = 0; i < av.length; i++) {
    const k = av[i].replace(/^--/, '');
    if (k === 'help' || k === 'h') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]); process.exit(0); }
    if (!(k in A)) { console.error('неизвестный аргумент: ' + av[i]); process.exit(2); }
    const v = av[++i]; A[k] = typeof A[k] === 'number' ? Number(v) : v;
  } }
const SKIP = new Set(String(A.skip).split(',').filter(Boolean));
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/catalog/games.json'), 'utf8')).games;
const ALL = CATALOG.map((g) => g.slug);
const ONLY = String(A.only).split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
const SLUGS = ONLY.length ? ONLY : ALL;
const t0 = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sec = (ms) => Math.round(ms / 100) / 10;
const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');

// ---------- результаты ----------
// item: { area, target, check, status: ok|warn|fail, detail }
const R = { started: new Date().toISOString(), args: A, slugs: SLUGS.length, items: [], tests: [], browser: {}, timings: {} };
const add = (area, target, check, status, detail = '') => { R.items.push({ area, target, check, status, detail: String(detail).slice(0, 2000) }); };
const log = (...a) => console.log(...a);

// ---------- сервер статики ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
let srv = null;
function startServer() {
  srv = http.createServer((q, s) => {
    let u; try { u = decodeURIComponent(q.url.split('?')[0].split('#')[0]); } catch { s.writeHead(400); s.end(); return; }
    let f = path.join(ROOT, u);
    if (!f.startsWith(ROOT)) { s.writeHead(403); s.end(); return; }
    fs.stat(f, (e, st) => {
      if (!e && st.isDirectory()) {
        if (!u.endsWith('/')) { s.writeHead(301, { location: u + '/' + (q.url.includes('?') ? q.url.slice(q.url.indexOf('?')) : '') }); s.end(); return; }
        f = path.join(f, 'index.html');
      }
      fs.readFile(f, (e2, d) => {
        if (e2) { s.writeHead(404, { 'content-type': 'text/plain' }); s.end('404'); return; }
        s.writeHead(200, { 'content-type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' }); s.end(d);
      });
    });
  });
  return new Promise((res, rej) => { srv.once('error', rej); srv.listen(A.port, '127.0.0.1', res); });
}
const BASE = () => `http://127.0.0.1:${A.port}`;
async function status(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { redirect: 'follow' }); await r.arrayBuffer(); return r.status; } catch (e) { if (i === 2) return 'ERR ' + e.message; await sleep(100); }
  }
}

// ======================================================================
// 1. Статические проверки
// ======================================================================
function staticChecks() {
  const t = Date.now();
  // каталог ↔ папки
  const dirs = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.') && d.name !== 'en' && fs.existsSync(path.join(ROOT, d.name, 'index.html')))
    .map((d) => d.name);
  const missingDir = ALL.filter((s) => !dirs.includes(s)), notInCatalog = dirs.filter((d) => !ALL.includes(d));
  add('static', 'каталог', 'games.json ↔ папки игр', missingDir.length || notInCatalog.length ? 'fail' : 'ok',
    (missingDir.length ? 'нет папки: ' + missingDir.join(', ') + '. ' : '') + (notInCatalog.length ? 'папка без записи в каталоге: ' + notInCatalog.join(', ') : `${ALL.length} игр`));
  const dupe = ALL.filter((s, i) => ALL.indexOf(s) !== i);
  if (dupe.length) add('static', 'каталог', 'дубли slug', 'fail', dupe.join(', '));

  // копии общих файлов
  const shared = (f) => path.join(ROOT, '_shared', f);
  const engMd5 = md5(shared('engine.js'));
  const verOf = (f) => (/version:\s*'([\d.]+)'/.exec(fs.readFileSync(f, 'utf8')) || [])[1] || '?';
  const engVer = verOf(shared('engine.js'));
  const badEng = [], badCopies = [];
  for (const s of SLUGS) {
    const dir = path.join(ROOT, s), idx = path.join(dir, 'index.html');
    if (!fs.existsSync(idx)) continue;
    const html = fs.readFileSync(idx, 'utf8');
    if (/src="\.\/engine\.js"/.test(html)) {
      const f = path.join(dir, 'engine.js');
      if (!fs.existsSync(f)) badEng.push(`${s}: нет engine.js`);
      else if (md5(f) !== engMd5) badEng.push(`${s}: ${verOf(f)} (не совпадает с _shared ${engVer})`);
    } else badEng.push(`${s}: index.html не подключает ./engine.js`);
    const copies = [['host.js', null], ['mouse.js', 'Источник — _shared/mouse.js'], ['campaign-core.js', 'Источник — _shared/campaign-core.js'],
      ['campaign-ui-kit.js', 'Источник — _shared/campaign-ui-kit.js'], ['platform.js', 'Источник — _shared/platform.js']];
    for (const [name, mark] of copies) {
      const f = path.join(dir, 'js', name);
      if (!new RegExp(`src="\\./js/${name.replace('.', '\\.')}"`).test(html) || !fs.existsSync(f)) continue;
      if (mark && !fs.readFileSync(f, 'utf8').includes(mark)) continue; // своя версия игры, build.sh её не трогает
      if (md5(f) !== md5(shared(name))) badCopies.push(`${s}/js/${name}`);
    }
  }
  add('static', 'engine.js', `копии = _shared/engine.js (v${engVer})`, badEng.length ? 'fail' : 'ok', badEng.length ? badEng.join('; ') : `${SLUGS.length} игр, v${engVer}`);
  add('static', 'общие файлы', 'host/mouse/campaign/platform = _shared', badCopies.length ? 'fail' : 'ok', badCopies.length ? 'рассинхрон (build.sh перезапишет при сборке): ' + badCopies.join(', ') : 'совпадают');

  // sitemap.xml + robots.txt
  const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const smProblems = [];
  if (!/^<\?xml[^>]*\?>\s*<urlset[^>]*xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/.test(sm)) smProblems.push('нет XML-пролога или urlset с xmlns');
  const opened = (sm.match(/<url>/g) || []).length, closed = (sm.match(/<\/url>/g) || []).length;
  if (opened !== closed || opened !== locs.length) smProblems.push(`<url> ${opened} / </url> ${closed} / <loc> ${locs.length}`);
  const want = [`${SITE}/`, `${SITE}/en/`, ...ALL.map((s) => `${SITE}/${s}/`)];
  const lost = want.filter((u) => !locs.includes(u)), extra = locs.filter((u) => !want.includes(u));
  const dl = locs.filter((u, i) => locs.indexOf(u) !== i);
  if (lost.length) smProblems.push('нет в sitemap: ' + lost.map((u) => u.replace(SITE, '')).join(', '));
  if (extra.length) smProblems.push('лишние адреса: ' + extra.join(', '));
  if (dl.length) smProblems.push('дубли: ' + dl.join(', '));
  const badLm = [...sm.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]).filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d) || d > new Date().toISOString().slice(0, 10));
  if (badLm.length) smProblems.push('lastmod не дата или в будущем: ' + [...new Set(badLm)].join(', '));
  add('static', 'sitemap.xml', 'формат и полнота (/, /en/, все игры)', smProblems.length ? 'fail' : 'ok', smProblems.length ? smProblems.join('; ') : `${locs.length} адресов`);
  const rb = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  const rbProblems = [];
  if (!/^User-agent:\s*\*/mi.test(rb)) rbProblems.push('нет User-agent: *');
  if (/^Disallow:\s*\/\s*$/mi.test(rb)) rbProblems.push('Disallow: / — сайт закрыт');
  if (!new RegExp(`^Sitemap:\\s*${SITE.replace(/\./g, '\\.')}/sitemap\\.xml\\s*$`, 'mi').test(rb)) rbProblems.push('нет Sitemap: ' + SITE + '/sitemap.xml');
  add('static', 'robots.txt', 'User-agent, не закрыт, Sitemap', rbProblems.length ? 'fail' : 'ok', rbProblems.join('; ') || 'ok');

  // счётчики RU/EN
  const N = ALL.length;
  const count = (file, res) => {
    const p = path.join(ROOT, file); if (!fs.existsSync(p)) return [];
    const txt = fs.readFileSync(p, 'utf8'), bad = [];
    for (const re of res) for (const m of txt.matchAll(re)) if (+m[1] !== N) bad.push(`«${m[0].trim()}»`);
    return bad;
  };
  const RU = [/(\d+)\s+(?:оригинальн\S+\s+)?(?:браузерн\S+\s+)?(?:игр|игры|игра|аркад)(?![\p{L}])/giu, /(?:Показано|показано)\s+[\d–-]+\s+из\s+(\d+)/g, /(?:Всего|всего)\s+(\d+)/g];
  const EN = [/(\d+)\s+(?:original\s+)?(?:browser\s+)?(?:arcade\s+)?games\b/gi, /Showing\s+[\d–-]+\s+of\s+(\d+)/g];
  for (const [file, res] of [['index.html', [...RU, ...EN]], ['en/index.html', EN], ['README.md', EN], ['README.ru.md', RU]]) {
    const bad = count(file, res);
    add('static', file, `счётчики игр = ${N}`, bad.length ? 'fail' : 'ok', bad.length ? 'расходятся с games.json: ' + [...new Set(bad)].join(', ') : 'совпадают');
  }
  // EN-поля каталога
  const noEn = CATALOG.filter((g) => !g.title_en || !g.summary_en || !g.genre_en).map((g) => g.slug);
  add('static', 'games.json', 'RU/EN-поля карточек', noEn.length ? 'fail' : 'ok', noEn.length ? 'нет *_en: ' + noEn.join(', ') : `${N} карточек`);

  // запрещённые слова — файлы, которые попадают в сборку (как tools/platform-build.mjs: без tests/, *.md, *.mjs, legacy.html)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-bw-'));
  try {
    for (const s of SLUGS) {
      const src = path.join(ROOT, s); if (!fs.existsSync(src)) continue;
      const dst = path.join(tmp, s);
      (function copy(from, to) {
        fs.mkdirSync(to, { recursive: true });
        for (const d of fs.readdirSync(from, { withFileTypes: true })) {
          if (d.isDirectory()) { if (!['tests', 'node_modules', '.git', 'docs', 'reports', 'tmp'].includes(d.name)) copy(path.join(from, d.name), path.join(to, d.name)); continue; }
          if (!d.isFile() || /\.md$/i.test(d.name) || /^legacy\.html$/i.test(d.name) || /^\./.test(d.name) || /\.(mjs|log|orig|bak)$/i.test(d.name)) continue;
          if (/\.(html?|js|json)$/i.test(d.name)) fs.copyFileSync(path.join(from, d.name), path.join(to, d.name));
        }
      })(src, dst);
      const r = scanBuild(dst);
      const fmt = (f) => `${f.file}:${f.line} «${f.word}» (Яндекс ${f.req}) — ${JSON.stringify(f.text)}`;
      // строка-идентификатор ('demo' — значение флага издания, ключ) — не текст для игрока: жёлтым, решить вручную
      const ident = (e) => /— "[a-z_][a-z0-9_]*"$/.test(e);
      // У игр с js/edition.js публичное издание — демо по решению владельца: «демо» и «полная версия» здесь — его метка.
      // Издание для площадок собирает arcade-full (platform/prepare.mjs): подменяет эти строки и проверяет копию тем же
      // модулем banned-words (ошибка = сборка падает). Поэтому здесь — жёлтым, с пометкой.
      const demoEdition = fs.existsSync(path.join(src, 'js', 'edition.js'));
      const byDesign = (f) => demoEdition && (f.id === 'demo' || f.id === 'full-version');
      const errors = r.findings.filter((f) => f.level === 'error' && !byDesign(f)).map(fmt);
      const designed = r.findings.filter((f) => f.level === 'error' && byDesign(f)).map((e) => fmt(e) + ' [демо-издание; площадки — arcade-full]');
      const errs = errors.filter((e) => !ident(e)), soft = [...errors.filter(ident).map((e) => e + ' [идентификатор?]'), ...designed, ...r.warnings];
      add('static', s, 'запрещённые слова', errs.length ? 'fail' : soft.length ? 'warn' : 'ok',
        errs.length ? errs.slice(0, 8).join('; ') : soft.length ? 'проверить: ' + soft.slice(0, 5).join('; ') : '');
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  R.timings.static = sec(Date.now() - t);
}

// ======================================================================
// 2. Тесты игр
// ======================================================================
async function runTests() {
  const t = Date.now();
  const files = [];
  for (const s of [...(ONLY.length ? [] : ['_shared']), ...SLUGS]) {
    const d = path.join(ROOT, s, 'tests');
    if (!fs.existsSync(d)) { if (s !== '_shared') add('tests', s, 'есть тесты', 'fail', 'нет папки tests/'); continue; }
    const fl = fs.readdirSync(d).filter((f) => f.endsWith('.test.mjs')).sort();
    if (!fl.length && s !== '_shared') add('tests', s, 'есть тесты', 'fail', 'нет *.test.mjs');
    for (const f of fl) files.push({ slug: s, file: path.join(s, 'tests', f) });
  }
  // самые долгие (по прошлому отчёту; без него — по размеру файла) — первыми, чтобы не оставались хвостом
  files.sort((a, b) => fs.statSync(path.join(ROOT, b.file)).size - fs.statSync(path.join(ROOT, a.file)).size);
  try {
    const prev = fs.readdirSync(path.resolve(ROOT, A.out)).filter((f) => /^\d{4}-\d{2}-\d{2}.*\.json$/.test(f)).sort().pop();
    if (prev) { const pj = JSON.parse(fs.readFileSync(path.resolve(ROOT, A.out, prev), 'utf8')); const dur = Object.fromEntries((pj.tests || []).map((x) => [x.file, x.sec]));
      files.sort((a, b) => (dur[b.file] || 30) - (dur[a.file] || 30)); }
  } catch {}
  log(`tests: ${files.length} файлов, параллельно ${A.jobs}, таймаут ${A.timeout} с`);
  let i = 0, done = 0;
  const one = (job) => new Promise((res) => {
    const st = Date.now(); let out = '';
    const p = spawn(process.execPath, [job.file], { cwd: ROOT, env: { ...process.env, QA_RUN: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', (b) => { out += b; if (out.length > 400000) out = out.slice(-200000); });
    p.stderr.on('data', (b) => { out += b; if (out.length > 400000) out = out.slice(-200000); });
    let timedOut = false;
    const tm = setTimeout(() => { timedOut = true; p.kill('SIGKILL'); }, A.timeout * 1000);
    p.on('close', (code) => {
      clearTimeout(tm);
      const s = (Date.now() - st) / 1000;
      // упавшие проверки — строки FAIL/✗/not ok (если есть), иначе хвост вывода
      const failLines = out.split('\n').filter((l) => /^\s*(?:FAIL\b|✗|not ok\b|×)/.test(l) && !/^\s*FAIL\s+\d+\/\d+/.test(l)).slice(0, 6);
      const tail = (failLines.length ? failLines.join('\n') + '\n…\n' : '') + out.trim().split('\n').slice(failLines.length ? -2 : -12).join('\n');
      const pm = /(?:пройдено|прошло|passed|ok|PASS)\D{0,12}(\d+)/i.exec(out.split('\n').slice(-6).join('\n'));
      const rec = { slug: job.slug, file: job.file, code, sec: Math.round(s * 10) / 10, timedOut, tail: code === 0 ? out.trim().split('\n').slice(-2).join(' | ').slice(0, 300) : tail };
      R.tests.push(rec);
      const st2 = timedOut ? 'fail' : code !== 0 ? 'fail' : s > A.slow ? 'warn' : 'ok';
      add('tests', job.slug, path.basename(job.file), st2, timedOut ? `таймаут ${A.timeout} с` : code !== 0 ? `код ${code}: ${tail}` : s > A.slow ? `медленно: ${rec.sec} с (> ${A.slow})` : `${rec.sec} с`);
      done++; log(`  [${done}/${files.length}] ${st2.padEnd(4)} ${rec.sec.toFixed(1).padStart(6)} с  ${job.file}${pm ? '' : ''}`);
      res();
    });
  });
  await Promise.all(Array.from({ length: Math.min(A.jobs, files.length) }, async () => { while (i < files.length) await one(files[i++]); }));
  R.timings.tests = sec(Date.now() - t);
}

// ======================================================================
// 3. Браузер: игры
// ======================================================================
let chromium;
function loadPlaywright() {
  if (chromium) return;
  try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
}
// инструментирование страницы до скриптов игры: жест, ранний звук, переполнение текста на canvas
const INSTRUMENT = () => {
  const S = window.__qa = { gesture: false, earlySound: [], acEarly: 0, over: [] };
  const mark = (e) => { if (e.isTrusted) S.gesture = true; };
  ['keydown', 'pointerdown', 'touchstart', 'mousedown'].forEach((t) => window.addEventListener(t, mark, true));
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      class QAAudioContext extends AC { constructor(...a) { super(...a); if (!S.gesture) { S.acEarly++; S.acStack = (new Error().stack || '').split('\n').slice(2, 5).map((x) => x.trim().replace(location.origin, '')).join(' ← '); } } }
      window.AudioContext = QAAudioContext; if (window.webkitAudioContext) window.webkitAudioContext = QAAudioContext;
    }
    for (const [P, n] of [[window.OscillatorNode, 'oscillator'], [window.AudioBufferSourceNode, 'buffer'], [window.ConstantSourceNode, 'constant']]) {
      if (!P) continue; const o = P.prototype.start;
      P.prototype.start = function (...a) { if (!S.gesture && S.earlySound.length < 5) S.earlySound.push(n); return o.apply(this, a); };
    }
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...a) { if (!S.gesture && S.earlySound.length < 5) S.earlySound.push('media:' + (this.currentSrc || this.src || '').split('/').pop()); return play.apply(this, a); };
  } catch (e) {}
  // preventDefault на неотменяемом touch-событии — Chrome пишет в консоль «Ignored attempt to cancel a touchstart…»: запомним, кто
  S.badPrevent = [];
  const pd = Event.prototype.preventDefault;
  Event.prototype.preventDefault = function () {
    if (!this.cancelable && /^touch/.test(this.type) && S.badPrevent.length < 5) {
      const t = this.target, st = (new Error().stack || '').split('\n').slice(2, 4).map((x) => x.trim().replace(location.origin, '')).join(' ← ');
      S.badPrevent.push(`${this.type} на ${t && t.tagName ? t.tagName.toLowerCase() + (t.id ? '#' + t.id : '') + (t.className && typeof t.className === 'string' ? '.' + t.className.split(' ')[0] : '') : '?'}: ${st}`);
    }
    return pd.call(this);
  };
  const ft = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (s, x, y, mw) {
    try {
      const c = this.canvas, g = window.Arcade && window.Arcade.last;
      if (g && c === g.canvas && String(s).trim() && S.over.length < 30) {
        let w = this.measureText(String(s)).width; if (mw != null && w > mw) w = mw;
        const al = this.textAlign, t = this.getTransform(); const l = al === 'center' ? x - w / 2 : (al === 'right' || al === 'end') ? x - w : x;
        const L = t.a * l + t.e, Rr = t.a * (l + w) + t.e;
        if (L < -2 || Rr > c.width + 2) { const k = (g._sceneName || '?') + '|' + s; if (!S.over.some((o) => o.k === k)) S.over.push({ k, scene: g._sceneName, s: String(s), L: Math.round(L), R: Math.round(Rr), W: c.width }); }
      }
    } catch (e) {}
    return ft.call(this, s, x, y, mw);
  };
};
const scene = (page) => page.evaluate(() => { const g = window.Arcade && window.Arcade.last; return g ? (g._sceneName || '?') : null; }).catch(() => null);

async function gameRun(browser, slug, vp) {
  const mobile = vp.name === 'mobile', lang = vp.lang || 'ru';
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await ctx.newPage();
  const res = { vp: vp.label, consoleErrors: [], pageErrors: [], bad: [], failed: [], notes: [] };
  const url = `${BASE()}/${slug}/` + (lang !== 'ru' ? `?lang=${lang}` : '');
  page.on('console', (m) => { if (m.type() === 'error') res.consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => res.pageErrors.push(String(e && e.message || e).slice(0, 300)));
  page.on('response', (r) => { if (r.status() >= 400) res.bad.push(`${r.status()} ${r.url().replace(BASE(), '')}`); });
  page.on('requestfailed', (r) => { const u = r.url(); if (!/^data:|^blob:/.test(u)) res.failed.push(`${(r.failure() || {}).errorText || 'failed'} ${u.replace(BASE(), '')}`); });
  let navigatedAway = null;
  page.on('framenavigated', (f) => { if (f === page.mainFrame() && !f.url().startsWith(`${BASE()}/${slug}/`)) navigatedAway = f.url(); });
  await page.addInitScript(INSTRUMENT);
  await page.addInitScript(() => { try { localStorage.setItem('arcade.sound', '1'); } catch (e) {} });
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await sleep(1500);
    const info = await page.evaluate(() => {
      const g = window.Arcade && window.Arcade.last, c = (g && g.canvas) || document.querySelector('canvas');
      const r = c ? c.getBoundingClientRect() : null;
      return { hasEngine: !!g, scene: g ? g._sceneName : null, canvas: r ? { w: r.width, h: r.height, l: r.left, r: r.right, t: r.top, b: r.bottom } : null, vw: innerWidth, vh: innerHeight, hscroll: document.documentElement.scrollWidth > ((window.visualViewport && visualViewport.width) || innerWidth) + 1, layoutW: innerWidth,
        sw: document.documentElement.scrollWidth, early: window.__qa.earlySound.slice(), acEarly: window.__qa.acEarly, acStack: window.__qa.acStack || '',
        // игра только для ландшафта: в портрете показана плашка «поверните телефон»
        rotate: [...document.querySelectorAll('[id*=rotat],[class*=rotat],[id*=orient],[class*=orient]')].some((e) => { const q = e.getBoundingClientRect(), cs = getComputedStyle(e); return !e.hidden && cs.display !== 'none' && cs.visibility !== 'hidden' && q.width > 50 && q.height > 50; }) };
    });
    res.load = info;
    if (mobile && vp.h > vp.w && info.rotate) {   // по замыслу: игра просит повернуть телефон — тот же проход в ландшафте
      await ctx.close().catch(() => {});
      const r2 = await gameRun(browser, slug, { ...vp, w: vp.h, h: vp.w, label: vp.label.replace('390×844', '844×390') + ' (поворот)' });
      r2.rotatedFrom = vp.label; return r2;
    }
    if (!info.canvas || info.canvas.w < 10 || info.canvas.h < 10) res.notes.push('fail:canvas не виден');
    if (info.early.length) res.notes.push('fail:звук без жеста: ' + info.early.join(', '));
    else if (info.acEarly) res.notes.push('warn:AudioContext создан до жеста (без звука): ' + info.acStack);
    // макет шире экрана (на телефоне — страница «раздувается», кнопки у правого края уходят за экран, появляется прокрутка/зум)
    if (info.hscroll) res.notes.push(`fail:макет шире экрана: ширина страницы ${info.sw} px при экране ${vp.w}`);
    if (info.canvas && (info.canvas.l < -2 || info.canvas.r > info.vw + 2)) res.notes.push(`warn:холст шире экрана — края обрезаны (${Math.round(info.canvas.l)}…${Math.round(info.canvas.r)} при ширине ${info.vw})`);
    if (vp.overflowOnly) {
      // EN-проход: только тексты — заставка → старт → игра → пауза → финал → заставка (как i18n-overflow.mjs)
      await page.keyboard.press('Enter'); await sleep(2500); await page.keyboard.press('KeyP'); await sleep(400);
      await page.evaluate(() => { const g = Arcade.last; try { g.goto('gameover'); } catch (e) {} }); await sleep(300);
      await page.evaluate(() => { const g = Arcade.last; try { g.goto('title'); } catch (e) {} }); await sleep(300);
    } else {
      // старт: Enter / тап по пункту «Играть»
      // меню заставки нарисовано (у пунктов есть _y) — до 5 с; тяжёлые игры под нагрузкой грузятся дольше
      for (let k = 0; k < 25; k++) {
        const ready = await page.evaluate(() => { const g = window.Arcade && window.Arcade.last; if (!g) return true; const m = g.current && g.current._menu; return !m || m.items.every((x) => x._y != null); }).catch(() => true);
        if (ready) break; await sleep(200);
      }
      let sc = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (mobile) {
          const pt = await page.evaluate(() => {
            const g = window.Arcade && window.Arcade.last; if (!g || !g.canvas) return null;
            const r = g.canvas.getBoundingClientRect(), m = g.current && g.current._menu;
            const it = m && m.items && (m.items.find((x) => x.key === 'play') || m.items[0]);
            const y = it && it._y != null ? r.top + (it._y - 6) * r.height / g.H : r.top + r.height / 2;
            const el = document.elementFromPoint(r.left + r.width / 2, y);
            return { x: r.left + r.width / 2, y, at: el ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : '') : null, item: it ? it.key : null };
          });
          res.tap = pt;
          if (pt) await page.touchscreen.tap(pt.x, pt.y); else await page.mouse.click(vp.w / 2, vp.h / 2);
        } else await page.keyboard.press('Enter');
        await sleep(700);
        sc = await scene(page);
        if (sc !== 'title') break;
        res.startRetry = true;
      }
      // промежуточные экраны (выбор уровня, история) — ещё два «подтверждения»
      for (let k = 0; k < 2 && sc && sc !== 'play' && sc !== 'title'; k++) { await page.keyboard.press('Enter'); await sleep(500); sc = await scene(page); }
      res.started = sc;
      if (info.hasEngine && (sc === 'title' || sc == null)) res.notes.push(`fail:не стартует (${mobile ? 'тап по «Играть»' : 'Enter'}), сцена ${sc}${res.tap ? `; тап (${Math.round(res.tap.x)},${Math.round(res.tap.y)}) пункт ${res.tap.item}, под пальцем ${res.tap.at}` : ''}`);
      // потеря фокуса: blur + скрытая вкладка → пауза и сон звука
      if (sc === 'play') {
        await sleep(600);
        const fx = await page.evaluate(async () => {
          const g = Arcade.last;
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
          window.dispatchEvent(new Event('blur')); document.dispatchEvent(new Event('visibilitychange'));
          await new Promise((r) => setTimeout(r, 400));
          const ac = g.audio && g.audio.ac;
          const out = { scene: g._sceneName, ac: ac ? ac.state : null, sound: g.audio ? !!g.audio.on : null, optOut: g.autoPause === false, frozen: !!g._hiddenFreeze, hasPause: !!(g.scenes && g.scenes.pause) };
          delete document.hidden; delete document.visibilityState;
          window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange'));
          return out;
        });
        res.focus = fx;
        if (fx.ac === 'running') res.notes.push('fail:звук играет при скрытой вкладке');
        if (fx.scene === 'pause') { await page.evaluate(() => { const g = Arcade.last; try { g.goto('play', { resume: true }); } catch (e) {} }); await sleep(200); }
      }
      // 10 с случайного ввода
      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'Enter', 'KeyZ', 'KeyX', 'KeyC', 'ShiftLeft', 'KeyF', 'KeyE', 'KeyQ', 'Digit1', 'KeyJ', 'KeyK'];
      const targets = mobile ? await page.evaluate(() => {
        const out = []; const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight ? r : null; };
        for (const el of document.querySelectorAll('button, [data-d], [data-k], [data-key], [data-act], .pad *')) {
          if (el.closest('a[href]')) continue; const r = vis(el); if (r) out.push({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
        }
        return out.slice(0, 40);
      }) : [];
      const cr = await page.evaluate(() => { const c = (window.Arcade && Arcade.last && Arcade.last.canvas) || document.querySelector('canvas'); const r = c.getBoundingClientRect();
        // видимая часть холста (холст шире экрана в портрете — тапаем только по видимому)
        const x0 = Math.max(0, r.left), y0 = Math.max(0, r.top), x1 = Math.min(innerWidth, r.right), y1 = Math.min(innerHeight, r.bottom);
        return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }; }).catch(() => null);
      const end = Date.now() + A.input * 1000; let n = 0; let rnd = 12345 + slug.length * 7919;
      const rand = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      while (Date.now() < end && !navigatedAway) {
        if (mobile) {
          const useBtn = targets.length && rand() < 0.6;
          const p = useBtn ? targets[Math.floor(rand() * targets.length)] : cr ? { x: cr.x + 10 + rand() * Math.max(1, cr.w - 20), y: cr.y + 10 + rand() * Math.max(1, cr.h - 20) } : { x: vp.w / 2, y: vp.h / 2 };
          await page.touchscreen.tap(p.x, p.y).catch(() => {});
          await sleep(40 + rand() * 120);
        } else {
          const k = keys[Math.floor(rand() * keys.length)];
          await page.keyboard.down(k).catch(() => {}); await sleep(30 + rand() * 170); await page.keyboard.up(k).catch(() => {});
        }
        n++;
      }
      res.inputs = n; res.afterInput = await scene(page);
      if (navigatedAway) res.notes.push('warn:случайный тап увёл со страницы: ' + navigatedAway.replace(BASE(), ''));
    }
    res.over = await page.evaluate(() => window.__qa.over).catch(() => []);
    res.badPrevent = await page.evaluate(() => window.__qa.badPrevent).catch(() => []);
  } catch (e) {
    res.notes.push('fail:сбой прогона: ' + String(e && e.message || e).split('\n')[0]);
  } finally { await ctx.close().catch(() => {}); }
  return res;
}

function judgeGame(slug, r) {
  const where = r.vp;
  // 4xx/5xx — отдельной проверкой ниже; «Ignored attempt to cancel a touchstart…» — вмешательство Chrome: касание пришло неотменяемым
  // (точка вне «блокирующих» обработчиков — край кнопки/щель пульта, цель подобрал touch adjustment), а код игры позвал preventDefault
  // без проверки e.cancelable (движок v2.10 — Arcade.touchOk(e)) — жёлтым, с виновником
  const TOUCH_IV = /^Ignored attempt to cancel a touch/;
  const ce = r.consoleErrors.filter((t) => !/^Failed to load resource/.test(t) && !TOUCH_IV.test(t));
  const iv = r.consoleErrors.filter((t) => TOUCH_IV.test(t)).length;
  if (iv) add('browser', slug, `${where}: неотменяемое касание (вмешательство Chrome)`, 'warn', `${iv}×; ` + (r.badPrevent || []).slice(0, 2).join(' | '));
  add('browser', slug, `${where}: ошибки консоли/страницы`, ce.length || r.pageErrors.length ? 'fail' : 'ok',
    [...r.pageErrors.map((x) => 'pageerror: ' + x), ...ce.map((x) => 'console: ' + x)].slice(0, 6).join(' | '));
  add('browser', slug, `${where}: сеть 4xx/5xx`, r.bad.length || r.failed.length ? 'fail' : 'ok', [...r.bad, ...r.failed].slice(0, 8).join(' | '));
  for (const n of r.notes) { const [st, head, ...rest] = n.split(':'); add('browser', slug, `${where}: ${head.slice(0, 70)}`, st, rest.join(':').trim()); }
  // текст за краем: целиком вне холста (подпись объекта мира за экраном) — не видно, пропускаем; короткая подпись (≤ 4 знаков:
  // «+250», «1», «R») у края — подпись объекта мира, который уходит за экран, — жёлтым; строка текста — красным
  const over = (r.over || []).filter((o) => o.R > 0 && o.L < o.W);
  const short = over.filter((o) => o.s.trim().length <= 4), long = over.filter((o) => o.s.trim().length > 4);
  const fmt = (xs) => xs.slice(0, 6).map((o) => `[${o.scene}] «${o.s}» ${o.L}…${o.R}/${o.W}`).join(' | ');
  if (long.length) add('browser', slug, `${where}: текст за краем холста`, 'fail', fmt(long));
  if (short.length) add('browser', slug, `${where}: короткая подпись у края холста`, 'warn', fmt(short));
}

async function browserGames(browser) {
  const t = Date.now();
  const VPS = [
    { name: 'mobile', label: '390×844', w: 390, h: 844 },
    { name: 'desktop', label: '1280×720', w: 1280, h: 720 },
    { name: 'mobile', label: '390×844 EN', w: 390, h: 844, lang: 'en', overflowOnly: true },
  ];
  const jobs = []; for (const s of SLUGS) jobs.push(s);
  let i = 0, done = 0;
  log(`browser: ${jobs.length} игр × ${VPS.length} прохода, вкладок одновременно ${A.pages}`);
  await Promise.all(Array.from({ length: Math.min(A.pages, jobs.length) }, async () => {
    while (i < jobs.length) {
      const slug = jobs[i++]; const st = Date.now(); R.browser[slug] = [];
      for (const vp of VPS) { const r = await gameRun(browser, slug, vp); R.browser[slug].push(r); judgeGame(slug, r); }
      const red = R.items.filter((x) => x.area === 'browser' && x.target === slug && x.status === 'fail').length;
      done++; log(`  [${done}/${jobs.length}] ${red ? 'FAIL' : 'ok  '} ${slug} ${sec(Date.now() - st)} с${red ? ' — красных ' + red : ''}`);
    }
  }));
  // автопауза при потере фокуса — одной строкой на весь каталог. Движок v2.10: скрытая вкладка в play → пауза и на сайте;
  // засчитывается и осознанный опт-аут игры (createGame({ autoPause:false }) — idle и т. п.), и заморозка цикла у игры без сцены pause
  const noPause = [], tested = [], optOut = [], frozen = [];
  for (const [s, rs] of Object.entries(R.browser)) for (const r of rs) if (r.focus) {
    tested.push(s); const f = r.focus;
    if (f.scene === 'pause') continue; if (f.optOut) { optOut.push(s); continue; } if (f.frozen && !f.hasPause) { frozen.push(s); continue; }
    noPause.push(`${s} (${r.vp})`);
  }
  const uniq = (xs) => [...new Set(xs)].join(', ');
  if (tested.length) add('browser', 'каталог', 'автопауза при потере фокуса (blur + скрытая вкладка)', noPause.length ? 'warn' : 'ok',
    (noPause.length ? `нет паузы в ${noPause.length} из ${tested.length} проходов (движок v2.10 ставит паузу по скрытой вкладке — проверь игру): ${noPause.join(', ')}` : `${tested.length} проходов`) +
    (optOut.length ? `; опт-аут autoPause:false: ${uniq(optOut)}` : '') + (frozen.length ? `; без сцены pause — заморозка цикла: ${uniq(frozen)}` : ''));
  R.timings.browser = sec(Date.now() - t);
}

// ======================================================================
// 4. Браузер: каталог
// ======================================================================
const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
async function catalogRun(browser) {
  const t = Date.now(); const N = ALL.length;
  const allUrls = new Set();
  for (const lang of ['ru', 'en']) for (const vp of [{ w: 1280, h: 720, m: false, label: '1280×720' }, { w: 390, h: 844, m: true, label: '390×844' }]) {
    const tag = `${lang === 'ru' ? '/' : '/en/'} ${vp.label}`;
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.m, hasTouch: vp.m });
    const page = await ctx.newPage(); const errs = [], bad = [];
    page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace(BASE(), '')}`); });
    try {
      const base = `${BASE()}${lang === 'ru' ? '/' : '/en/'}`;
      await page.goto(base, { waitUntil: 'load' });
      await page.waitForSelector('#game-grid[aria-busy="false"]', { timeout: 10000 });
      await sleep(400);
      const st = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('#game-grid > li')];
        return { cards: cards.length, visible: cards.filter((c) => !c.hidden).length, count: (document.querySelector('#catalog-count') || {}).textContent || '',
          hero: (document.querySelector('#hero-games') || {}).textContent || '', results: (document.querySelector('#results') || {}).textContent || '',
          pages: [...document.querySelectorAll('#pager .pager-btn')].filter((b) => /^\d+$/.test(b.textContent.trim())).length,
          links: [...document.querySelectorAll('#game-grid a[href]')].map((a) => a.href), imgs: [...document.querySelectorAll('#game-grid img')].map((i) => i.currentSrc || i.src),
          hscroll: document.documentElement.scrollWidth > ((window.visualViewport && visualViewport.width) || innerWidth) + 1, layoutW: innerWidth, title: document.title, htmlLang: document.documentElement.lang };
      });
      const pr = [];
      if (st.cards !== N) pr.push(`карточек ${st.cards}, ждали ${N}`);
      if (st.visible !== Math.min(15, N)) pr.push(`видно ${st.visible}, ждали ${Math.min(15, N)} (страница 1)`);
      if (!new RegExp(`^${N}\\s`).test(st.count.trim())) pr.push(`счётчик «${st.count}»`);
      if (st.hero && !new RegExp(`^${N}\\s`).test(st.hero.trim())) pr.push(`счётчик в шапке «${st.hero}»`);
      if (st.pages !== Math.ceil(N / 15)) pr.push(`кнопок страниц ${st.pages}, ждали ${Math.ceil(N / 15)}`);
      if (st.htmlLang !== lang) pr.push(`<html lang="${st.htmlLang}">`);
      if (lang === 'en' && st.links.some((h) => !/\?lang=en$/.test(h))) pr.push('ссылки EN без ?lang=en: ' + st.links.filter((h) => !/\?lang=en$/.test(h)).slice(0, 3).join(', '));
      const slugsLinked = new Set(st.links.map((h) => new URL(h).pathname.split('/').filter(Boolean)[0]));
      const notLinked = ALL.filter((s) => !slugsLinked.has(s)); if (notLinked.length) pr.push('нет ссылки на: ' + notLinked.join(', '));
      st.links.forEach((u) => allUrls.add(u)); st.imgs.forEach((u) => allUrls.add(u));
      if (st.hscroll) pr.push('горизонтальный скролл');
      add('catalog', tag, 'загрузка, карточки, счётчик, страницы', pr.length ? 'fail' : 'ok', pr.join('; ') || `${st.cards} карточек, «${st.count.trim()}», страниц ${st.pages}`);

      // пейджинг: каждая страница — правильное число карточек и ?page= в адресе
      const pg = [];
      for (let p = 2; p <= Math.ceil(N / 15); p++) {
        await page.click(`#pager .pager-btn[data-page="${p}"]`); await sleep(150);
        const r = await page.evaluate(() => ({ vis: [...document.querySelectorAll('#game-grid > li')].filter((c) => !c.hidden).length, url: location.search, cur: (document.querySelector('#pager [aria-current="page"]') || {}).textContent }));
        const want = Math.min(15, N - 15 * (p - 1));
        if (r.vis !== want || !r.url.includes(`page=${p}`) || r.cur !== String(p)) pg.push(`стр. ${p}: видно ${r.vis}/${want}, адрес «${r.url}», текущая ${r.cur}`);
      }
      // «на странице: все»
      await page.selectOption('#per-page', '0'); await sleep(150);
      const all = await page.evaluate(() => ({ vis: [...document.querySelectorAll('#game-grid > li')].filter((c) => !c.hidden).length, pagerHidden: document.querySelector('#pager').hidden }));
      if (all.vis !== N || !all.pagerHidden) pg.push(`«все»: видно ${all.vis}/${N}, пейджер скрыт: ${all.pagerHidden}`);
      // адрес ?page=3 открывается сразу на 3-й странице
      if (vp.w > 1000) {
        await page.goto(base + '?page=3', { waitUntil: 'load' }); await page.waitForSelector('#game-grid[aria-busy="false"]'); await sleep(200);
        const cur = await page.evaluate(() => (document.querySelector('#pager [aria-current="page"]') || {}).textContent);
        if (cur !== '3') pg.push(`?page=3 → текущая ${cur}`);
      }
      add('catalog', tag, 'пейджинг (страницы, «все», ?page=)', pg.length ? 'fail' : 'ok', pg.join('; ') || `${Math.ceil(N / 15)} стр.`);

      // фильтры по жанрам (на «все»)
      if (vp.w > 1000) {
        await page.goto(base + '?per=0', { waitUntil: 'load' }); await page.waitForSelector('#game-grid[aria-busy="false"]'); await sleep(200);
        const chips = await page.evaluate(() => [...document.querySelectorAll('#genre-filters .chip')].map((c) => c.dataset.genre || 'all'));
        const fp = [];
        for (const gname of chips) {
          await page.click(`#genre-filters .chip[data-genre="${gname.replace(/"/g, '\\"')}"]`); await sleep(120);
          const vis = await page.evaluate(() => [...document.querySelectorAll('#game-grid > li')].filter((c) => !c.hidden).length);
          const want = gname === 'all' ? N : CATALOG.filter((x) => norm(lang === 'en' ? (x.genre_en || x.genre) : x.genre) === norm(gname)).length;
          if (vis !== want || want === 0) fp.push(`«${gname}»: видно ${vis}, по games.json ${want}`);
        }
        const sum = chips.filter((c) => c !== 'all').reduce((a, gname) => a + CATALOG.filter((x) => norm(lang === 'en' ? (x.genre_en || x.genre) : x.genre) === norm(gname)).length, 0);
        if (sum !== N) fp.push(`жанры покрывают ${sum} из ${N} игр`);
        add('catalog', tag, 'фильтры по жанрам', fp.length ? 'fail' : 'ok', fp.join('; ') || `${chips.length} чипов`);
        // превью второй темы
        await page.click('#theme-toggle').catch(() => {}); await sleep(300);
        (await page.evaluate(() => [...document.querySelectorAll('#game-grid img')].map((i) => i.currentSrc || i.src))).forEach((u) => allUrls.add(u));
        await page.click('#theme-toggle').catch(() => {});
      }
    } catch (e) { errs.push('сбой прогона: ' + String(e.message).split('\n')[0]); }
    add('catalog', tag, 'ошибки консоли / 4xx', errs.length || bad.length ? 'fail' : 'ok', [...errs, ...bad].slice(0, 6).join(' | '));
    await ctx.close();
  }
  // все ссылки и картинки — HTTP 200
  const badUrls = [];
  for (const u of allUrls) { const s = await status(u); if (s !== 200) badUrls.push(`${s} ${u.replace(BASE(), '')}`); }
  add('catalog', 'ссылки', `все ссылки на игры и превью (${allUrls.size}) → 200`, badUrls.length ? 'fail' : 'ok', badUrls.slice(0, 10).join(' | '));
  // файлы превью обеих тем для каждой игры
  const noThumb = []; for (const s of ALL) for (const th of ['retro', 'modern']) {
    const g = CATALOG.find((x) => x.slug === s); const rel = (g.thumb && g.thumb[th]) || `assets/catalog/thumbs/${s}-${th}.webp`;
    if (!fs.existsSync(path.join(ROOT, rel.replace(/^\/+/, '').replace(/\?.*$/, '')))) noThumb.push(rel);
  }
  add('catalog', 'превью', 'файлы превью retro+modern у каждой игры', noThumb.length ? 'fail' : 'ok', noThumb.join(', '));
  // sitemap: каждый адрес отдаётся локально
  const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const hrefs = [...sm.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const badSm = []; for (const u of new Set([...locs, ...hrefs, `${SITE}/robots.txt`, `${SITE}/sitemap.xml`])) { const s = await status(u.replace(SITE, BASE())); if (s !== 200) badSm.push(`${s} ${u.replace(SITE, '')}`); }
  add('catalog', 'sitemap.xml', `адреса sitemap/robots отдаются (${locs.length})`, badSm.length ? 'fail' : 'ok', badSm.join(' | '));
  const nf = await status(`${BASE()}/qa-missing-${Date.now()}/`);
  add('catalog', '404', 'несуществующий адрес → 404', nf === 404 ? 'ok' : 'warn', String(nf));
  R.timings.catalog = sec(Date.now() - t);
}

// ======================================================================
// 5. Тач-проход (tools/touch-sweep.browser.mjs) — отдельным процессом, после раздела browser (один браузер за раз)
// ======================================================================
async function runTouch() {
  const t = Date.now();
  const json = path.join(os.tmpdir(), `qa-touch-${process.pid}.json`);
  const args = [path.join(ROOT, 'tools/touch-sweep.browser.mjs'), ...SLUGS, '--port', String(A.port + 1), '--json', json];
  log(`touch: ${SLUGS.length} игр (tools/touch-sweep.browser.mjs)…`);
  const code = await new Promise((res) => {
    const ch = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    ch.stdout.on('data', (d) => { for (const l of String(d).split('\n')) if (/^FAIL /.test(l)) log('  ' + l.slice(0, 200)); });
    ch.stderr.on('data', (d) => { err += d; });
    ch.on('close', (c) => { if (c && c !== 1) add('touch', 'touch-sweep', 'запуск', 'fail', `код ${c}: ${err.slice(-600)}`); res(c); });
  });
  let rs = []; try { rs = JSON.parse(fs.readFileSync(json, 'utf8')); fs.unlinkSync(json); } catch (e) { if (code === 0 || code === 1) add('touch', 'touch-sweep', 'результаты', 'fail', 'нет JSON: ' + e.message); }
  for (const r of rs) {
    const d = [r.warn.length ? `предупреждений Chrome ${r.warn.length}` : '', r.bad.length ? 'preventDefault у неотменяемых: ' + r.bad.slice(0, 2).join(' | ') : '',
      r.doubles.length ? 'двойные: ' + r.doubles.slice(0, 4).join('; ') : '', r.ta.length ? 'touch-action не none: ' + r.ta.slice(0, 4).join('; ') : '',
      r.perr.length ? 'pageerror: ' + r.perr.slice(0, 2).join(' | ') : '', r.scroll].filter(Boolean).join(' · ');
    add('touch', r.slug, `тач-цели: края + центр (${r.targets} целей, ${r.taps} касаний)`, r.status === 'FAIL' ? 'fail' : 'ok', d || (r.status === 'ok' ? '' : r.status));
  }
  R.timings.touch = sec(Date.now() - t);
}

// ======================================================================
// отчёт
// ======================================================================
function writeReport() {
  R.finished = new Date().toISOString(); R.timings.total = sec(Date.now() - t0);
  const dir = path.resolve(ROOT, A.out); fs.mkdirSync(dir, { recursive: true });
  const day = R.started.slice(0, 10); let name = day, k = 2;
  while (fs.existsSync(path.join(dir, name + '.md'))) name = `${day}-${k++}`;
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(R, null, 1));
  const cnt = (st, area) => R.items.filter((x) => x.status === st && (!area || x.area === area)).length;
  const L = [];
  L.push(`# QA-прогон аркады — ${R.started.slice(0, 16).replace('T', ' ')} UTC`, '');
  L.push(`Игр: ${SLUGS.length}${ONLY.length ? ' (выборка --only)' : ''}. Время: всего ${fmtT(R.timings.total)}` +
    Object.entries(R.timings).filter(([k2]) => k2 !== 'total').map(([k2, v]) => `, ${k2} ${fmtT(v)}`).join('') + '.');
  L.push(`Параметры: jobs ${A.jobs}, timeout ${A.timeout} с, slow ${A.slow} с, ввод ${A.input} с, вкладок ${A.pages}${SKIP.size ? ', пропущено: ' + [...SKIP].join(',') : ''}.`, '');
  L.push('| раздел | ok | warn | fail |', '|---|---:|---:|---:|');
  for (const a of ['static', 'tests', 'browser', 'catalog', 'touch']) if (R.items.some((x) => x.area === a)) L.push(`| ${a} | ${cnt('ok', a)} | ${cnt('warn', a)} | ${cnt('fail', a)} |`);
  L.push(`| **всего** | ${cnt('ok')} | ${cnt('warn')} | **${cnt('fail')}** |`, '');
  const sect = (st, title) => {
    const xs = R.items.filter((x) => x.status === st); L.push(`## ${title} (${xs.length})`, '');
    if (!xs.length) { L.push('—', ''); return; }
    L.push('| раздел | цель | проверка | подробности |', '|---|---|---|---|');
    for (const x of xs) L.push(`| ${x.area} | ${x.target} | ${x.check} | ${esc(x.detail).slice(0, 600)} |`);
    L.push('');
  };
  sect('fail', 'Красные');
  sect('warn', 'Жёлтые');
  if (R.tests.length) {
    const slow = R.tests.slice().sort((a, b) => b.sec - a.sec).slice(0, 12);
    L.push('## Самые долгие тесты', '', '| файл | с | итог |', '|---|---:|---|');
    for (const x of slow) L.push(`| ${x.file} | ${x.sec} | ${x.timedOut ? 'таймаут' : x.code === 0 ? 'ok' : 'код ' + x.code} |`);
    L.push('', `Всего файлов тестов: ${R.tests.length}, сумма времени ${fmtT(R.tests.reduce((a, x) => a + x.sec, 0))} (стена ${fmtT(R.timings.tests || 0)}).`, '');
  }
  if (Object.keys(R.browser).length) {
    L.push('## Браузер по играм', '', '| игра | старт 390 / 1280 | автопауза | ввод (событий) | красных |', '|---|---|---|---|---:|');
    for (const s of Object.keys(R.browser).sort()) {
      const [m, d] = R.browser[s];
      const red = R.items.filter((x) => x.area === 'browser' && x.target === s && x.status === 'fail').length;
      L.push(`| ${s} | ${m && m.started || '—'} / ${d && d.started || '—'} | ${d && d.focus ? d.focus.scene : '—'} | ${m && m.inputs || 0} / ${d && d.inputs || 0} | ${red} |`);
    }
    L.push('');
  }
  fs.writeFileSync(path.join(dir, name + '.md'), L.join('\n') + '\n');
  return path.join(A.out, name);
}
const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ⏎ ');
const fmtT = (s) => s >= 60 ? `${Math.floor(s / 60)} мин ${Math.round(s % 60)} с` : `${Math.round(s)} с`;

// ======================================================================
(async () => {
  let browser = null; let exitCode = 0;
  try {
    if (!SKIP.has('static')) { log('static…'); staticChecks(); }
    if (!SKIP.has('tests')) await runTests();
    if (!SKIP.has('browser') || !SKIP.has('catalog')) {
      await startServer(); loadPlaywright(); browser = await chromium.launch();
      if (!SKIP.has('catalog')) { log('catalog…'); await catalogRun(browser); }
      if (!SKIP.has('browser')) await browserGames(browser);
    }
    if (!SKIP.has('touch')) { if (browser) { await browser.close().catch(() => {}); browser = null; } await runTouch(); }
  } catch (e) { add('qa-run', 'qa-run', 'сбой инструмента', 'fail', e.stack || e.message); console.error(e); }
  finally { if (browser) await browser.close().catch(() => {}); if (srv) srv.close(); }
  const out = writeReport();
  const f = R.items.filter((x) => x.status === 'fail').length, w = R.items.filter((x) => x.status === 'warn').length;
  log(`\nОтчёт: ${out}.md (+ .json). Красных ${f}, жёлтых ${w}, время ${fmtT(R.timings.total)}.`);
  for (const x of R.items.filter((y) => y.status === 'fail').slice(0, 40)) log(`  FAIL ${x.area} ${x.target} — ${x.check}: ${x.detail.slice(0, 200)}`);
  exitCode = f ? 1 : 0;
  process.exit(exitCode);
})();
