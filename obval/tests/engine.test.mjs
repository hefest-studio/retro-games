/* ОБВАЛ · tests/engine.test.mjs — автотесты порта на движок v2 («оболочка» js/host.js).
   Запуск: node obval/tests/engine.test.mjs   (нужен Playwright: глобально или npm i -D playwright)
   Поднимает свой статический сервер по корню репо и проверяет в Chromium:
   • данные уровней валидны (OBVAL.validateLevels); legacy.html грузится без ошибок;
   (полные логические тесты игры — node obval/tools/logic-test.mjs, нужен Chrome: CHROME=…)
   • меню движка → игра (Enter), пауза P ↔ пауза игры, тема T/G ↔ gfx игры, язык L ↔ язык игры (в обе стороны),
     звук M → музыка+эффекты игры, «Уровни» из меню и назад, финал → экран движка и рекорд arcade.best.obval;
   • игра, запущенная своим интерфейсом (кнопка уровня), и снятие паузы тач-кнопкой игры — движок следует;
   • перенос старого рекорда; миграция ключей bd84:* → obval:*; #gfx=retro|modern дают разные кадры; #shot= — без оболочки;
   • 0 ошибок pageerror / console.error.
   Ожидания — по состоянию игры/движка (until/untilJs с таймаутом), а не по фиксированным паузам:
   под нагрузкой синхронизация оболочки и игры может занять больше кадра. */
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
  await p.goto(BASE + hash, { waitUntil: 'load' });
  await p.waitForFunction(() => window.OBVAL && window.OBVAL.debug && window.OBVAL.debug.S && (!window.__arcadeHost || window.__arcadeHost.g._sceneName), null, { timeout: 15000 });
  await wait(300);
  return { p, close: () => ctx.close() };
}
const st = (p) => p.evaluate(() => { const h = window.__arcadeHost, B = window.OBVAL, S = B.debug.S; return { scene: h.g._sceneName, theme: h.g.themeName, lang: h.g.i18n.lang, sound: h.g.audio.enabled, best: h.g.state.best, mode: S.screen, gfx: B.debug.GFX.mode, glang: document.documentElement.lang, muted: !B.debug.Sound.musicOn && !B.debug.Sound.sfxOn, overlay: getComputedStyle(document.getElementById('overlay')).display }; });
// ждать, пока состояние (st) не удовлетворит условию; по таймауту — ошибка с последним состоянием
async function until(p, pred, what = 'таймаут', ms = 10000) {
  const t0 = Date.now(); let s;
  for (;;) {
    s = await st(p); if (pred(s)) return s;
    if (Date.now() - t0 > ms) throw new Error(what + ' ' + JSON.stringify(s));
    await wait(40);
  }
}
// то же для произвольного выражения в странице
async function untilJs(p, fn, what = 'таймаут', ms = 10000) {
  try { await p.waitForFunction(fn, null, { timeout: ms, polling: 40 }); } catch { throw new Error(what + ' ' + JSON.stringify(await p.evaluate(fn))); }
}
const isPlay = (s) => s.scene === 'play' && s.mode === 'playing';
const isMenu = (s) => s.scene === 'title' && s.mode === 'menu';

try {
  await test('уровни игры: 8 камер, структурная проверка без замечаний', async () => {
    const { p, close } = await open('');
    const r = await p.evaluate(() => ({ n: window.OBVAL.levels.length, issues: window.OBVAL.validateLevels().length }));
    await close(); ok(r.n === 8 && r.issues === 0, JSON.stringify(r));
  });
  await test('legacy.html — старая версия грузится и работает сама', async () => {
    const ctx = await browser.newContext(); const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push('legacy: ' + e.message));
    await p.goto(BASE + 'legacy.html', { waitUntil: 'load' });
    await untilJs(p, () => !!(window.OBVAL && window.OBVAL.debug && window.OBVAL.debug.S.screen === 'menu'), 'legacy: нет меню');
    const r = await p.evaluate(() => ({ lm: !!window.OBVAL, host: !!window.__arcadeHost }));
    await p.keyboard.press('Enter');
    let mode = 'нет';
    try { await untilJs(p, () => window.OBVAL.debug.S.screen === 'playing', 'legacy: Enter'); mode = 'playing'; } catch { mode = await p.evaluate(() => window.OBVAL.debug.S.screen); }
    await ctx.close(); ok(r.lm && !r.host && mode === 'playing', JSON.stringify(r) + ' ' + mode);
  });

  await test('миграция localStorage: bd84:* → obval:*, старые удалены, новые не затираются', async () => {
    const o = await open('legacy.html', () => { try { if (sessionStorage.getItem('mig')) return; sessionStorage.setItem('mig', '1'); localStorage.clear();
      localStorage.setItem('bd84:best', '4242'); localStorage.setItem('bd84:lang', '"en"'); localStorage.setItem('bd84:completed', '[0,1]');
      localStorage.setItem('obval:best', '5000'); } catch {} });
    const r = await o.p.evaluate(() => ({ ls: Object.keys(localStorage).sort().map((k) => k + '=' + localStorage.getItem(k)), best: window.OBVAL.debug.S.best }));
    await o.close();
    const ls = r.ls.join(' ');
    ok(!/bd84:/.test(ls), 'старые ключи не удалены: ' + ls);
    ok(/obval:lang="en"/.test(ls) && /obval:completed=\[0,1\]/.test(ls), 'не перенесены: ' + ls);
    ok(/obval:best=5000/.test(ls) && r.best === 5000, 'новый рекорд затёрт старым: ' + ls);
  });
  const { p, close } = await open('', () => { try { localStorage.clear(); localStorage.setItem('bd84:best', '777'); } catch {} });
  await test('старт: меню движка, игра в title, тема modern по умолчанию, рекорд перенесён', async () => {
    const s = await until(p, (x) => isMenu(x) && x.overlay === 'none', 'старт');
    ok(s.theme === 'modern' && s.gfx === 'modern', 'тема ' + s.theme + '/' + s.gfx);
    ok(s.best === 777 && (await p.evaluate(() => localStorage.getItem('arcade.best.obval'))) === '777', 'рекорд ' + s.best);
  });
  await test('Enter → игра (play/play)', async () => {
    await p.keyboard.press('Enter'); await until(p, isPlay, 'Enter');
  });
  await test('P → пауза движка и игры; Enter → продолжить', async () => {
    await p.keyboard.press('KeyP'); await until(p, (s) => s.scene === 'pause' && s.mode === 'paused', 'пауза');
    await p.keyboard.press('Enter'); await until(p, isPlay, 'продолжить');
  });
  await test('T / G → тема движка = графика игры; и обратно из игры', async () => {
    await p.keyboard.press('KeyT'); await until(p, (s) => s.theme === 'retro' && s.gfx === 'retro', 'T');
    await p.keyboard.press('KeyG'); await until(p, (s) => s.theme === 'modern' && s.gfx === 'modern', 'G');
    await p.evaluate(() => window.OBVAL.setGraphics('retro', true)); await until(p, (s) => s.theme === 'retro' && s.gfx === 'retro', 'игра→движок');
  });
  await test('L → язык движка = язык игры; и обратно', async () => {
    await p.keyboard.press('KeyL'); await until(p, (s) => s.lang === 'en' && s.glang === 'en', 'L');
    await p.evaluate(() => window.OBVAL.setLanguage('ru', true)); await until(p, (s) => s.lang === 'ru' && s.glang === 'ru', 'игра→движок');
  });
  await test('M → звук движка выкл = музыка и эффекты игры выкл, повтор — вкл', async () => {
    await p.keyboard.press('KeyM'); await until(p, (s) => !s.sound && s.muted, 'M выкл');
    await p.keyboard.press('KeyM'); await until(p, (s) => s.sound && !s.muted, 'M вкл');
    ok(await p.evaluate(() => window.OBVAL.debug.Sound.musicOn && window.OBVAL.debug.Sound.sfxOn), 'музыка/эффекты не включились');
  });
  await test('финал игры → экран gameover движка, рекорд arcade.best.obval', async () => {
    await p.evaluate(() => { const S = window.OBVAL.debug.S; S.score = 4321; S.lives = 1; window.OBVAL.debug.killPlayer('rock'); });
    await until(p, (s) => s.scene === 'gameover' && s.best === 4321, 'gameover', 15000);
    await untilJs(p, () => localStorage.getItem('arcade.best.obval') === '4321', 'рекорд не сохранён');
    await p.keyboard.press('Enter'); await until(p, isMenu, 'gameover → меню');
  });
  await test('меню «Уровни» → выбор уровня игры; Esc → меню', async () => {
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
    await until(p, (s) => s.scene === 'play' && s.mode === 'levels' && s.overlay !== 'none', 'Уровни');
    await p.keyboard.press('Escape'); await until(p, isMenu, 'Esc → меню');
  });
  await test('пауза → «В меню» → игра в title', async () => {
    await p.keyboard.press('ArrowUp'); await p.keyboard.press('Enter'); await until(p, isPlay, 'меню → игра');
    await p.keyboard.press('Escape'); await until(p, (s) => s.scene === 'pause' && s.mode === 'paused', 'Esc → пауза');
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
    await until(p, isMenu, '«В меню»');
  });
  await test('кнопка уровня игры (панель «Уровни») → движок переходит в игру', async () => {
    await p.evaluate(() => document.querySelector('#levelGrid [data-level="1"]').click());
    await until(p, isPlay, 'кнопка уровня');
    ok((await p.evaluate(() => window.OBVAL.debug.S.level)) === 1, 'уровень ' + (await p.evaluate(() => window.OBVAL.debug.S.level)));
  });
  await test('пауза/продолжение тач-кнопкой игры (Ⅱ) — движок следует', async () => {
    await p.evaluate(() => document.querySelector('.tp-pause').click());
    await until(p, (s) => s.scene === 'pause' && s.mode === 'paused', 'пауза');
    await p.evaluate(() => window.OBVAL.resume()); await until(p, isPlay, 'продолжить');
  });
  await close();

  await test('#gfx=retro и #gfx=modern — разные кадры игры', async () => {
    const shots = [];
    for (const g of ['retro', 'modern']) {
      const o = await open('#gfx=' + g); await o.p.keyboard.press('Enter');
      await until(o.p, (s) => isPlay(s) && s.theme === g && s.gfx === g, g);
      await o.p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); await wait(300);
      shots.push(await o.p.locator('#game').screenshot()); await o.close();
    }
    ok(!shots[0].equals(shots[1]), 'кадры совпали');
  });
  await test('#shot= — отладочный режим без оболочки (родное меню игры)', async () => {
    const o = await open('#shot=play');
    const r = await o.p.evaluate(() => ({ host: !!window.__arcadeHost, mode: window.OBVAL.debug.S.screen, attr: document.documentElement.getAttribute('data-arcade-scene') }));
    await o.close(); ok(!r.host && r.mode === 'menu' && r.attr === 'off', JSON.stringify(r));
  });
  await test('ошибок в браузере нет', async () => { ok(errors.length === 0, errors.join(' | ')); });
} finally {
  await browser.close(); srv.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
