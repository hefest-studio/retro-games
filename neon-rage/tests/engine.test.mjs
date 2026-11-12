/* НЕОН × ЯРОСТЬ · tests/engine.test.mjs — автотесты порта на движок v2 («хост поверх игры», js/host.js).
   Запуск: node neon-rage/tests/engine.test.mjs   (нужен Playwright: глобально или npm i -D playwright)
   Поднимает свой статический сервер по корню репо и проверяет в Chromium:
   • legacy.html — прежний монолит грузится и работает сам (без оболочки);
   • перенос старого рекорда (dd-neon-settings-v1.best → arcade.best.neon-rage), тема modern по умолчанию;
   • меню движка → Enter → выбор героя игры → Enter → сюжет → Esc «пропустить» → бой, волна 1 стартует;
   • P/Esc — пауза движка = заморозка боя (без родного меню паузы), снятие; тач-кнопка II — через движок;
   • T/G — тема движка = графика игры, L — язык (в обе стороны); L в бою не тратит ярость, ярость — V;
   • M — звук движка = музыка + эффекты игры; «Управление»/«Настройки» из меню и Esc назад;
     Esc на выборе героя — назад в меню; пауза → «В меню»; финал → экран движка и рекорд;
   • #gfx=retro|modern&demo=1 (tools/thumbs.mjs) — сразу бой без меню, разные кадры; #scene=intro — родной экран;
   • 0 ошибок pageerror / console.error. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SLUG = 'neon-rage';
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
async function open(hash = '', init = null, page = '') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${page}${hash} pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`${page}${hash} console: ${m.text()}`); });
  await p.goto(BASE + page + hash, { waitUntil: 'load' }); await wait(700);
  return { p, close: () => ctx.close() };
}
const st = (p) => p.evaluate(() => {
  const h = window.__arcadeHost, D = window.DD, S = D.state;
  return { scene: h.g._sceneName, theme: h.g.themeName, lang: h.g.i18n.lang, sound: h.g.audio.enabled, best: h.g.state.best,
    mode: S.mode, frozen: !!S.freeze, gfx: D.settings.gfx, glang: D.settings.lang, music: D.settings.music, sfx: D.settings.sfx,
    wave: S.run.wave, waveActive: S.run.waveActive, enemies: S.enemies.filter((e) => !e.dead).length };
});
const key = async (p, k, ms = 250) => { await p.keyboard.press(k); await wait(ms); };

try {
  await test('legacy.html — прежний монолит грузится и работает сам', async () => {
    const o = await open('', null, 'legacy.html');
    const r = await o.p.evaluate(() => ({ dd: !!window.DD, host: !!window.__arcadeHost, mode: window.DD.state.mode }));
    await key(o.p, 'Enter', 300);
    const mode = await o.p.evaluate(() => window.DD.state.mode);
    await o.close(); ok(r.dd && !r.host && r.mode === 'title' && mode === 'select', JSON.stringify(r) + ' ' + mode);
  });

  const { p, close } = await open('', () => {
    try { localStorage.clear(); localStorage.setItem('dd-neon-settings-v1', JSON.stringify({ lang: 'ru', gfx: 'retro', best: 777 })); } catch {}
  });
  await test('старт: меню движка, игра в title, тема modern по умолчанию, рекорд перенесён', async () => {
    const s = await st(p);
    ok(s.scene === 'title' && s.mode === 'title', JSON.stringify(s));
    ok(s.theme === 'modern' && s.gfx === 'modern', 'тема ' + s.theme + '/' + s.gfx);
    ok(s.best === 777 && (await p.evaluate(() => localStorage.getItem('arcade.best.neon-rage'))) === '777', 'рекорд ' + s.best);
  });
  await test('Enter → выбор героя игры (движок прозрачен) → Enter → сюжет', async () => {
    await key(p, 'Enter'); let s = await st(p);
    ok(s.scene === 'play' && s.mode === 'select', 'выбор ' + JSON.stringify(s));
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('canvas.arcade-host')).pointerEvents === 'none'), 'canvas движка ловит касания');
    await key(p, 'Enter'); s = await st(p);
    ok(s.scene === 'play' && s.mode === 'intro', 'сюжет ' + JSON.stringify(s));
  });
  await test('Esc на сюжете — «пропустить» (игре, не движку) → бой; идём вправо → волна 1', async () => {
    await key(p, 'Escape'); let s = await st(p);
    ok(s.scene === 'play' && s.mode === 'play', 'бой ' + JSON.stringify(s));
    await p.keyboard.down('KeyD'); await wait(2600); await p.keyboard.up('KeyD'); await wait(300);
    s = await st(p); ok(s.waveActive && s.enemies > 0, 'волна ' + JSON.stringify(s));
  });
  await test('P → пауза движка = заморозка боя (без родного меню паузы); Enter → продолжить', async () => {
    await key(p, 'KeyP'); let s = await st(p);
    ok(s.scene === 'pause' && s.mode === 'play' && s.frozen, 'пауза ' + JSON.stringify(s));
    const x0 = await p.evaluate(() => DD.state.enemies.map((e) => e.x + ',' + e.y).join(';'));
    await wait(500);
    ok(x0 === (await p.evaluate(() => DD.state.enemies.map((e) => e.x + ',' + e.y).join(';'))), 'враги двигаются на паузе');
    await key(p, 'Enter'); s = await st(p);
    ok(s.scene === 'play' && s.mode === 'play' && !s.frozen, 'продолжить ' + JSON.stringify(s));
  });
  await test('Esc в бою → пауза; Esc → продолжить', async () => {
    await key(p, 'Escape'); let s = await st(p); ok(s.scene === 'pause' && s.frozen, JSON.stringify(s));
    await key(p, 'Escape'); s = await st(p); ok(s.scene === 'play' && !s.frozen, JSON.stringify(s));
  });
  await test('тач-кнопка II игры → пауза движка, ещё раз → продолжить', async () => {
    const tap = () => p.evaluate(() => document.getElementById('tpause').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
    await tap(); await wait(250); let s = await st(p); ok(s.scene === 'pause' && s.frozen, 'пауза ' + JSON.stringify(s));
    await tap(); await wait(250); s = await st(p); ok(s.scene === 'play' && !s.frozen, 'продолжить ' + JSON.stringify(s));
  });
  await test('T / G → тема движка = графика игры; и обратно из игры', async () => {
    await key(p, 'KeyT', 150); let s = await st(p);
    ok(s.theme === 'retro' && s.gfx === 'retro', 'T ' + JSON.stringify(s));
    await key(p, 'KeyG', 150); s = await st(p);
    ok(s.theme === 'modern' && s.gfx === 'modern', 'G ' + JSON.stringify(s));
    await p.evaluate(() => DD.toggleGfx()); await wait(150); s = await st(p);
    ok(s.theme === 'retro', 'игра→движок ' + JSON.stringify(s));
    await key(p, 'KeyT', 150);
  });
  await test('L → язык движка = язык игры (и обратно); в бою L не тратит ярость, ярость — V', async () => {
    await p.evaluate(() => DD.debug.rage());
    await key(p, 'KeyL', 150); let s = await st(p);
    ok(s.lang === 'en' && s.glang === 'en', JSON.stringify(s));
    ok(await p.evaluate(() => DD.state.player.rage === DD.state.player.maxRage), 'L потратил ярость');
    await p.evaluate(() => DD.toggleLang()); await wait(150); s = await st(p);
    ok(s.lang === 'ru', 'игра→движок ' + JSON.stringify(s));
    await key(p, 'KeyV', 300);
    ok(await p.evaluate(() => DD.state.player.rage < DD.state.player.maxRage), 'V не сработал');
  });
  await test('M → звук движка выкл = музыка и эффекты игры выкл, повтор — вкл', async () => {
    await key(p, 'KeyM', 150); let s = await st(p);
    ok(!s.sound && !s.music && !s.sfx, JSON.stringify(s));
    await key(p, 'KeyM', 150); s = await st(p);
    ok(s.sound && s.music && s.sfx, JSON.stringify(s));
  });
  await test('пауза → «В меню» → меню движка, игра в title', async () => {
    await key(p, 'KeyP', 150); await key(p, 'ArrowDown', 80); await key(p, 'ArrowDown', 80); await key(p, 'Enter');
    const s = await st(p); ok(s.scene === 'title' && s.mode === 'title' && !s.frozen, JSON.stringify(s));
  });
  await test('меню «Управление» → справка игры; Esc → меню; «Настройки» → настройки; Esc → меню', async () => {
    await key(p, 'ArrowDown', 80); await key(p, 'Enter'); let s = await st(p);
    ok(s.scene === 'play' && s.mode === 'help', 'справка ' + JSON.stringify(s));
    await key(p, 'Escape'); s = await st(p); ok(s.scene === 'title' && s.mode === 'title', 'назад ' + JSON.stringify(s));
    await key(p, 'ArrowDown', 80); await key(p, 'Enter'); s = await st(p);
    ok(s.scene === 'play' && s.mode === 'settings', 'настройки ' + JSON.stringify(s));
    await key(p, 'Escape'); s = await st(p); ok(s.scene === 'title' && s.mode === 'title', 'назад ' + JSON.stringify(s));
  });
  await test('Esc на выборе героя → меню движка', async () => {
    await key(p, 'ArrowUp', 80); await key(p, 'ArrowUp', 80); await key(p, 'Enter');
    let s = await st(p); ok(s.mode === 'select', JSON.stringify(s));
    await key(p, 'Escape'); s = await st(p); ok(s.scene === 'title' && s.mode === 'title', JSON.stringify(s));
  });
  await test('финал игры → экран gameover движка, рекорд arcade.best.neon-rage; Enter → меню', async () => {
    await key(p, 'Enter'); await key(p, 'Enter'); await key(p, 'Enter');
    let s = await st(p); ok(s.mode === 'play', 'не в бою ' + JSON.stringify(s));
    await p.evaluate(() => { DD.state.run.score = 4321; DD.finishRun(false); }); await wait(300);
    s = await st(p); ok(s.scene === 'gameover' && s.best === 4321, JSON.stringify(s));
    ok((await p.evaluate(() => localStorage.getItem('arcade.best.neon-rage'))) === '4321', 'не сохранён');
    await key(p, 'Enter'); s = await st(p); ok(s.scene === 'title' && s.mode === 'title', JSON.stringify(s));
  });
  await test('победа → экран win движка', async () => {
    await key(p, 'Enter'); await key(p, 'Enter'); await key(p, 'Escape');
    await p.evaluate(() => { DD.state.run.score = 100; DD.finishRun(true); }); await wait(300);
    const s = await st(p); ok(s.scene === 'win', JSON.stringify(s));
    await key(p, 'Enter');
  });
  await close();

  await test('#gfx=retro|modern&demo=1 (thumbs) — сразу бой без меню, тема = графика, разные кадры', async () => {
    const shots = [];
    for (const g of ['retro', 'modern']) {
      const o = await open('#gfx=' + g + '&demo=1'); await wait(500);
      const s = await st(o.p); ok(s.scene === 'play' && s.mode === 'play' && s.theme === g && s.gfx === g && s.enemies > 0, g + ' ' + JSON.stringify(s));
      shots.push(await o.p.screenshot()); await o.close();
    }
    ok(!shots[0].equals(shots[1]), 'кадры совпали');
  });
  await test('#scene=intro&lang=en — родной экран игры, язык en у обоих', async () => {
    const o = await open('#scene=intro&lang=en'); const s = await st(o.p); await o.close();
    ok(s.scene === 'play' && s.mode === 'intro' && s.lang === 'en' && s.glang === 'en', JSON.stringify(s));
  });
  await test('ошибок в браузере нет', async () => { ok(errors.length === 0, errors.join(' | ')); });
} finally {
  await browser.close(); srv.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
