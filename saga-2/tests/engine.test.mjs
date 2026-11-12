/* СЕВЕРНАЯ САГА 2 · tests/engine.test.mjs — автотесты порта на движок v2 («оболочка» js/host.js).
   Запуск: node saga-2/tests/engine.test.mjs   (нужен Playwright: глобально или npm i -D playwright)
   Поднимает свой статический сервер по корню репо и проверяет в Chromium:
   • 6 саг на месте, пиксельные викинги подключены; legacy.html грузится и работает сама (без оболочки);
   • меню движка (Играть / Продолжить / Саги / Язык / Тема / Звук) → брифинг (родной) → игра (Enter);
   • пауза P ↔ пауза игры, тема T/G ↔ графика игры (modern = AURORA, retro = 8-BIT), язык L (меню) / Y (игра),
     звук M → звук игры; в игре L — крюк Гуннара, 1/2/3/Tab — герои;
   • финал → экран win движка и рекорд arcade.best.saga-2 (старый — сумма лучших очков саг — переносится);
   • прогресс saga2.progress не теряется, старые ключи «lv2.*» мигрируют; ?mode= / ?level= / ?screen=levels / #gfx= работают;
   • облик героев: блок HERO-SPRITES дословно и попиксельно общий для саг 1 и 2, прозвища — свои;
   • 0 ошибок pageerror / console.error. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SLUG = 'saga-2';
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
  const h = window.__arcadeHost, M = window.SAGA2.main, g = M.game();
  const vis = (s) => { const el = document.querySelector('.screen-root > section[data-screen="' + s + '"]'); return !!el && getComputedStyle(el).display !== 'none'; };
  return { scene: h.g._sceneName, theme: h.g.themeName, lang: h.g.i18n.lang, sound: h.g.audio.enabled, best: h.g.state.best,
    screen: document.body.getAttribute('data-screen'), mode: M.state.mode, glang: M.state.lang, muted: M.state.muted,
    level: g.levelIndex, active: g.active, titleVis: vis('title'), pauseVis: vis('pause'), briefVis: vis('brief'), levelsVis: vis('levels') };
});
const PROGRESS = JSON.stringify({ unlocked: 3, levels: { 0: { done: true, runes: 3, time: 61, deaths: 0, score: 500 }, 1: { done: true, runes: 2, time: 90, deaths: 1, score: 700 } } });
const seed = (pr) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); if (pr) localStorage.setItem('saga2.progress', pr); sessionStorage.setItem('seeded', '1'); } } catch {} };

try {
  await test('уровни игры: 6 саг; пиксельные викинги (vikings-retro.js) подключены', async () => {
    const { p, close } = await open('');
    const r = await p.evaluate(() => ({ n: (window.SAGA2.LEVELS || []).length, vr: !!document.querySelector('script[src="js/vikings-retro.js"]') }));
    await close(); ok(r.n === 6 && r.vr, JSON.stringify(r));
  });
  await test('legacy.html — старая версия грузится и работает сама', async () => {
    const ctx = await browser.newContext(); const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push('legacy: ' + e.message));
    await p.goto(BASE + 'legacy.html', { waitUntil: 'load' }); await wait(600);
    const r = await p.evaluate(() => ({ main: !!(window.SAGA2 && window.SAGA2.main), host: !!window.__arcadeHost, engine: !!window.Arcade, screen: document.body.dataset.screen }));
    await p.getByText(/новая сага/i).first().click(); await wait(400);
    const scr = await p.evaluate(() => document.body.dataset.screen);
    await ctx.close(); ok(r.main && !r.host && !r.engine && r.screen === 'title' && scr === 'brief', JSON.stringify(r) + ' ' + scr);
  });

  const { p, close } = await open('', seed, PROGRESS);
  await test('старт: меню движка, родной титул скрыт, тема modern = AURORA, старый рекорд (сумма очков саг) перенесён', async () => {
    const s = await st(p);
    ok(s.scene === 'title' && s.screen === 'title' && !s.titleVis, JSON.stringify(s));
    ok(s.theme === 'modern' && s.mode === 'aurora', 'тема ' + s.theme + '/' + s.mode);
    ok(s.best === 1200 && (await p.evaluate(() => localStorage.getItem('arcade.best.saga-2'))) === '1200', 'рекорд ' + s.best);
    const items = await p.evaluate(() => window.__arcadeHost.g.scenes.title._menu.items.map((i) => i.label()));
    ok(items.length === 6 && /Продолжить · 3/.test(items[1]) && /Саги/.test(items[2]), items.join(' | '));
  });
  await test('Enter → брифинг саги 1 (родной, «В путь») → Enter → игра', async () => {
    await p.keyboard.press('Enter'); await wait(400); let s = await st(p);
    ok(s.scene === 'play' && s.screen === 'brief' && s.briefVis && s.level === 0, 'брифинг ' + JSON.stringify(s));
    await p.keyboard.press('Enter'); await wait(400); s = await st(p);
    ok(s.scene === 'play' && s.screen === 'play', 'игра ' + JSON.stringify(s));
  });
  await test('геймплей: стрелка вправо двигает героя; 2 / Tab переключают героев; L — крюк (язык не меняется)', async () => {
    const x0 = await p.evaluate(() => window.SAGA2.main.game().getDebugState().actors[0].x);
    await p.keyboard.down('ArrowRight'); await wait(500); await p.keyboard.up('ArrowRight');
    const x1 = await p.evaluate(() => window.SAGA2.main.game().getDebugState().actors[0].x);
    ok(x1 > x0, `x ${x0} → ${x1}`);
    await p.keyboard.press('Digit2'); await wait(100); let s = await st(p); ok(s.active === 'gunnar', 'Digit2 ' + s.active);
    await p.keyboard.down('KeyL'); await wait(60);
    const hook = await p.evaluate(() => window.SAGA2.input.hook); await p.keyboard.up('KeyL'); await wait(100);
    s = await st(p); ok(hook === true && s.lang === 'ru' && s.glang === 'ru', 'L ' + hook + ' ' + JSON.stringify(s));
    await p.keyboard.press('Tab'); await wait(100); s = await st(p); ok(s.active === 'bjorn', 'Tab ' + s.active);
  });
  await test('P → пауза движка и игры (родная пауза скрыта); P → продолжить', async () => {
    await p.keyboard.press('KeyP'); await wait(250); let s = await st(p);
    ok(s.scene === 'pause' && s.screen === 'pause' && !s.pauseVis, 'пауза ' + JSON.stringify(s));
    await p.keyboard.press('KeyP'); await wait(250); s = await st(p);
    ok(s.scene === 'play' && s.screen === 'play', 'P ' + JSON.stringify(s));
  });
  await test('T / G → тема движка = графика игры (modern = AURORA, retro = 8-BIT); и обратно из игры', async () => {
    await p.keyboard.press('KeyG'); await wait(150); let s = await st(p);
    ok(s.theme === 'retro' && s.mode === 'retro', 'G ' + JSON.stringify(s));
    await p.keyboard.press('KeyT'); await wait(150); s = await st(p);
    ok(s.theme === 'modern' && s.mode === 'aurora', 'T ' + JSON.stringify(s));
    await p.evaluate(() => window.SAGA2.main.toggleGraphics()); await wait(150); s = await st(p);
    ok(s.theme === 'retro' && s.mode === 'retro', 'игра→движок ' + JSON.stringify(s));
    await p.keyboard.press('KeyT'); await wait(150);
  });
  await test('язык: Y в игре → язык движка следует; L в меню движка → язык игры', async () => {
    await p.keyboard.press('KeyY'); await wait(150); let s = await st(p);
    ok(s.glang === 'en' && s.lang === 'en', 'Y ' + JSON.stringify(s));
    await p.keyboard.press('Escape'); await wait(200);
    await p.keyboard.press('KeyL'); await wait(150); s = await st(p);
    ok(s.scene === 'pause' && s.lang === 'ru' && s.glang === 'ru', 'L ' + JSON.stringify(s));
    await p.keyboard.press('Escape'); await wait(200);
  });
  await test('M → звук движка выкл = звук игры выкл, повтор — вкл', async () => {
    await p.keyboard.press('KeyM'); await wait(150); let s = await st(p);
    ok(!s.sound && s.muted, JSON.stringify(s));
    await p.keyboard.press('KeyM'); await wait(150); s = await st(p);
    ok(s.sound && !s.muted, JSON.stringify(s));
  });
  await test('финал (экран ending) → экран win движка, рекорд arcade.best.saga-2', async () => {
    await p.evaluate(() => { window.SAGA2.main.game().runScore = 4321; window.SAGA2.debug.screen('ending', {}); }); await wait(300);
    const s = await st(p);
    ok(s.scene === 'win' && s.best === 4321, JSON.stringify(s));
    ok((await p.evaluate(() => localStorage.getItem('arcade.best.saga-2'))) === '4321', 'не сохранён');
    await p.keyboard.press('Enter'); await wait(300);
    const s2 = await st(p); ok(s2.scene === 'title' && s2.screen === 'title', JSON.stringify(s2));
  });
  await test('«Продолжить» → брифинг саги 3; Esc → меню', async () => {
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await wait(400);
    let s = await st(p); ok(s.scene === 'play' && s.screen === 'brief' && s.level === 2, JSON.stringify(s));
    await p.keyboard.press('Escape'); await wait(250); s = await st(p);
    ok(s.scene === 'title' && s.screen === 'title', JSON.stringify(s));
  });
  await test('«Саги» → родной выбор; карточка саги 2 → брифинг → «В путь» → игра на саге 2', async () => {
    await p.evaluate(() => { window.__arcadeHost.g.scenes.title._menu.sel = 0; }); // курсор меню помнит прошлый пункт
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await wait(400);
    let s = await st(p); ok(s.scene === 'play' && s.screen === 'levels' && s.levelsVis, JSON.stringify(s));
    await p.locator('.screen-root .level-card').nth(1).click(); await wait(400);
    s = await st(p); ok(s.screen === 'brief' && s.level === 1, JSON.stringify(s));
    await p.keyboard.press('Enter'); await wait(400); s = await st(p);
    ok(s.scene === 'play' && s.screen === 'play' && s.level === 1, JSON.stringify(s));
  });
  await test('пауза → «В меню» → игра в титуле; прогресс saga2.progress не изменился', async () => {
    await p.keyboard.press('Escape'); await wait(200);
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await wait(300);
    const s = await st(p); ok(s.scene === 'title' && s.screen === 'title', JSON.stringify(s));
    const pr = JSON.parse(await p.evaluate(() => localStorage.getItem('saga2.progress')));
    ok(pr.unlocked === 3 && pr.levels[1].score === 700 && pr.levels[0].time === 61, JSON.stringify(pr));
  });
  await close();

  // миграция: игрок со старыми ключами (до ребрендинга) — всё переезжает в saga2.*, старые ключи удаляются
  for (const page of ['', 'legacy.html']) {
    await test(`миграция ключей lv2.* → saga2.* (${page || 'index.html'})`, async () => {
      const o = await open(page, (pr) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('lv2.progress', pr); localStorage.setItem('lv2.mode', 'retro'); localStorage.setItem('lv2.lang', 'en'); localStorage.setItem('lv2.muted', '1'); sessionStorage.setItem('seeded', '1'); } } catch {} }, PROGRESS);
      const r = await o.p.evaluate(() => ({ prog: localStorage.getItem('saga2.progress'), mode: localStorage.getItem('saga2.mode'), lang: localStorage.getItem('saga2.lang'), muted: localStorage.getItem('saga2.muted'),
        old: ['lv2.progress', 'lv2.mode', 'lv2.lang', 'lv2.muted'].map((k) => localStorage.getItem(k)) }));
      const label = page ? null : await o.p.evaluate(() => window.__arcadeHost.g.scenes.title._menu.items[1].label());
      await o.close();
      const pr = JSON.parse(r.prog || 'null');
      ok(pr && pr.unlocked === 3 && pr.levels[1].score === 700 && pr.levels[0].time === 61, 'прогресс: ' + r.prog);
      ok(r.mode !== null && r.lang !== null && r.muted !== null, 'настройки не перенесены: ' + JSON.stringify(r));
      ok(r.old.every((v) => v === null), 'старые ключи не удалены: ' + JSON.stringify(r.old));
      if (label !== null) ok(/3/.test(label), 'меню после миграции: ' + label);
    });
  }
  await test('миграция не затирает новые ключи: при наличии saga2.progress старый lv2.progress просто удаляется', async () => {
    const o = await open('', () => { try { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('saga2.progress', '{"unlocked":5,"levels":{}}'); localStorage.setItem('lv2.progress', '{"unlocked":1,"levels":{}}'); sessionStorage.setItem('seeded', '1'); } } catch {} });
    const r = await o.p.evaluate(() => [localStorage.getItem('saga2.progress'), localStorage.getItem('lv2.progress')]); await o.close();
    ok(JSON.parse(r[0]).unlocked === 5 && r[1] === null, JSON.stringify(r));
  });

  await test('?mode=retro&level=2 — отладочный адрес: 8-BIT, сразу сага 2, оболочка следует', async () => {
    const o = await open('?mode=retro&level=2');
    const s = await st(o.p); await o.close();
    ok(s.scene === 'play' && s.screen === 'play' && s.level === 1 && s.theme === 'retro' && s.mode === 'retro', JSON.stringify(s));
  });
  await test('?screen=levels — сразу родной выбор саг', async () => {
    const o = await open('?screen=levels');
    const s = await st(o.p); await o.close();
    ok(s.scene === 'play' && s.screen === 'levels', JSON.stringify(s));
  });
  await test('#gfx=retro и #gfx=modern — разные кадры игры', async () => {
    const shots = [];
    for (const g of ['retro', 'modern']) {
      const o = await open('?level=1#gfx=' + g); await wait(500);
      const s = await st(o.p); ok(s.theme === g && s.mode === (g === 'retro' ? 'retro' : 'aurora'), g + ' ' + JSON.stringify(s));
      shots.push(await o.p.locator('#game').screenshot()); await o.close();
    }
    ok(!shots[0].equals(shots[1]), 'кадры совпали');
  });
  // Облик героев (решение владельца 12.11): свои мастера кузни; пиксельные спрайты общие для двух саг
  await test('спрайты героев саги 1 и саги 2 совпадают: блок HERO-SPRITES дословно и попиксельно', async () => {
    const { readFileSync } = await import('node:fs');
    const blk = (f) => { const m = readFileSync(join(ROOT, f), 'utf8').match(/\/\* ==== HERO-SPRITES:BEGIN ====[\s\S]*?\/\* ==== HERO-SPRITES:END ==== \*\//); return m ? m[0] : null; };
    const A = blk('saga/js/game.js'), B = blk('saga-2/js/vikings-retro.js');
    ok(A && B && A === B, 'блоки HERO-SPRITES в saga/js/game.js и saga-2/js/vikings-retro.js различаются');
    const frames = async (url, side) => {
      const ctx = await browser.newContext(); const p = await ctx.newPage();
      p.on('pageerror', (e) => errors.push('heroes ' + side + ': ' + e.message));
      await p.goto(new URL(url, BASE).href, { waitUntil: 'load' }); await wait(400);
      const r = await p.evaluate((side) => {
        const draw = side === 1
          ? { hero: (g, id, s, an, act) => window.SAGA_RETRO.drawHero(g, id, s, an, 0, act), dead: (g, id, act) => window.SAGA_RETRO.drawHeroDead(g, id, act) }
          : { hero: (g, id, s, an, act) => window.SAGA2VIK.drawChar(g, id, s, an, 0, act), dead: (g, id, act) => window.SAGA2VIK.drawDead(g, id, act) };
        const c = document.createElement('canvas'); c.width = 32; c.height = 40;
        const g = c.getContext('2d', { willReadFrequently: true });
        const out = [];
        const hash = () => { const d = g.getImageData(0, 0, 32, 40).data; let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
        for (const id of ['snorri', 'gunnar', 'bjorn']) {
          for (const act of [true, false]) {
            for (const s of ['idle', 'run', 'jump', 'fall', 'act', 'brace', 'dead']) {
              for (const an of [0, 0.14, 0.27, 0.4, 0.55]) {
                g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 32, 40); g.translate(16, 36);
                if (s === 'dead') draw.dead(g, id, act); else draw.hero(g, id, s, an, act);
                out.push(id + ':' + s + ':' + an + ':' + act + '=' + hash());
              }
            }
          }
        }
        return out;
      }, side);
      await ctx.close(); return r;
    };
    const f1 = await frames('/saga/', 1), f2 = await frames('/saga-2/', 2);
    ok(f1.length === 210 && f1.length === f2.length, 'кадров ' + f1.length + '/' + f2.length);
    const diff = f1.filter((x, i) => x !== f2[i]);
    ok(diff.length === 0, 'различаются кадры: ' + diff.slice(0, 4).join(', '));
    const uniq = new Set(f1.map((x) => x.split('=')[1]));
    ok(uniq.size > 60, 'слишком мало разных кадров: ' + uniq.size);
  });
  await test('прозвища героев — свои (RU/EN)', async () => {
    const { readFileSync } = await import('node:fs');
    const t = readFileSync(join(ROOT, 'saga-2/js/i18n.js'), 'utf8');
    for (const s of ["'viking.snorri.role': 'Таран'", "'viking.gunnar.role': 'Стрелок'", "'viking.bjorn.role': 'Опора'", "'viking.snorri.role': 'Ram'", "'viking.gunnar.role': 'Marksman'", "'viking.bjorn.role': 'Bulwark'"]) ok(t.includes(s), 'нет ' + s);
    ok(!/'viking\.(snorri|gunnar|bjorn)\.role': '(Быстрый|Свирепый|Могучий|Swift|Fierce|Mighty)'/.test(t), 'остались старые прозвища');
  });
  await test('ошибок в браузере нет', async () => { ok(errors.length === 0, errors.join(' | ')); });
} finally {
  await browser.close(); srv.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
