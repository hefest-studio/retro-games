/* ОБВАЛ · tests/engine.test.mjs — автотесты порта на движок v2 («оболочка» js/host.js).
   Запуск: node obval/tests/engine.test.mjs   (нужен Playwright: глобально или npm i -D playwright)
   Поднимает свой статический сервер по корню репо и проверяет в Chromium:
   • данные уровней валидны (BD.validateLevels); legacy.html грузится без ошибок;
   (полные логические тесты игры — node obval/tools/logic-test.mjs, нужен Chrome: CHROME=…)
   • меню движка → игра (Enter), пауза P ↔ пауза игры, тема T/G ↔ gfx игры, язык L ↔ язык игры (в обе стороны),
     звук M → музыка+эффекты игры, «Уровни» из меню и назад, финал → экран движка и рекорд arcade.best.obval;
   • игра, запущенная своим интерфейсом (кнопка уровня), и снятие паузы тач-кнопкой игры — движок следует;
   • перенос старого рекорда bd84:best; #gfx=retro|modern дают разные кадры; #shot= — без оболочки;
   • 0 ошибок pageerror / console.error. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SLUG = 'obval';
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
const st = (p) => p.evaluate(() => { const h = window.__arcadeHost, B = window.BD, S = B.debug.S; return { scene: h.g._sceneName, theme: h.g.themeName, lang: h.g.i18n.lang, sound: h.g.audio.enabled, best: h.g.state.best, mode: S.screen, gfx: B.debug.GFX.mode, glang: document.documentElement.lang, muted: !B.debug.Sound.musicOn && !B.debug.Sound.sfxOn, overlay: getComputedStyle(document.getElementById('overlay')).display }; });

try {
  await test('уровни игры: 8 камер, структурная проверка без замечаний', async () => {
    const { p, close } = await open('');
    const r = await p.evaluate(() => ({ n: window.BD.levels.length, issues: window.BD.validateLevels().length }));
    await close(); ok(r.n === 8 && r.issues === 0, JSON.stringify(r));
  });
  await test('legacy.html — старая версия грузится и работает сама', async () => {
    const ctx = await browser.newContext(); const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push('legacy: ' + e.message));
    await p.goto(BASE + 'legacy.html', { waitUntil: 'load' }); await wait(500);
    const r = await p.evaluate(() => ({ lm: !!window.BD, host: !!window.__arcadeHost }));
    await p.keyboard.press('Enter'); await wait(300);
    const mode = await p.evaluate(() => window.BD.debug.S.screen);
    await ctx.close(); ok(r.lm && !r.host && mode === 'playing', JSON.stringify(r) + ' ' + mode);
  });

  const { p, close } = await open('', () => { try { localStorage.clear(); localStorage.setItem('bd84:best', '777'); } catch {} });
  await test('старт: меню движка, игра в title, тема modern по умолчанию, рекорд перенесён', async () => {
    const s = await st(p);
    ok(s.scene === 'title' && s.mode === 'menu' && s.overlay === 'none', JSON.stringify(s));
    ok(s.theme === 'modern' && s.gfx === 'modern', 'тема ' + s.theme + '/' + s.gfx);
    ok(s.best === 777 && (await p.evaluate(() => localStorage.getItem('arcade.best.obval'))) === '777', 'рекорд ' + s.best);
  });
  await test('Enter → игра (play/play)', async () => {
    await p.keyboard.press('Enter'); await wait(300); const s = await st(p);
    ok(s.scene === 'play' && s.mode === 'playing', JSON.stringify(s));
  });
  await test('P → пауза движка и игры; Enter → продолжить', async () => {
    await p.keyboard.press('KeyP'); await wait(200); let s = await st(p);
    ok(s.scene === 'pause' && s.mode === 'paused', 'пауза ' + JSON.stringify(s));
    await p.keyboard.press('Enter'); await wait(200); s = await st(p);
    ok(s.scene === 'play' && s.mode === 'playing', 'продолжить ' + JSON.stringify(s));
  });
  await test('T / G → тема движка = графика игры; и обратно из игры', async () => {
    await p.keyboard.press('KeyT'); await wait(150); let s = await st(p);
    ok(s.theme === 'retro' && s.gfx === 'retro', 'T ' + JSON.stringify(s));
    await p.keyboard.press('KeyG'); await wait(150); s = await st(p);
    ok(s.theme === 'modern' && s.gfx === 'modern', 'G ' + JSON.stringify(s));
    await p.evaluate(() => window.BD.setGraphics('retro', true)); await wait(150); s = await st(p);
    ok(s.theme === 'retro', 'игра→движок ' + JSON.stringify(s));
  });
  await test('L → язык движка = язык игры; и обратно', async () => {
    await p.keyboard.press('KeyL'); await wait(150); let s = await st(p);
    ok(s.lang === 'en' && s.glang === 'en', JSON.stringify(s));
    await p.evaluate(() => window.BD.setLanguage('ru', true)); await wait(150); s = await st(p);
    ok(s.lang === 'ru', 'игра→движок ' + JSON.stringify(s));
  });
  await test('M → звук движка выкл = музыка и эффекты игры выкл, повтор — вкл', async () => {
    await p.keyboard.press('KeyM'); await wait(150); let s = await st(p);
    ok(!s.sound && s.muted, JSON.stringify(s));
    await p.keyboard.press('KeyM'); await wait(150); s = await st(p);
    ok(s.sound && (await p.evaluate(() => window.BD.debug.Sound.musicOn && window.BD.debug.Sound.sfxOn)), JSON.stringify(s));
  });
  await test('финал игры → экран gameover движка, рекорд arcade.best.obval', async () => {
    await p.evaluate(() => { const S = window.BD.debug.S; S.score = 4321; S.lives = 1; window.BD.debug.killPlayer('rock'); }); await wait(1500); await wait(200);
    const s = await st(p);
    ok(s.scene === 'gameover' && s.best === 4321, JSON.stringify(s));
    ok((await p.evaluate(() => localStorage.getItem('arcade.best.obval'))) === '4321', 'не сохранён');
    await p.keyboard.press('Enter'); await wait(200);
    const s2 = await st(p); ok(s2.scene === 'title' && s2.mode === 'menu', JSON.stringify(s2));
  });
  await test('меню «Уровни» → выбор уровня игры; Esc → меню', async () => {
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await wait(200);
    let s = await st(p); ok(s.scene === 'play' && s.mode === 'levels' && s.overlay !== 'none', JSON.stringify(s));
    await p.keyboard.press('Escape'); await wait(200); s = await st(p);
    ok(s.scene === 'title' && s.mode === 'menu', JSON.stringify(s));
  });
  await test('пауза → «В меню» → игра в title', async () => {
    await p.keyboard.press('ArrowUp'); await p.keyboard.press('Enter'); await wait(200);
    await p.keyboard.press('Escape'); await wait(150);
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await wait(200);
    const s = await st(p); ok(s.scene === 'title' && s.mode === 'menu', JSON.stringify(s));
  });
  await test('кнопка уровня игры (панель «Уровни») → движок переходит в игру', async () => {
    await p.evaluate(() => document.querySelector('#levelGrid [data-level="1"]').click()); await wait(200);
    const s = await st(p); ok(s.scene === 'play' && s.mode === 'playing' && (await p.evaluate(() => window.BD.debug.S.level)) === 1, JSON.stringify(s));
  });
  await test('пауза/продолжение тач-кнопкой игры (Ⅱ) — движок следует', async () => {
    await p.evaluate(() => document.querySelector('.tp-pause').click()); await wait(200);
    let s = await st(p); ok(s.scene === 'pause' && s.mode === 'paused', 'пауза ' + JSON.stringify(s));
    await p.evaluate(() => window.BD.resume()); await wait(200);
    s = await st(p); ok(s.scene === 'play' && s.mode === 'playing', 'продолжить ' + JSON.stringify(s));
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
  await test('#shot= — отладочный режим без оболочки (родное меню игры)', async () => {
    const o = await open('#shot=play');
    const r = await o.p.evaluate(() => ({ host: !!window.__arcadeHost, mode: window.BD.debug.S.screen, attr: document.documentElement.getAttribute('data-arcade-scene') }));
    await o.close(); ok(!r.host && r.mode === 'menu' && r.attr === 'off', JSON.stringify(r));
  });
  await test('ошибок в браузере нет', async () => { ok(errors.length === 0, errors.join(' | ')); });
} finally {
  await browser.close(); srv.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
