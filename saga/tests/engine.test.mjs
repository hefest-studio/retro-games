/* СЕВЕРНАЯ САГА · tests/engine.test.mjs — автотесты порта на движок v2 («оболочка» js/host.js).
   Запуск: node saga/tests/engine.test.mjs   (нужен Playwright: глобально или npm i -D playwright)
   Поднимает свой статический сервер по корню репо и проверяет в Chromium:
   • 10 земель на месте; legacy.html грузится и работает сама (без оболочки);
   • меню движка (Играть / Продолжить / Уровни / Язык / Тема / Звук) → пролог → брифинг → игра (Enter);
   • родные брифинг/пролог/карта земель — видны, родные титул/пауза/финал — скрыты;
   • пауза P ↔ пауза игры, тема T/G ↔ графика игры (modern ↔ retro), язык L ↔ язык игры (в обе стороны),
     звук M → звук игры; переключение героев 1/2/3 и Tab уходит в игру;
   • финал саги → экран win движка и рекорд arcade.best.saga; «Продолжить» и «Уровни» из меню;
   • прогресс игроков (lv.progress.v1, lv.story.v1) не теряется; ?gfx= / ?level= / #gfx= работают;
   • 0 ошибок pageerror / console.error. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SLUG = 'saga';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
let chromium;
try { ({ chromium } = await import('playwright')); } catch { try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.error('Нужен Playwright'); process.exit(1); } }

const srv = await new Promise((ok) => {
  const s = createServer(async (req, res) => {
    try {
      let file = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      if (existsSync(file) && (await stat(file)).isDirectory()) file = join(file, 'index.html');
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  s.listen(0, '127.0.0.1', () => ok(s));
});
const BASE = `http://127.0.0.1:${srv.address().port}/${SLUG}/`;
const browser = await chromium.launch();
const errors = [];
let passed = 0, failed = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function test(name, fn) { try { await fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
async function open(path = '', init = null, arg = undefined) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  if (init) await ctx.addInitScript(init, arg);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${path} pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`${path} console: ${m.text()}`); });
  await p.goto(BASE + path, { waitUntil: 'load' }); await wait(700);
  return { p, ctx, close: () => ctx.close() };
}
const st = (p) => p.evaluate(() => {
  const h = window.__arcadeHost, U = window.LV_UI, G = window.LV_GAME.state;
  const vis = (s) => { const el = document.querySelector('.screen[data-screen="' + s + '"]'); return !!el && getComputedStyle(el).display !== 'none'; };
  return { scene: h.g._sceneName, theme: h.g.themeName, lang: h.g.i18n.lang, sound: h.g.audio.enabled, best: h.g.state.best,
    screen: U.getScreen(), gfx: U.prefs.gfx, glang: U.prefs.lang, muted: U.prefs.muted, level: G.levelIndex, active: G.activeId,
    paused: window.LV_GAME.isPaused(), titleVis: vis('title'), pauseVis: vis('pause'), introVis: vis('levelIntro'), storyVis: vis('story'), levelsVis: vis('levels') };
});
const PROGRESS = JSON.stringify({ maxLevel: 3, completed: { 0: 1, 1: 1, 2: 1 }, best: { 0: 41, 1: 77, 2: 95 } });

try {
  await test('уровни игры: 10 земель', async () => {
    const { p, close } = await open('');
    const n = await p.evaluate(() => (window.LV_LEVELS || []).length);
    await close(); ok(n === 10, 'земель ' + n);
  });
  await test('legacy.html — старая версия грузится и работает сама', async () => {
    const ctx = await browser.newContext(); const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push('legacy: ' + e.message));
    await p.goto(BASE + 'legacy.html', { waitUntil: 'load' }); await wait(500);
    const r = await p.evaluate(() => ({ ui: !!window.LV_UI, host: !!window.__arcadeHost, engine: !!window.Arcade }));
    await p.keyboard.press('Enter'); await wait(300);
    const scr = await p.evaluate(() => window.LV_UI.getScreen());
    await ctx.close(); ok(r.ui && !r.host && !r.engine && (scr === 'story' || scr === 'levelIntro'), JSON.stringify(r) + ' ' + scr);
  });

  // новый игрок: пролог ещё не видел
  const { p, close } = await open('', () => { try { localStorage.clear(); } catch {} });
  await test('старт: меню движка, родной титул скрыт, тема modern по умолчанию = графика modern', async () => {
    const s = await st(p);
    ok(s.scene === 'title' && s.screen === 'title' && !s.titleVis, JSON.stringify(s));
    ok(s.theme === 'modern' && s.gfx === 'modern', 'тема ' + s.theme + '/' + s.gfx);
    const items = await p.evaluate(() => window.__arcadeHost.g.scenes.title._menu.items.map((i) => typeof i.label === 'function' ? i.label() : i.label));
    ok(items.length === 6 && /Продолжить/.test(items[1]) && /Уровни/.test(items[2]), items.join(' | '));
  });
  await test('Enter → пролог (родной) → Enter → брифинг земли 1 (родной) → Enter → игра', async () => {
    await p.keyboard.press('Enter'); await wait(300); let s = await st(p);
    ok(s.scene === 'play' && s.screen === 'story' && s.storyVis, 'пролог ' + JSON.stringify(s));
    await p.keyboard.press('Enter'); await wait(300); s = await st(p);
    ok(s.scene === 'play' && s.screen === 'levelIntro' && s.introVis, 'брифинг ' + JSON.stringify(s));
    await p.keyboard.press('Enter'); await wait(400); s = await st(p);
    ok(s.scene === 'play' && s.screen === 'playing' && s.level === 0 && !s.paused, 'игра ' + JSON.stringify(s));
  });
  await test('геймплей: стрелка вправо двигает героя; 2 / Tab переключают героев', async () => {
    const x0 = await p.evaluate(() => window.LV_GAME.state.actors.erik.x);
    await p.keyboard.down('ArrowRight'); await wait(400); await p.keyboard.up('ArrowRight');
    const x1 = await p.evaluate(() => window.LV_GAME.state.actors.erik.x);
    ok(x1 > x0, `x ${x0} → ${x1}`);
    await p.keyboard.press('Digit2'); await wait(100); let s = await st(p); ok(s.active === 'baleog', 'Digit2 ' + s.active);
    await p.keyboard.press('Tab'); await wait(100); s = await st(p); ok(s.active === 'olaf', 'Tab ' + s.active);
    await p.keyboard.press('Digit1'); await wait(100);
  });
  await test('P → пауза движка и игры (родная пауза скрыта); P → продолжить; Enter в паузе — тоже', async () => {
    await p.keyboard.press('KeyP'); await wait(200); let s = await st(p);
    ok(s.scene === 'pause' && s.screen === 'pause' && s.paused && !s.pauseVis, 'пауза ' + JSON.stringify(s));
    await p.keyboard.press('KeyP'); await wait(200); s = await st(p);
    ok(s.scene === 'play' && s.screen === 'playing' && !s.paused, 'P ' + JSON.stringify(s));
    await p.keyboard.press('Escape'); await wait(200); await p.keyboard.press('Enter'); await wait(200); s = await st(p);
    ok(s.scene === 'play' && s.screen === 'playing' && !s.paused, 'Enter ' + JSON.stringify(s));
  });
  await test('T / G → тема движка = графика игры (G: modern → retro); и обратно из игры', async () => {
    await p.keyboard.press('KeyG'); await wait(150); let s = await st(p);
    ok(s.theme === 'retro' && s.gfx === 'retro', 'G ' + JSON.stringify(s));
    await p.keyboard.press('KeyT'); await wait(150); s = await st(p);
    ok(s.theme === 'modern' && s.gfx === 'modern', 'T ' + JSON.stringify(s));
    await p.evaluate(() => window.LV_UI.toggleGfx()); await wait(150); s = await st(p);
    ok(s.theme === 'retro' && s.gfx === 'retro', 'игра→движок ' + JSON.stringify(s));
    await p.keyboard.press('KeyT'); await wait(150);
  });
  await test('L → язык движка = язык игры; и обратно', async () => {
    await p.keyboard.press('KeyL'); await wait(150); let s = await st(p);
    ok(s.lang === 'en' && s.glang === 'en', JSON.stringify(s));
    await p.evaluate(() => window.LV_UI.toggleLang()); await wait(150); s = await st(p);
    ok(s.lang === 'ru' && s.glang === 'ru', 'игра→движок ' + JSON.stringify(s));
  });
  await test('M → звук движка выкл = звук игры выкл, повтор — вкл', async () => {
    await p.keyboard.press('KeyM'); await wait(150); let s = await st(p);
    ok(!s.sound && s.muted, JSON.stringify(s));
    await p.keyboard.press('KeyM'); await wait(150); s = await st(p);
    ok(s.sound && !s.muted, JSON.stringify(s));
  });
  await test('финал саги → экран win движка, рекорд arcade.best.saga', async () => {
    await p.evaluate(() => { const G = window.LV_GAME.state; G.session.score = 4321; window.LV_UI.debug.showFinale(); }); await wait(300);
    const s = await st(p);
    ok(s.scene === 'win' && s.best === 4321, JSON.stringify(s));
    ok((await p.evaluate(() => localStorage.getItem('arcade.best.saga'))) === '4321', 'не сохранён');
    await p.keyboard.press('Enter'); await wait(250);
    const s2 = await st(p); ok(s2.scene === 'title' && s2.screen === 'title', JSON.stringify(s2));
  });
  await test('пауза → «В меню» → игра в титуле', async () => {
    await p.keyboard.press('Enter'); await wait(250); await p.keyboard.press('Enter'); await wait(300); // брифинг → игра
    let s = await st(p); ok(s.screen === 'playing', 'игра ' + JSON.stringify(s));
    await p.keyboard.press('Escape'); await wait(150);
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await wait(250);
    s = await st(p); ok(s.scene === 'title' && s.screen === 'title' && !s.paused, JSON.stringify(s));
  });
  await close();

  // игрок с прогрессом: 3 земли пройдены, пролог видел
  const o2 = await open('', (pr) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('lv.progress.v1', pr); localStorage.setItem('lv.story.v1', '{"seen":true}'); sessionStorage.setItem('seeded', '1'); } } catch {} }, PROGRESS);
  const q = o2.p;
  await test('прогресс сохранён: «Продолжить · 4» → брифинг земли 4; Esc → меню', async () => {
    const lbl = await q.evaluate(() => window.__arcadeHost.g.scenes.title._menu.items[1].label());
    ok(/· 4$/.test(lbl), lbl);
    await q.keyboard.press('ArrowDown'); await q.keyboard.press('Enter'); await wait(300);
    let s = await st(q); ok(s.scene === 'play' && s.screen === 'levelIntro' && s.introVis, JSON.stringify(s));
    ok((await q.evaluate(() => document.getElementById('intro-num').textContent)) === '04', 'не та земля');
    await q.keyboard.press('Escape'); await wait(200); s = await st(q);
    ok(s.scene === 'title' && s.screen === 'title', JSON.stringify(s));
  });
  await test('«Уровни» → родная карта; клик по земле 2 → брифинг → Enter → игра на земле 2', async () => {
    await q.keyboard.press('ArrowDown'); await q.keyboard.press('Enter'); await wait(300);
    let s = await st(q); ok(s.scene === 'play' && s.screen === 'levels' && s.levelsVis, JSON.stringify(s));
    await q.click('#level-grid .level-cell:nth-child(2)'); await wait(300);
    s = await st(q); ok(s.screen === 'levelIntro', JSON.stringify(s));
    await q.keyboard.press('Enter'); await wait(300); s = await st(q);
    ok(s.scene === 'play' && s.screen === 'playing' && s.level === 1, JSON.stringify(s));
  });
  await test('прогресс и лучшие времена в localStorage не изменились', async () => {
    const pr = JSON.parse(await q.evaluate(() => localStorage.getItem('lv.progress.v1')));
    ok(pr.maxLevel === 3 && pr.completed[2] === 1 && pr.best[0] === 41, JSON.stringify(pr));
  });
  await o2.close();

  await test('?gfx=retro&level=3 — отладочный адрес: retro, сразу земля 3, оболочка следует', async () => {
    const o = await open('?gfx=retro&level=3');
    const s = await st(o.p); await o.close();
    ok(s.scene === 'play' && s.screen === 'playing' && s.level === 2 && s.theme === 'retro' && s.gfx === 'retro', JSON.stringify(s));
  });
  await test('#gfx=retro и #gfx=modern — разные кадры игры', async () => {
    const shots = [];
    for (const g of ['retro', 'modern']) {
      const o = await open('?level=1#gfx=' + g); await wait(500);
      const s = await st(o.p); ok(s.theme === g && s.gfx === g, g + ' ' + JSON.stringify(s));
      shots.push(await o.p.locator('#stage').screenshot()); await o.close();
    }
    ok(!shots[0].equals(shots[1]), 'кадры совпали');
  });
  await test('ошибок в браузере нет', async () => { ok(errors.length === 0, errors.join(' | ')); });
} finally {
  await browser.close(); srv.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
