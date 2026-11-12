/* СЕВЕРНАЯ САГА · tests/engine.test.mjs — автотесты порта на движок v2 («оболочка» js/host.js).
   Запуск: node saga/tests/engine.test.mjs   (нужен Playwright: глобально или npm i -D playwright)
   Поднимает свой статический сервер по корню репо и проверяет в Chromium:
   • 10 земель на месте; legacy.html грузится и работает сама (без оболочки);
   • меню движка (Играть / Продолжить / Уровни / Язык / Тема / Звук) → пролог → брифинг → игра (Enter);
   • родные брифинг/пролог/карта земель — видны, родные титул/пауза/финал — скрыты;
   • пауза P ↔ пауза игры, тема T/G ↔ графика игры (modern ↔ retro), язык L ↔ язык игры (в обе стороны),
     звук M → звук игры; переключение героев 1/2/3 и Tab уходит в игру;
   • финал саги → экран win движка и рекорд arcade.best.saga; «Продолжить» и «Уровни» из меню;
   • прогресс игроков (saga.progress.v1, saga.story.v1) не теряется, старые ключи «lv.*» мигрируют; ?gfx= / ?level= / #gfx= работают;
   • облик героев: блок HERO-SPRITES дословно и попиксельно общий для саг 1 и 2, прозвища — свои;
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
  const h = window.__arcadeHost, U = window.SAGA_UI, G = window.SAGA_GAME.state;
  const vis = (s) => { const el = document.querySelector('.screen[data-screen="' + s + '"]'); return !!el && getComputedStyle(el).display !== 'none'; };
  return { scene: h.g._sceneName, theme: h.g.themeName, lang: h.g.i18n.lang, sound: h.g.audio.enabled, best: h.g.state.best,
    screen: U.getScreen(), gfx: U.prefs.gfx, glang: U.prefs.lang, muted: U.prefs.muted, level: G.levelIndex, active: G.activeId,
    paused: window.SAGA_GAME.isPaused(), titleVis: vis('title'), pauseVis: vis('pause'), introVis: vis('levelIntro'), storyVis: vis('story'), levelsVis: vis('levels') };
});
const PROGRESS = JSON.stringify({ maxLevel: 3, completed: { 0: 1, 1: 1, 2: 1 }, best: { 0: 41, 1: 77, 2: 95 } });

try {
  await test('уровни игры: 10 земель', async () => {
    const { p, close } = await open('');
    const n = await p.evaluate(() => (window.SAGA_LEVELS || []).length);
    await close(); ok(n === 10, 'земель ' + n);
  });
  await test('legacy.html — старая версия грузится и работает сама', async () => {
    const ctx = await browser.newContext(); const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push('legacy: ' + e.message));
    await p.goto(BASE + 'legacy.html', { waitUntil: 'load' }); await wait(500);
    const r = await p.evaluate(() => ({ ui: !!window.SAGA_UI, host: !!window.__arcadeHost, engine: !!window.Arcade }));
    await p.keyboard.press('Enter'); await wait(300);
    const scr = await p.evaluate(() => window.SAGA_UI.getScreen());
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
    const x0 = await p.evaluate(() => window.SAGA_GAME.state.actors.snorri.x);
    await p.keyboard.down('ArrowRight'); await wait(400); await p.keyboard.up('ArrowRight');
    const x1 = await p.evaluate(() => window.SAGA_GAME.state.actors.snorri.x);
    ok(x1 > x0, `x ${x0} → ${x1}`);
    await p.keyboard.press('Digit2'); await wait(100); let s = await st(p); ok(s.active === 'gunnar', 'Digit2 ' + s.active);
    await p.keyboard.press('Tab'); await wait(100); s = await st(p); ok(s.active === 'bjorn', 'Tab ' + s.active);
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
    await p.evaluate(() => window.SAGA_UI.toggleGfx()); await wait(150); s = await st(p);
    ok(s.theme === 'retro' && s.gfx === 'retro', 'игра→движок ' + JSON.stringify(s));
    await p.keyboard.press('KeyT'); await wait(150);
  });
  await test('L → язык движка = язык игры; и обратно', async () => {
    await p.keyboard.press('KeyL'); await wait(150); let s = await st(p);
    ok(s.lang === 'en' && s.glang === 'en', JSON.stringify(s));
    await p.evaluate(() => window.SAGA_UI.toggleLang()); await wait(150); s = await st(p);
    ok(s.lang === 'ru' && s.glang === 'ru', 'игра→движок ' + JSON.stringify(s));
  });
  await test('M → звук движка выкл = звук игры выкл, повтор — вкл', async () => {
    await p.keyboard.press('KeyM'); await wait(150); let s = await st(p);
    ok(!s.sound && s.muted, JSON.stringify(s));
    await p.keyboard.press('KeyM'); await wait(150); s = await st(p);
    ok(s.sound && !s.muted, JSON.stringify(s));
  });
  await test('финал саги → экран win движка, рекорд arcade.best.saga', async () => {
    await p.evaluate(() => { const G = window.SAGA_GAME.state; G.session.score = 4321; window.SAGA_UI.debug.showFinale(); }); await wait(300);
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
  const o2 = await open('', (pr) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('saga.progress.v1', pr); localStorage.setItem('saga.story.v1', '{"seen":true}'); sessionStorage.setItem('seeded', '1'); } } catch {} }, PROGRESS);
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
    const pr = JSON.parse(await q.evaluate(() => localStorage.getItem('saga.progress.v1')));
    ok(pr.maxLevel === 3 && pr.completed[2] === 1 && pr.best[0] === 41, JSON.stringify(pr));
  });
  await o2.close();

  // миграция: игрок со старыми ключами (до ребрендинга) — прогресс переезжает в saga.*, старые ключи удаляются
  for (const page of ['', 'legacy.html']) {
    await test(`миграция ключей lv.* → saga.* (${page || 'index.html'})`, async () => {
      const o = await open(page, (pr) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('lv.progress.v1', pr); localStorage.setItem('lv.story.v1', '{"seen":true}'); localStorage.setItem('lv.prefs.v1', '{"lang":"en","gfx":"retro","muted":false}'); sessionStorage.setItem('seeded', '1'); } } catch {} }, PROGRESS);
      const ls = await o.p.evaluate(() => ({ prog: localStorage.getItem('saga.progress.v1'), story: localStorage.getItem('saga.story.v1'), prefs: localStorage.getItem('saga.prefs.v1'),
        old: ['lv.progress.v1', 'lv.story.v1', 'lv.prefs.v1'].map((k) => localStorage.getItem(k)) }));
      const label = page ? null : await o.p.evaluate(() => window.__arcadeHost.g.scenes.title._menu.items[1].label());
      await o.close();
      const pr = JSON.parse(ls.prog || 'null');
      ok(pr && pr.maxLevel === 3 && pr.best[0] === 41 && pr.best[2] === 95, 'прогресс: ' + ls.prog);
      ok(ls.story === '{"seen":true}', 'пролог: ' + ls.story);
      // на index.html настройки затем синхронизирует оболочка (общие arcade.*), на legacy.html — остаются как были
      ok(ls.prefs && (page ? /"gfx":"retro"/.test(ls.prefs) : true), 'настройки: ' + ls.prefs);
      ok(ls.old.every((v) => v === null), 'старые ключи не удалены: ' + JSON.stringify(ls.old));
      if (label !== null) ok(/· 4$/.test(label), 'меню после миграции: ' + label);
    });
  }
  await test('миграция не затирает новые ключи: при наличии saga.* старый lv.* просто удаляется', async () => {
    const o = await open('', () => { try { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('saga.progress.v1', '{"maxLevel":5,"completed":{},"best":{}}'); localStorage.setItem('lv.progress.v1', '{"maxLevel":1,"completed":{},"best":{}}'); sessionStorage.setItem('seeded', '1'); } } catch {} });
    const r = await o.p.evaluate(() => [localStorage.getItem('saga.progress.v1'), localStorage.getItem('lv.progress.v1')]); await o.close();
    ok(JSON.parse(r[0]).maxLevel === 5 && r[1] === null, JSON.stringify(r));
  });

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
  // Облик героев (решение владельца 12.11): свои мастера кузни; пиксельные спрайты общие для двух саг
  await test('спрайты героев саги 1 и саги 2 совпадают: блок HERO-SPRITES дословно и попиксельно', async () => {
    const { readFileSync } = await import('node:fs');
    const blk = (f) => { const m = readFileSync(join(ROOT, f), 'utf8').match(/\/\* ==== HERO-SPRITES:BEGIN ====[\s\S]*?\/\* ==== HERO-SPRITES:END ==== \*\//); return m ? m[0] : null; };
    const A = blk('saga/js/game.js'), B = blk('saga-2/js/northmen-retro.js');
    ok(A && B && A === B, 'блоки HERO-SPRITES в saga/js/game.js и saga-2/js/northmen-retro.js различаются');
    const frames = async (url, side) => {
      const ctx = await browser.newContext(); const p = await ctx.newPage();
      p.on('pageerror', (e) => errors.push('heroes ' + side + ': ' + e.message));
      await p.goto(new URL(url, BASE).href, { waitUntil: 'load' }); await wait(400);
      const r = await p.evaluate((side) => {
        const draw = side === 1
          ? { hero: (g, id, s, an, act) => window.SAGA_RETRO.drawHero(g, id, s, an, 0, act), dead: (g, id, act) => window.SAGA_RETRO.drawHeroDead(g, id, act) }
          : { hero: (g, id, s, an, act) => window.SAGA2NORTH.drawChar(g, id, s, an, 0, act), dead: (g, id, act) => window.SAGA2NORTH.drawDead(g, id, act) };
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
  await test('прозвища героев — свои (RU/EN), legacy.html синхронна с js/game.js', async () => {
    const { readFileSync } = await import('node:fs');
    const g = readFileSync(join(ROOT, 'saga/js/game.js'), 'utf8');
    for (const s of ['"snorri.role": "Таран"', '"gunnar.role": "Стрелок"', '"bjorn.role": "Опора"', '"snorri.role": "Ram"', '"gunnar.role": "Marksman"', '"bjorn.role": "Bulwark"']) ok(g.includes(s), 'нет ' + s);
    ok(!/"(snorri|gunnar|bjorn)\.role": "(Быстрый|Свирепый|Стойкий|Swift|Fierce|Stout)"/.test(g), 'остались старые прозвища');
    const leg = readFileSync(join(ROOT, 'saga/legacy.html'), 'utf8');
    const body = g.slice(g.indexOf('\n') + 1);
    ok(leg.includes(body.trimEnd()), 'инлайн-скрипт legacy.html расходится с js/game.js');
  });
  await test('ошибок в браузере нет', async () => { ok(errors.length === 0, errors.join(' | ')); });
} finally {
  await browser.close(); srv.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
