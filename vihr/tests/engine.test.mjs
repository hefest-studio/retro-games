/* ВИХРЬ · tests/engine.test.mjs — автотесты порта на движок v2 («оболочка» js/host.js).
   Запуск: node vihr/tests/engine.test.mjs   (нужен Playwright: глобально или npm i -D playwright)
   Поднимает свой статический сервер по корню репо и проверяет в Chromium:
   • родные самотесты игры (#test) — все PASS; legacy.html грузится без ошибок;
   • меню движка → игра (Enter), пауза P ↔ пауза игры, тема T/G ↔ gfx игры, язык L ↔ язык игры (в обе стороны),
     звук M → звук игры, «Управление» из меню и назад, финал → экран движка и рекорд arcade.best.vihr;
   • перенос старого рекорда silkworm.hi.v1; #gfx=retro|modern дают разные кадры; #shot= — без оболочки;
   • 0 ошибок pageerror / console.error. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SLUG = 'vihr';
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
async function open(hash = '', init = null) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${hash} pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`${hash} console: ${m.text()}`); });
  await p.goto(BASE + hash, { waitUntil: 'load' }); await wait(600);
  return { p, close: () => ctx.close() };
}
const st = (p) => p.evaluate(() => { const h = window.__arcadeHost, S = window.__SW; return { scene: h.g._sceneName, theme: h.g.themeName, lang: h.g.i18n.lang, sound: h.g.audio.enabled, best: h.g.state.best, mode: S.G.state, gfx: S.GFX(), glang: S.LANG(), muted: !S.CFG.sound }; });

try {
  await test('родные самотесты игры (#test) — все PASS', async () => {
    const { p, close } = await open('#test'); await wait(2500);
    const r = await p.evaluate(() => window.__SW_TESTS__ && { pass: window.__SW_TESTS__.pass, total: window.__SW_TESTS__.total });
    await close(); ok(r && r.total >= 30 && r.pass === r.total, JSON.stringify(r));
  });
  await test('legacy.html — старая версия грузится и работает сама', async () => {
    const ctx = await browser.newContext(); const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push('legacy: ' + e.message));
    await p.goto(BASE + 'legacy.html', { waitUntil: 'load' }); await wait(500);
    const r = await p.evaluate(() => ({ lm: !!window.__SW, host: !!window.__arcadeHost }));
    await p.keyboard.press('Enter'); await wait(300);
    const mode = await p.evaluate(() => window.__SW.G.state);
    await ctx.close(); ok(r.lm && !r.host && mode === 'play', JSON.stringify(r) + ' ' + mode);
  });

  const { p, close } = await open('', () => { try { localStorage.clear(); localStorage.setItem('silkworm.hi.v1', '777'); } catch {} });
  await test('старт: меню движка, игра в title, тема modern по умолчанию, рекорд перенесён', async () => {
    const s = await st(p);
    ok(s.scene === 'title' && s.mode === 'title', JSON.stringify(s));
    ok(s.theme === 'modern' && s.gfx === 'modern', 'тема ' + s.theme + '/' + s.gfx);
    ok(s.best === 777 && (await p.evaluate(() => localStorage.getItem('arcade.best.vihr'))) === '777', 'рекорд ' + s.best);
  });
  await test('Enter → игра (play/play)', async () => {
    await p.keyboard.press('Enter'); await wait(300); const s = await st(p);
    ok(s.scene === 'play' && s.mode === 'play', JSON.stringify(s));
  });
  await test('P → пауза движка и игры; Enter → продолжить', async () => {
    await p.keyboard.press('KeyP'); await wait(200); let s = await st(p);
    ok(s.scene === 'pause' && s.mode === 'pause', 'пауза ' + JSON.stringify(s));
    await p.keyboard.press('Enter'); await wait(200); s = await st(p);
    ok(s.scene === 'play' && s.mode === 'play', 'продолжить ' + JSON.stringify(s));
  });
  await test('T / G → тема движка = графика игры; и обратно из игры', async () => {
    await p.keyboard.press('KeyT'); await wait(150); let s = await st(p);
    ok(s.theme === 'retro' && s.gfx === 'retro', 'T ' + JSON.stringify(s));
    await p.keyboard.press('KeyG'); await wait(150); s = await st(p);
    ok(s.theme === 'modern' && s.gfx === 'modern', 'G ' + JSON.stringify(s));
    await p.evaluate(() => window.__SW.setGfx('retro', true)); await wait(150); s = await st(p);
    ok(s.theme === 'retro', 'игра→движок ' + JSON.stringify(s));
  });
  await test('L → язык движка = язык игры; и обратно', async () => {
    await p.keyboard.press('KeyL'); await wait(150); let s = await st(p);
    ok(s.lang === 'en' && s.glang === 'en', JSON.stringify(s));
    await p.evaluate(() => window.__SW.setLang('ru', true)); await wait(150); s = await st(p);
    ok(s.lang === 'ru', 'игра→движок ' + JSON.stringify(s));
  });
  await test('M → звук движка выкл = звук игры выкл, повтор — вкл', async () => {
    await p.keyboard.press('KeyM'); await wait(150); let s = await st(p);
    ok(!s.sound && s.muted, JSON.stringify(s));
    await p.keyboard.press('KeyM'); await wait(150); s = await st(p);
    ok(s.sound && !s.muted, JSON.stringify(s));
  });
  await test('финал игры → экран gameover движка, рекорд arcade.best.vihr', async () => {
    await p.evaluate(() => { window.__SW.G.score = 4321; window.__SW.G.state = 'gameover'; }); await wait(200);
    const s = await st(p);
    ok(s.scene === 'gameover' && s.best === 4321, JSON.stringify(s));
    ok((await p.evaluate(() => localStorage.getItem('arcade.best.vihr'))) === '4321', 'не сохранён');
    await p.keyboard.press('Enter'); await wait(200);
    const s2 = await st(p); ok(s2.scene === 'title' && s2.mode === 'title', JSON.stringify(s2));
  });
  await test('меню «Управление» → экран управления игры; Esc → меню', async () => {
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await wait(200);
    let s = await st(p); ok(s.scene === 'play' && s.mode === 'controls', JSON.stringify(s));
    await p.keyboard.press('Escape'); await wait(200); s = await st(p);
    ok(s.scene === 'title' && s.mode === 'title', JSON.stringify(s));
  });
  await test('пауза → «В меню» → игра в title', async () => {
    await p.keyboard.press('ArrowUp'); await p.keyboard.press('Enter'); await wait(200);
    await p.keyboard.press('Escape'); await wait(150);
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await wait(200);
    const s = await st(p); ok(s.scene === 'title' && s.mode === 'title', JSON.stringify(s));
  });
  await close();

  await test('#gfx=retro и #gfx=modern — разные кадры игры', async () => {
    const shots = [];
    for (const g of ['retro', 'modern']) {
      const o = await open('#gfx=' + g); await o.p.keyboard.press('Enter'); await wait(800);
      const s = await st(o.p); ok(s.theme === g && s.gfx === g, g + ' ' + JSON.stringify(s));
      shots.push(await o.p.locator('#game').screenshot()); await o.close();
    }
    ok(!shots[0].equals(shots[1]), 'кадры совпали');
  });
  await test('#shot=play — отладочный режим без оболочки', async () => {
    const o = await open('#shot=play&stage=1');
    const r = await o.p.evaluate(() => ({ host: !!window.__arcadeHost, mode: window.__SW.G.state, attr: document.documentElement.getAttribute('data-arcade-scene') }));
    await o.close(); ok(!r.host && r.mode === 'play' && r.attr === 'off', JSON.stringify(r));
  });
  await test('ошибок в браузере нет', async () => { ok(errors.length === 0, errors.join(' | ')); });
} finally {
  await browser.close(); srv.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
