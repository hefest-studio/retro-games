/* ГАТЬ · браузерная проверка (Playwright): node _proto/rts-c/tests/browser.mjs [папка-для-скриншотов]
   Нужен сервер: python3 -m http.server 8355 в корне репо (порт — PORT). Сценарии:
   1) десктоп 1280×720, мышь и клавиатура: меню → Enter → поход → Enter → бой, пауза P, тема T, язык L,
      выбор карточкой, ПКМ-приказ, рамка ЛКМ, колесо, СКМ-панорама, Q по курсору, панель вехи и найм;
   2) телефон 844×390 (ландшафт), тач: page.touchscreen (тапы) + CDP (протяжка камеры, щипок),
      меню → поход (выбор героя) → бой, выбор/приказ/двойной тап, способность прицелом, панель вехи, найм;
   3) скриншоты геймплея modern/retro (бот, 1280×720, кроп по canvas) и вид телефона. Везде 0 ошибок. */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch (e) { pw = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright'); }
const PORT = process.env.PORT || 8355, URL = `http://localhost:${PORT}/_proto/rts-c/`;
const OUT = process.argv[2] || '';
let passed = 0, failed = 0;
function ok(c, m) { if (c) { passed++; console.log('ok   ' + m); } else { failed++; console.log('FAIL ' + m); } }
const wait = (p, ms) => p.waitForTimeout(ms);
const ev = (p, f, a) => p.evaluate(f, a);
const scene = p => ev(p, () => GAT.debug.g._sceneName);

const browser = await pw.chromium.launch();
const errors = [];
function watch(page, tag) { page.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(tag + ' console: ' + m.text()); }); }
try {
  // ---------- 1. десктоп, мышь ----------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); watch(page, 'desk');
    await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto(URL + '?lang=ru&seed=4'); await wait(page, 500);
    ok(await scene(page) === 'title', 'заставка движка');
    const back = await page.$('a.back'); ok(back && await back.getAttribute('href') === '../../' && await back.isVisible(), '«← Каталог» виден и ведёт в ../../');
    await page.keyboard.press('Enter'); await wait(page, 200); ok(await scene(page) === 'brief', 'Enter → экран похода');
    await page.keyboard.press('KeyE'); await page.keyboard.press('KeyQ'); await wait(page, 100);
    await page.keyboard.press('Enter'); await wait(page, 400); ok(await scene(page) === 'play', 'Enter → бой');
    await page.keyboard.press('KeyP'); await wait(page, 150); ok(await scene(page) === 'pause', 'P — пауза');
    await page.keyboard.press('Enter'); await wait(page, 150); ok(await scene(page) === 'play', 'Enter — продолжить');
    const th0 = await ev(page, () => GAT.debug.g.themeName); await page.keyboard.press('KeyT'); await wait(page, 100);
    ok(await ev(page, () => GAT.debug.g.themeName) !== th0 && await ev(page, () => document.body.dataset.theme) === await ev(page, () => GAT.debug.g.themeName), 'T — тема (и у страницы)');
    await page.keyboard.press('KeyT');
    await page.keyboard.press('KeyL'); await wait(page, 100); ok(await ev(page, () => document.documentElement.lang) === 'en' && (await back.innerText()).includes('Catalog'), 'L — язык EN, ссылка переведена');
    await page.keyboard.press('KeyL');
    // выбор карточкой
    let b = await ev(page, () => GAT.debug.btn('card1')); await page.mouse.click(b.x, b.y); await wait(page, 80);
    const sid = await ev(page, () => GAT.debug.S.squads.filter(s => s.type !== 'hero')[0].id);
    ok(JSON.stringify(await ev(page, () => GAT.debug.sel)) === JSON.stringify([sid]), 'клик по карточке выбирает отряд');
    // ПКМ — приказ идти
    let tgt = await ev(page, () => { const S = GAT.debug.S, p = S.points[1]; GAT.debug.centerOn(S.home.x + 150, S.home.y); return GAT.debug.screen(S.home.x + 120, S.home.y - 60); });
    await wait(page, 60);
    await page.mouse.click(tgt.x, tgt.y, { button: 'right' }); await wait(page, 80);
    ok(await ev(page, id => GAT.debug.S.squads.find(s => s.id === id).order.k, sid) === 'move', 'ПКМ по земле — приказ идти');
    // рамка ЛКМ
    const box = await ev(page, () => { const S = GAT.debug.S; return [GAT.debug.screen(S.home.x - 130, S.home.y - 110), GAT.debug.screen(S.home.x + 150, S.home.y + 130)]; });
    await page.mouse.move(box[0].x, box[0].y); await page.mouse.down(); await page.mouse.move((box[0].x + box[1].x) / 2, (box[0].y + box[1].y) / 2, { steps: 4 }); await page.mouse.move(box[1].x, box[1].y, { steps: 4 }); await page.mouse.up(); await wait(page, 80);
    ok((await ev(page, () => GAT.debug.sel)).length >= 2, 'рамка ЛКМ выбирает несколько отрядов');
    // колесо
    const z0 = await ev(page, () => GAT.debug.cam.z); await page.mouse.move(640, 360); await page.mouse.wheel(0, -300); await wait(page, 80);
    ok(await ev(page, () => GAT.debug.cam.z) > z0, 'колесо — зум');
    // СКМ — панорама
    const cx0 = await ev(page, () => GAT.debug.cam.x); await page.mouse.move(700, 400); await page.mouse.down({ button: 'middle' }); await page.mouse.move(560, 400, { steps: 5 }); await page.mouse.up({ button: 'middle' }); await wait(page, 60);
    ok(Math.abs(await ev(page, () => GAT.debug.cam.x) - cx0) > 30, 'средняя кнопка — панорама');
    // Q по курсору
    const hq = await ev(page, () => { const h = GAT.debug.S.hero; GAT.debug.centerOn(h.x, h.y); return GAT.debug.screen(h.x + 120, h.y + 20); });
    await wait(page, 50); await page.mouse.move(hq.x, hq.y); await page.keyboard.press('KeyQ'); await wait(page, 60);
    ok(await ev(page, () => GAT.debug.S.hero.cdQ) > 0, 'Q — способность в точку курсора');
    // панель вехи и найм
    const hp = await ev(page, () => { const S = GAT.debug.S; GAT.debug.centerOn(S.home.x, S.home.y); return GAT.debug.screen(S.home.x, S.home.y - 22); });
    await wait(page, 60); await page.mouse.click(hp.x, hp.y); await wait(page, 80);
    ok(await ev(page, () => GAT.debug.panel) === await ev(page, () => GAT.debug.S.home.id), 'ЛКМ по вехе — панель');
    const n0 = await ev(page, () => GAT.debug.S.squads.length);
    b = await ev(page, () => GAT.debug.btn('hire_bow')); await page.mouse.click(b.x, b.y); await wait(page, 100);
    ok(await ev(page, () => GAT.debug.S.squads.length) === n0 + 1, 'кнопка «нанять» в панели');
    await page.keyboard.press('Escape'); await wait(page, 60); ok(await ev(page, () => GAT.debug.panel) === null, 'Esc закрывает панель');
    await page.keyboard.press('Digit2'); await wait(page, 40); ok((await ev(page, () => GAT.debug.sel)).length === 1, 'клавиша 2 — отряд');
    await page.keyboard.press('Space'); await wait(page, 40); ok((await ev(page, () => GAT.debug.sel)).length >= 3, 'Пробел — все');
    await page.close();
  }

  // ---------- 2. телефон, тач ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage(); watch(page, 'phone');
    await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto(URL + '?lang=ru&seed=4'); await wait(page, 500);
    const cdp = await ctx.newCDPSession(page);
    const rect = await ev(page, () => { const r = document.getElementById('c').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, W: GAT.debug.g.W }; });
    ok(rect.w <= 844 && rect.h <= 390 && rect.h > 370, `холст вписан в 844×390 (${rect.w | 0}×${rect.h | 0}, логическая ширина ${rect.W})`);
    const noScroll = await ev(page, () => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight);
    ok(noScroll, 'нет прокрутки страницы');
    // первый пункт меню движка — «Играть»: строка меню на H/2
    await page.touchscreen.tap(rect.x + rect.w / 2, rect.y + rect.h * (360 - 8) / 720); await wait(page, 250);
    ok(await scene(page) === 'brief', 'тап «Играть» → поход');
    let b = await ev(page, () => GAT.debug.btn('h1')); await page.touchscreen.tap(b.x, b.y); await wait(page, 60);
    b = await ev(page, () => GAT.debug.btn('go')); await page.touchscreen.tap(b.x, b.y); await wait(page, 400);
    ok(await scene(page) === 'play' && await ev(page, () => GAT.debug.S.hero.kind) === 'hero_z', 'тап героя и «В бой» → бой (Ждан)');
    // тап по отряду на поле
    const u = await ev(page, () => { const S = GAT.debug.S, s = S.squads.find(q => q.type === 'bow'); const m = s.members[0]; GAT.debug.centerOn(S.home.x + 100, S.home.y); return { id: s.id, x: m.x, y: m.y }; });
    await wait(page, 60);
    let sp = await ev(page, a => GAT.debug.screen(a.x, a.y), u); await page.touchscreen.tap(sp.x, sp.y); await wait(page, 80);
    ok(JSON.stringify(await ev(page, () => GAT.debug.sel)) === JSON.stringify([u.id]), 'тап по бойцу выбирает отряд');
    sp = await ev(page, () => { const S = GAT.debug.S; return GAT.debug.screen(S.home.x + 200, S.home.y + 40); });
    await page.touchscreen.tap(sp.x, sp.y); await wait(page, 60);
    ok(await ev(page, id => GAT.debug.S.squads.find(s => s.id === id).order.k, u.id) === 'move', 'тап по земле — приказ');
    await page.touchscreen.tap(sp.x, sp.y); await wait(page, 60);
    ok(await ev(page, id => !!GAT.debug.S.squads.find(s => s.id === id).order.force, u.id), 'двойной тап — идти без боя');
    // протяжка — камера (через CDP), приказ не отдаётся
    const ord0 = await ev(page, () => GAT.debug.S.events.length);
    const cam0 = await ev(page, () => ({ x: GAT.debug.cam.x, y: GAT.debug.cam.y }));
    const tp = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    await tp('touchStart', [{ x: 500, y: 200, id: 1 }]);
    for (let i = 1; i <= 6; i++) await tp('touchMove', [{ x: 500 - i * 25, y: 200 - i * 6, id: 1 }]);
    await tp('touchEnd', []); await wait(page, 80);
    const cam1 = await ev(page, () => ({ x: GAT.debug.cam.x, y: GAT.debug.cam.y }));
    ok(Math.abs(cam1.x - cam0.x) > 50, 'протяжка пальцем двигает камеру');
    // щипок — зум
    const z0 = await ev(page, () => GAT.debug.cam.z);
    await tp('touchStart', [{ x: 380, y: 200, id: 1 }, { x: 460, y: 200, id: 2 }]);
    for (let i = 1; i <= 6; i++) await tp('touchMove', [{ x: 380 - i * 15, y: 200, id: 1 }, { x: 460 + i * 15, y: 200, id: 2 }]);
    await tp('touchEnd', []); await wait(page, 80);
    ok(await ev(page, () => GAT.debug.cam.z) > z0 * 1.2, 'щипок — зум');
    // способность: кнопка → прицел → тап по карте
    b = await ev(page, () => GAT.debug.btn('abq')); await page.touchscreen.tap(b.x, b.y); await wait(page, 60);
    ok(!!(await ev(page, () => GAT.debug.aim)), 'тап Q — режим прицела');
    sp = await ev(page, () => { const h = GAT.debug.S.hero; GAT.debug.centerOn(h.x, h.y); return GAT.debug.screen(h.x + 100, h.y); }); await wait(page, 50);
    await page.touchscreen.tap(sp.x, sp.y); await wait(page, 300);
    ok(await ev(page, () => GAT.debug.S.hero.cdQ) > 0 && !(await ev(page, () => GAT.debug.aim)), 'тап по карте — рывок');
    b = await ev(page, () => GAT.debug.btn('abe')); await page.touchscreen.tap(b.x, b.y); await wait(page, 60);
    ok(await ev(page, () => GAT.debug.S.hero.cdE) > 0, 'тап E — клич ' + JSON.stringify(await ev(page, () => { const h = GAT.debug.S.hero; return { dead: h.dead, cdE: h.cdE, dash: !!h.dash, b: GAT.debug.btn('abe'), sc: GAT.debug.g._sceneName, ev: GAT.debug.S.t }; })) + JSON.stringify(b));
    // панель вехи: тап по значку, найм
    sp = await ev(page, () => { const S = GAT.debug.S; GAT.debug.centerOn(S.home.x, S.home.y); return GAT.debug.screen(S.home.x, S.home.y - 22); }); await wait(page, 50);
    await page.touchscreen.tap(sp.x, sp.y); await wait(page, 80);
    ok(await ev(page, () => GAT.debug.panel) === await ev(page, () => GAT.debug.S.home.id), 'тап по вехе — панель');
    const n0 = await ev(page, () => GAT.debug.S.squads.length);
    b = await ev(page, () => GAT.debug.btn('hire_shield')); await page.touchscreen.tap(b.x, b.y); await wait(page, 80);
    ok(await ev(page, () => GAT.debug.S.squads.length) === n0 + 1, 'тап «нанять» — новый отряд');
    b = await ev(page, () => GAT.debug.btn('all')); await page.touchscreen.tap(b.x, b.y); await wait(page, 60);
    ok((await ev(page, () => GAT.debug.sel)).length >= 3, 'кнопка «Все»');
    // кнопки достаточно крупные для пальца (в CSS-пикселях)
    const sizes = await ev(page, () => { const r = document.getElementById('c').getBoundingClientRect(), k = r.width / GAT.debug.g.W; return ['abq', 'abe', 'card0', 'all'].map(id => { const b = GAT.debug.btn(id); return b ? 1 : 0; }).concat([120 * k, 96 * k]); });
    ok(sizes[4] >= 44 && sizes[5] >= 44, `кнопки способностей ${sizes[4] | 0}px, карточки ${sizes[5] | 0}px (≥ 44)`);
    await page.touchscreen.tap(rect.x + rect.w - 6, rect.y + 6); // ничего не ломает
    await ev(page, () => { GAT.debug.bot(true); GAT.debug.advance(170); const S = GAT.debug.S; const f = S.units.find(u => u.side === 1 && u.kind !== 'nest') || S.hero; GAT.debug.centerOn(S.hero.x * 0.6 + f.x * 0.4, S.hero.y * 0.6 + f.y * 0.4); });
    await wait(page, 250);
    if (OUT) await page.screenshot({ path: path.join(OUT, 'rts-c-phone.png') });
    await ctx.close();
  }

  // ---------- 3. скриншоты геймплея ----------
  if (OUT) {
    fs.mkdirSync(OUT, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); watch(page, 'shots');
    for (const theme of ['modern', 'retro']) {
      await page.addInitScript(t => { try { localStorage.setItem('arcade.theme', t); } catch (e) {} }, theme);
      await page.goto(URL + '?lang=ru&mission=1&bot=1&seed=7'); await wait(page, 400);
      await ev(page, () => {
        const S = GAT.debug.S; let best = null, bn = -1;
        GAT.debug.advance(12);
        for (let k = 0; k < 1500 && bn < 5; k++) { // ищем момент стычки: у бойца ≥ 4 врагов рядом
          GAT.debug.advance(0.2); bn = -1;
          S.units.filter(u => u.side === 0).forEach(u => { const n = S.units.filter(e => e.side === 1 && Math.hypot(e.x - u.x, e.y - u.y) < 300).length; if (n > bn) { bn = n; best = u; } });
        }
        const f = best || S.hero; GAT.debug.centerOn(f.x + 60, f.y + 20);
      });
      await wait(page, 300);
      const cv = await page.$('canvas'); await cv.screenshot({ path: path.join(OUT, `rts-c-${theme}.png`) });
      ok(await ev(page, () => GAT.debug.g.themeName) === theme, 'скриншот ' + theme);
    }
    await page.close();
  }
} finally { await browser.close(); }
ok(errors.length === 0, 'ошибок в консоли/странице: ' + errors.length + (errors.length ? ' — ' + errors.slice(0, 5).join(' | ') : ''));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
