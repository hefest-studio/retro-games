#!/usr/bin/env node
/**
 * ux-audit.mjs — сквозной UX-аудит игр аркады в живом браузере (Playwright, Chromium).
 *
 * Для каждой игры из assets/catalog/games.json проверяет 4 требования:
 *  1. link  — ссылка «← Каталог» видна (в пределах вьюпорта, не перекрыта — elementFromPoint),
 *             ведёт в каталог ТЕКУЩЕГО языка игры: RU — корень (../), EN — ../en/ , и подписана на этом
 *             языке; десктоп 1280×720 и телефон (iPhone 13 ландшафт), на заставке и в игре. EN-ссылка
 *             проверяется трижды: после L на заставке (deskTitleEn), в игре (deskPlay) и по адресу
 *             ?lang=en (urlEn); возврат ?lang=ru → снова корень (urlRu).
 *  2. theme — клавиша T реально меняет картинку игры: гистограмма цветов кадра до/после
 *             (L1, 512 корзин) сравнивается с «шумом» анимации (два кадра без переключения):
 *             Δ ≥ 0.08 и Δ > 2·шум + 0.04 (или, при живой анимации: a→b→c с возвратом темы, b далёк
 *             от a и c, а a≈c). --shots <dir> сохраняет кадры до/после.
 *  3. lang  — клавиша L переключает язык, и в EN на заставке/в игре/на паузе нет ни одной
 *             строки с кириллицей (заставка, игра в обеих темах, пауза, экраны конца/победы): ни в тексте canvas (перехват fillText/strokeText),
 *             ни в видимом тексте страницы (DOM).
 *  4. url   — единое правило языка: ?lang=en даёт английское меню и сохраняет arcade.lang=en
 *             (даже если сохранено ru); без параметра и без сохранённого выбора — ru.
 *
 * Запуск (сервер — отдельно: python3 -m http.server 8941 в корне репо):
 *   node tools/qa/ux-audit.mjs --phase before            # все игры → tools/qa/reports/ux-audit-before.json
 *   node tools/qa/ux-audit.mjs --phase after --only hrum,vihr
 *   node tools/qa/ux-audit.mjs --md                      # собрать tools/qa/ux-audit.md из before/after
 * Один браузер за раз; закрывается в конце.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REPORTS = resolve(ROOT, 'tools/qa/reports');
const CATALOG = JSON.parse(readFileSync(resolve(ROOT, 'assets/catalog/games.json'), 'utf8')).games;

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const BASE = (args.base || 'http://127.0.0.1:8941').replace(/\/$/, '');
const PHASE = args.phase || 'after';
const CYR = /[А-Яа-яЁё]/;
const SHOTS = args.shots ? resolve(String(args.shots)) : null; // --shots <dir>: кадры до/после T (для просмотра глазами)
const LINK_KEYS = ['deskTitle', 'deskTitleEn', 'deskPlay', 'mobTitle', 'mobPlay', 'urlEn', 'urlRu']; // точки проверки ссылки «← Каталог»
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- перехваты в странице ----------
const INIT = `(() => {
  const buf = []; window.__txt = buf;
  const hook = (P) => { if (!P) return; for (const m of ['fillText', 'strokeText']) { const o = P[m]; if (!o || o.__w) continue;
    P[m] = function (s, ...a) { try { buf.push(String(s)); if (buf.length > 20000) buf.splice(0, 10000); } catch (e) {} return o.call(this, s, ...a); }; P[m].__w = 1; } };
  hook(window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype);
  hook(window.OffscreenCanvasRenderingContext2D && OffscreenCanvasRenderingContext2D.prototype);
  window.__games = []; let A;
  const wrap = (v) => { if (v && v.createGame && !v.createGame.__w) { const cg = v.createGame; v.createGame = function (o) { const g = cg.call(this, o); window.__games.push(g); return g; }; v.createGame.__w = 1; } };
  Object.defineProperty(window, 'Arcade', { configurable: true, get() { return A; }, set(v) { A = v; wrap(v); } });
})();`;

const PAGE_FN = {
  mark: () => window.__txt.length,
  textsSince: (m) => [...new Set(window.__txt.slice(m).map((s) => s.trim()).filter(Boolean))],
  engine: () => { const g = (window.__games || [])[0]; return g ? { scene: g._sceneName, lang: g.i18n.lang, theme: g.themeName } : null; },
  dom: () => {
    const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (!t) continue;
      const el = n.parentElement; if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName)) continue;
      if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
      if (r.bottom < 0 || r.right < 0 || r.left > innerWidth || r.top > Math.max(innerHeight, document.documentElement.scrollHeight)) continue;
      out.push(t);
    }
    return [...new Set(out)];
  },
  link: (lang) => { // lang — ожидаемый язык игры: 'ru' → корень каталога, 'en' → /en/
    const cands = [...document.querySelectorAll('a[href]')].filter((a) => /каталог|catalog/i.test(a.textContent));
    if (!cands.length) return { ok: false, why: 'нет ссылки' };
    const res = cands.map((a) => {
      const r = a.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
      const href = a.href, root = location.origin + '/' + (lang === 'en' ? 'en/' : '');
      const label = a.textContent.replace(/\s+/g, ' ').trim();
      const labelOk = lang === 'en' ? /catalog/i.test(label) && !/[А-Яа-яЁё]/.test(label) : /каталог/i.test(label);
      const hrefOk = href === root || href === root + 'index.html';
      const vis = a.checkVisibility ? a.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true;
      const inVp = r.width > 4 && r.height > 4 && r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1;
      let covered = null;
      if (inVp) {
        const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 3, r.top + 3], [r.right - 3, r.bottom - 3]];
        for (const [x, y] of pts) { const e = document.elementFromPoint(x, y); if (!e || !(e === a || a.contains(e))) { covered = e ? (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '')) : 'null'; break; } }
      }
      const op = +getComputedStyle(a).opacity;
      return { ok: hrefOk && labelOk && vis && inVp && !covered && op >= 0.3, hrefOk, labelOk, label, vis, inVp, covered, op, rect: [r.left, r.top, r.width, r.height].map(Math.round), href };
    });
    const good = res.find((x) => x.ok);
    if (good) return { ok: true, rect: good.rect };
    const b = res[0];
    return { ok: false, why: !b.hrefOk ? 'href ' + b.href + ' (язык ' + (lang || 'ru') + ')' : !b.labelOk ? 'подпись «' + b.label + '» (язык ' + (lang || 'ru') + ')' : !b.vis ? 'скрыта' : !b.inVp ? 'вне экрана ' + b.rect : b.covered ? 'перекрыта ' + b.covered : 'прозрачна ' + b.op };
  },
  bigCanvas: () => {
    let best = null;
    for (const c of document.querySelectorAll('canvas')) { const r = c.getBoundingClientRect(); const a = r.width * r.height; if (a > 0 && (!best || a > best.a)) best = { a, x: r.left, y: r.top, w: r.width, h: r.height }; }
    if (!best) return null;
    const x = Math.max(0, best.x), y = Math.max(0, best.y), w = Math.min(innerWidth, best.x + best.w) - x, h = Math.min(innerHeight, best.y + best.h) - y;
    return w > 8 && h > 8 ? { x, y, width: w, height: h } : null;
  },
};

async function hist(ana, buf) {
  return ana.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); const s = Math.min(1, 320 / img.width); c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height); const d = x.getImageData(0, 0, c.width, c.height).data;
    const h = new Float64Array(512); const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) h[((d[i] >> 5) << 6) | ((d[i + 1] >> 5) << 3) | (d[i + 2] >> 5)]++;
    return Array.from(h, (v) => v / n);
  }, buf.toString('base64'));
}
const l1 = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0);

async function shot(page, ana, name) {
  const clip = await page.evaluate(PAGE_FN.bigCanvas);
  const buf = await page.screenshot(clip ? { clip } : {});
  if (name) { mkdirSync(SHOTS, { recursive: true }); writeFileSync(resolve(SHOTS, name + '.png'), buf); }
  return hist(ana, buf);
}

async function press(page, key, ms = 350) { await page.keyboard.press(key); await sleep(ms); }

async function startGame(page) {
  // Enter — «Играть» (первый пункт меню). Если сцена не сменилась — Space, затем тап по центру.
  await press(page, 'Enter', 1200);
  let e = await page.evaluate(PAGE_FN.engine);
  if (e && e.scene !== 'play') { await press(page, 'Space', 900); e = await page.evaluate(PAGE_FN.engine); }
  return e;
}

async function newPage(browser, ctxOpts, errors) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  // после принудительного перехода на экраны конца/победы (не из игры) ошибки — артефакт аудита: отдельно
  const sink = (msg) => (page.__forced ? (errors.forced = errors.forced || []).push(msg) : errors.push(msg));
  page.on('pageerror', (e) => sink('pageerror: ' + String(e.message).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error' && !/AudioContext|favicon|Failed to load resource/i.test(m.text())) sink('console: ' + m.text().slice(0, 160)); });
  return { ctx, page };
}

async function auditGame(browser, ana, slug, devices) {
  const url = `${BASE}/${slug}/`;
  const errors = [];
  const R = { slug, link: {}, theme: {}, lang: {}, url: {}, errors };

  // ---------- десктоп: ссылка, язык (L), тема (T) ----------
  {
    const { ctx, page } = await newPage(browser, { viewport: { width: 1280, height: 720 } }, errors);
    await page.goto(url, { waitUntil: 'load' }); await sleep(1300);
    const e0 = await page.evaluate(PAGE_FN.engine);
    R.url.defaultLang = e0 ? e0.lang : null;
    R.link.deskTitle = await page.evaluate(PAGE_FN.link, 'ru');
    let m = await page.evaluate(PAGE_FN.mark); await sleep(400);
    const ruTitle = await page.evaluate(PAGE_FN.textsSince, m);
    const ruDom = await page.evaluate(PAGE_FN.dom);
    const hRu = await shot(page, ana);
    await press(page, 'KeyL', 500);
    const e1 = await page.evaluate(PAGE_FN.engine);
    R.link.deskTitleEn = await page.evaluate(PAGE_FN.link, 'en'); // после L ссылка ведёт в /en/ и подписана по-английски
    const hEn = await shot(page, ana);
    m = await page.evaluate(PAGE_FN.mark); await sleep(400);
    const enTitle = await page.evaluate(PAGE_FN.textsSince, m);
    const enDomTitle = await page.evaluate(PAGE_FN.dom);
    const e2 = await startGame(page);
    R.scenePlay = e2 ? e2.scene : null;
    m = await page.evaluate(PAGE_FN.mark); await sleep(1300);
    const enPlay = await page.evaluate(PAGE_FN.textsSince, m);
    const enDomPlay = await page.evaluate(PAGE_FN.dom);
    R.link.deskPlay = await page.evaluate(PAGE_FN.link, 'en');
    // тема
    const a0 = await shot(page, ana); await sleep(300); const a1 = await shot(page, ana, SHOTS && `${slug}-theme-a`);
    const th0 = (await page.evaluate(PAGE_FN.engine) || {}).theme;
    await press(page, 'KeyT', 600);
    const b = await shot(page, ana, SHOTS && `${slug}-theme-b`);
    const th1 = (await page.evaluate(PAGE_FN.engine) || {}).theme;
    m = await page.evaluate(PAGE_FN.mark); await sleep(500);
    const enPlayAlt = await page.evaluate(PAGE_FN.textsSince, m); // EN-строки и во второй теме
    // обратно к исходной теме (цикл может включать neon) → кадр c: при живой анимации сравниваем a↔b↔c
    for (let i = 0; i < 3; i++) { const e = await page.evaluate(PAGE_FN.engine); if (!e || e.theme === th0) break; await press(page, 'KeyT', 450); }
    const c = await shot(page, ana);
    const noise = l1(a0, a1), d = l1(a1, b), back = Math.min(l1(b, c), d), same = l1(a1, c);
    const okA = d >= 0.08 && d > noise * 2 + 0.04;
    const okB = back >= 0.08 && back > same * 2 + 0.04; // b заметно отличается и от a, и от c, а a≈c
    R.theme = { ok: okA || okB, d: +d.toFixed(3), noise: +noise.toFixed(3), back: +back.toFixed(3), same: +same.toFixed(3), from: th0, to: th1 };
    // пауза в EN
    await press(page, 'KeyP', 300);
    m = await page.evaluate(PAGE_FN.mark); await sleep(400);
    const enPause = await page.evaluate(PAGE_FN.textsSince, m);
    const enDomPause = await page.evaluate(PAGE_FN.dom);
    // финальные экраны движка (gameover/win) — в EN
    const fin = []; page.__forced = true;
    for (const sc of ['gameover', 'win']) {
      m = await page.evaluate(PAGE_FN.mark);
      await page.evaluate((sc) => { const g = (window.__games || [])[0]; if (g && g.scenes[sc]) g.goto(sc); }, sc); await sleep(350);
      fin.push(...await page.evaluate(PAGE_FN.textsSince, m));
    }
    const cyr = [...new Set([...enTitle, ...enPlay, ...enPlayAlt, ...enPause, ...fin, ...enDomTitle, ...enDomPlay, ...enDomPause].filter((s) => CYR.test(s)))];
    const ruHadCyr = [...ruTitle, ...ruDom].some((s) => CYR.test(s));
    const pix = l1(hRu, hEn);
    R.lang = { toggled: !!(e1 && e1.lang === 'en'), cyrInEn: cyr.slice(0, 12), cyrCount: cyr.length, ruHadCyr, pix: +pix.toFixed(3) };
    R.lang.ok = R.lang.toggled && cyr.length === 0 && (ruHadCyr || pix > 0.005);
    await ctx.close();
  }

  // ---------- телефон: ссылка на заставке и в игре ----------
  {
    const { ctx, page } = await newPage(browser, devices, errors);
    await page.goto(url, { waitUntil: 'load' }); await sleep(1200);
    R.link.mobTitle = await page.evaluate(PAGE_FN.link, 'ru');
    await startGame(page); await sleep(500);
    R.link.mobPlay = await page.evaluate(PAGE_FN.link, 'ru');
    await ctx.close();
  }

  // ---------- ?lang=en: приоритет над сохранённым ru, сохраняется ----------
  {
    const { ctx, page } = await newPage(browser, { viewport: { width: 1280, height: 720 } }, errors);
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => { localStorage.setItem('arcade.lang', 'ru'); });
    await page.goto(url + '?lang=en', { waitUntil: 'load' }); await sleep(1300);
    const e = await page.evaluate(PAGE_FN.engine);
    const m = await page.evaluate(PAGE_FN.mark); await sleep(400);
    const tx = await page.evaluate(PAGE_FN.textsSince, m);
    const saved = await page.evaluate(() => localStorage.getItem('arcade.lang'));
    R.link.urlEn = await page.evaluate(PAGE_FN.link, 'en');
    await page.goto(url, { waitUntil: 'load' }); await sleep(900);
    const e2 = await page.evaluate(PAGE_FN.engine);
    await page.goto(url + '?lang=ru', { waitUntil: 'load' }); await sleep(900);
    const e3 = await page.evaluate(PAGE_FN.engine);
    R.link.urlRu = await page.evaluate(PAGE_FN.link, 'ru');
    const cyr = tx.filter((s) => CYR.test(s));
    Object.assign(R.url, { en: e && e.lang, saved, keptAfter: e2 && e2.lang, ru: e3 && e3.lang, cyr: cyr.slice(0, 6) });
    R.url.ok = R.url.defaultLang === 'ru' && R.url.en === 'en' && saved === 'en' && R.url.keptAfter === 'en' && R.url.ru === 'ru' && cyr.length === 0;
    await ctx.close();
  }
  R.link.ok = LINK_KEYS.every((k) => R.link[k] && R.link[k].ok);
  if (errors.forced) R.forcedErrors = errors.forced;
  return R;
}

// ---------- отчёт ----------
function mark(ok) { return ok ? '✅' : '❌'; }
function why(r, k) {
  if (!r) return '';
  if (k === 'link') return LINK_KEYS.filter((x) => r.link[x] && !r.link[x].ok).map((x) => `${x}: ${r.link[x].why}`).join('; ');
  if (k === 'theme') return r.theme.ok ? '' : `Δ=${r.theme.d} шум=${r.theme.noise} ${r.theme.from}→${r.theme.to}`;
  if (k === 'lang') return r.lang.ok ? '' : (!r.lang.toggled ? 'L не переключает; ' : '') + (r.lang.cyrCount ? `кириллица в EN (${r.lang.cyrCount}): ` + r.lang.cyrInEn.slice(0, 4).map((s) => '«' + s.slice(0, 40) + '»').join(', ') : '');
  if (k === 'url') return r.url.ok ? '' : `по умолч.=${r.url.defaultLang}, ?lang=en→${r.url.en}, сохр.=${r.url.saved}, затем=${r.url.keptAfter}, ?lang=ru→${r.url.ru}` + (r.url.cyr && r.url.cyr.length ? ', кириллица: «' + r.url.cyr[0] + '»' : '');
  return '';
}
function buildMd() {
  const load = (p) => existsSync(resolve(REPORTS, `ux-audit-${p}.json`)) ? JSON.parse(readFileSync(resolve(REPORTS, `ux-audit-${p}.json`), 'utf8')) : null;
  const before = load('before'), after = load('after');
  const B = Object.fromEntries((before ? before.results : []).map((r) => [r.slug, r]));
  const A = Object.fromEntries((after ? after.results : []).map((r) => [r.slug, r]));
  const keys = [['link', '1. ← Каталог'], ['theme', '2. Тема T'], ['lang', '3. Язык L'], ['url', '4. ?lang=']];
  const lines = ['# UX-аудит аркады: ← Каталог · тема · язык · ?lang=', '',
    `Сгенерировано \`node tools/qa/ux-audit.mjs --md\` (${new Date().toISOString().slice(0, 10)}). Браузер — Chromium (Playwright); десктоп 1280×720 и iPhone 13 ландшафт.`,
    'Ячейка: «до → после». Методика — в шапке `tools/qa/ux-audit.mjs`.', '',
    '| Игра | ' + keys.map((k) => k[1]).join(' | ') + ' | Ошибки JS (после) |', '|' + '---|'.repeat(keys.length + 2)];
  const totals = Object.fromEntries(keys.map((k) => [k[0], { b: 0, a: 0, list: [] }]));
  for (const g of CATALOG) {
    const b = B[g.slug], a = A[g.slug];
    const cells = keys.map(([k]) => {
      const bo = b ? b[k].ok : null, ao = a ? a[k].ok : null;
      if (b && !bo) { totals[k].b++; totals[k].list.push(g.slug); }
      if (a && !ao) totals[k].a++;
      return (b ? mark(bo) : '—') + ' → ' + (a ? mark(ao) : '—');
    });
    lines.push(`| ${g.slug} | ${cells.join(' | ')} | ${a ? (a.errors.length ? a.errors.length : 0) : '—'} |`);
  }
  lines.push('', '## Итого', '', '| Пункт | Проблем до | Проблем после | Игры с проблемой до |', '|---|---|---|---|');
  for (const [k, n] of keys) lines.push(`| ${n} | ${totals[k].b} | ${totals[k].a} | ${totals[k].b && totals[k].b === Object.keys(B).length ? 'все ' + totals[k].b : (totals[k].list.join(', ') || '—')} |`);
  lines.push('', '## Причины «до» (кратко)', '');
  for (const g of CATALOG) {
    const b = B[g.slug]; if (!b) continue;
    const w = keys.map(([k, n]) => (b[k].ok ? '' : `${n}: ${why(b, k)}`)).filter(Boolean);
    if (w.length) lines.push(`- **${g.slug}** — ${w.join(' · ')}`);
  }
  const rest = CATALOG.filter((g) => A[g.slug] && keys.some(([k]) => !A[g.slug][k].ok));
  if (rest.length) {
    lines.push('', '## Осталось «после»', '');
    for (const g of rest) lines.push(`- **${g.slug}** — ${keys.filter(([k]) => !A[g.slug][k].ok).map(([k, n]) => `${n}: ${why(A[g.slug], k)}`).join(' · ')}`);
  }
  const notes = resolve(REPORTS, 'ux-audit-notes.md'); // ручные примечания к прогону (если есть)
  if (existsSync(notes)) lines.push('', readFileSync(notes, 'utf8').trim());
  writeFileSync(resolve(ROOT, 'tools/qa/ux-audit.md'), lines.join('\n') + '\n');
  console.log('→ tools/qa/ux-audit.md');
}

async function main() {
  if (args.md) return buildMd();
  const { chromium, devices } = createRequire(import.meta.url)('playwright'); // глобальная установка (NODE_PATH)
  const slugs = args.only ? String(args.only).split(',') : CATALOG.map((g) => g.slug);
  const out = resolve(REPORTS, `ux-audit-${PHASE}.json`);
  mkdirSync(REPORTS, { recursive: true });
  const prev = existsSync(out) && args.only ? JSON.parse(readFileSync(out, 'utf8')).results : [];
  const dev = { ...devices['iPhone 13 landscape'] }; delete dev.defaultBrowserType;
  const browser = await chromium.launch();
  const results = [];
  try {
    const anaCtx = await browser.newContext(); const ana = await anaCtx.newPage();
    for (const slug of slugs) {
      let r;
      try { r = await auditGame(browser, ana, slug, dev); }
      catch (e) { r = { slug, link: { ok: false }, theme: { ok: false }, lang: { ok: false }, url: { ok: false }, errors: ['audit: ' + e.message.slice(0, 200)] }; }
      results.push(r);
      console.log(`${slug.padEnd(15)} link ${mark(r.link.ok)} theme ${mark(r.theme.ok)} lang ${mark(r.lang.ok)} url ${mark(r.url.ok)}  ${['link', 'theme', 'lang', 'url'].map((k) => why(r, k)).filter(Boolean).join(' | ')}${r.errors.length ? ' | ERR ' + r.errors[0] : ''}`);
    }
  } finally { await browser.close(); }
  const merged = [...prev.filter((p) => !slugs.includes(p.slug)), ...results];
  writeFileSync(out, JSON.stringify({ phase: PHASE, date: new Date().toISOString(), results: merged }, null, 1));
  const fails = results.filter((r) => !(r.link.ok && r.theme.ok && r.lang.ok && r.url.ok)).length;
  console.log(`\nигр ${results.length}, с проблемами ${fails} → ${out}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
