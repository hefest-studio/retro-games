/* ЛЕНТОВОД · tests/browser.mjs — Playwright: меню → Enter → мышью бур → лента → плавильня → лента в Мастерскую
   (и вторая цепочка с углём), слиток доходит до склада; ПКМ — снос, колесо — зум, средняя кнопка — камера,
   тач (CDP): тап — постройка, протяжка — лента, два пальца — камера; P / T / L; 0 ошибок pageerror / console.error.
   Запуск: python3 -m http.server 8356 (из корня репо) → node _proto/fabrika/tests/browser.mjs [папка-для-скриншотов]
   С папкой — скриншоты геймплея lentovod… → <папка>/fabrika-modern.png и fabrika-retro.png (кроп по canvas). PORT — порт. */
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const PORT = process.env.PORT || 8356, URL = `http://localhost:${PORT}/_proto/fabrika/`;
const SHOTS = process.argv[2];
let passed = 0, failed = 0;
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
async function step(name, fn) { try { await fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL + '?lang=ru');
  await page.waitForFunction(() => window.LENTOVOD && window.LENTOVOD.g);
  const ev = (fn, a) => page.evaluate(fn, a);
  const tile = (x, y) => ev(([x, y]) => LENTOVOD.debug.tileToClient(x + 0.5, y + 0.5), [x, y]);
  const btn = id => ev(id => LENTOVOD.debug.buttonToClient(id), id);
  const clickBtn = async id => { const p = await btn(id); await page.mouse.click(p.x, p.y); };
  const clickTile = async (x, y, o) => { const p = await tile(x, y); await page.mouse.click(p.x, p.y, o); };
  const dragTiles = async (a, b, button = 'left') => {
    const p = await tile(a[0], a[1]), q = await tile(b[0], b[1]);
    await page.mouse.move(p.x, p.y); await page.mouse.down({ button });
    for (let i = 1; i <= 8; i++) await page.mouse.move(p.x + (q.x - p.x) * i / 8, p.y + (q.y - p.y) * i / 8);
    await page.mouse.up({ button });
  };
  const bAt = (x, y) => ev(([x, y]) => { const b = LENTOVOD.sim.bAt(LENTOVOD.S.W, x, y); return b && { type: b.type, dir: b.dir }; }, [x, y]);

  await step('заставка → Enter → игра', async () => {
    ok(await ev(() => LENTOVOD.g._sceneName) === 'title', 'не заставка');
    await page.keyboard.press('Enter'); await sleep(300);
    ok(await ev(() => LENTOVOD.g._sceneName) === 'play', 'не play');
    await ev(() => { LENTOVOD.debug.setZoom(1); LENTOVOD.debug.centerOn(16, 20); LENTOVOD.S.W.nextWave = 9999; });
  });

  // клетки цепочки: медь сверху, уголь снизу, плавильня между ними, выход — в Мастерскую (6..8, 19..21)
  const plan = await ev(() => {
    const W = LENTOVOD.S.W, ore = (x, y) => W.ore[y * W.w + x];
    let cy = -1; for (let y = 24; y < 32; y++) if (ore(15, y) === 2) { cy = y; break; }
    return { cuOk: ore(14, 12) === 1, cy };
  });
  await step('мышь: бур на медь (кнопка панели, поворот R кнопкой)', async () => {
    ok(plan.cuOk && plan.cy > 0, 'план карты: ' + JSON.stringify(plan));
    await clickBtn('drill'); ok(await ev(() => LENTOVOD.S.tool) === 'drill', 'инструмент не выбран');
    await clickBtn('rotate'); ok(await ev(() => LENTOVOD.S.dir) === 1, 'поворот');
    await clickTile(14, 12);
    const b = await bAt(14, 12); ok(b && b.type === 'drill' && b.dir === 1, 'бур не встал: ' + JSON.stringify(b));
  });
  await step('мышь: лента протяжкой (6 клеток вниз) и плавильня', async () => {
    await clickBtn('belt'); await dragTiles([14, 13], [14, 18]);
    for (let y = 13; y <= 18; y++) { const b = await bAt(14, y); ok(b && b.type === 'belt' && b.dir === 1, 'лента ' + y + ': ' + JSON.stringify(b)); }
    await page.keyboard.press('Digit6'); ok(await ev(() => LENTOVOD.S.tool) === 'smelter');
    const p = await tile(14.5, 19.5); await page.mouse.click(p.x, p.y);
    const b = await bAt(14, 19); ok(b && b.type === 'smelter', 'плавильня: ' + JSON.stringify(b));
  });
  await step('мышь: уголь (бур вверх, Shift+R) → лента → плавильня; выход лентой в Мастерскую', async () => {
    await page.keyboard.press('Digit1'); await page.keyboard.press('Shift+KeyR'); await page.keyboard.press('Shift+KeyR');
    ok(await ev(() => LENTOVOD.S.dir) === 3, 'dir ' + await ev(() => LENTOVOD.S.dir));
    await clickTile(15, plan.cy);
    await page.keyboard.press('Digit2'); await dragTiles([15, plan.cy - 1], [15, 21]);
    ok((await bAt(15, 21)).dir === 3, 'угольная лента');
    await dragTiles([13, 19], [9, 19]);
    ok((await bAt(9, 19)).dir === 2 && (await bAt(13, 19)).dir === 2, 'выходная лента');
  });
  await step('слиток выплавлен и доехал до Мастерской', async () => {
    await page.waitForFunction(() => (LENTOVOD.S.W.got.ingot || 0) >= 1, null, { timeout: 25000 });
    ok(await ev(() => LENTOVOD.S.W.made.ingot) >= 1);
  });
  await step('ПКМ сносит постройку, ПКМ по пустому — отмена инструмента', async () => {
    await page.keyboard.press('KeyE'); await clickTile(20, 15);
    ok((await bAt(20, 15)).type === 'wall', 'частокол не встал');
    await clickTile(20, 15, { button: 'right' }); ok(!(await bAt(20, 15)), 'не снесли');
    await clickTile(21, 14, { button: 'right' }); ok(await ev(() => LENTOVOD.S.tool) === null, 'инструмент не снят');
  });
  await step('колесо — зум, средняя кнопка — камера, Esc с инструментом — отмена (не пауза)', async () => {
    const z0 = await ev(() => LENTOVOD.S.cam.z); const p = await tile(16, 20);
    await page.mouse.move(p.x, p.y); await page.mouse.wheel(0, -400); await sleep(50);
    ok(await ev(() => LENTOVOD.S.cam.z) > z0, 'зум');
    const x0 = await ev(() => LENTOVOD.S.cam.x);
    await page.mouse.down({ button: 'middle' }); await page.mouse.move(p.x - 120, p.y, { steps: 4 }); await page.mouse.up({ button: 'middle' });
    ok(await ev(() => LENTOVOD.S.cam.x) > x0 + 50, 'панорама');
    await page.keyboard.press('Digit2'); await page.keyboard.press('Escape');
    ok(await ev(() => LENTOVOD.S.tool) === null && await ev(() => LENTOVOD.g._sceneName) === 'play', 'Esc');
    await ev(() => { LENTOVOD.debug.setZoom(1); LENTOVOD.debug.centerOn(16, 20); });
  });
  await step('тач (CDP): тап — постройка, протяжка — лента, два пальца — камера', async () => {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    const t = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i })) });
    await page.keyboard.press('KeyE');
    let p = await tile(20, 13); await t('touchStart', [p]); await sleep(30); await t('touchEnd', []); await sleep(50);
    ok((await bAt(20, 13)) && (await bAt(20, 13)).type === 'wall', 'тап не поставил');
    await page.keyboard.press('Digit2');
    p = await tile(19, 12); const q = await tile(23, 12);
    await t('touchStart', [p]); for (let i = 1; i <= 6; i++) { await t('touchMove', [{ x: p.x + (q.x - p.x) * i / 6, y: p.y }]); await sleep(16); } await t('touchEnd', []); await sleep(50);
    for (let x = 19; x <= 23; x++) { const b = await bAt(x, 12); ok(b && b.type === 'belt' && b.dir === 0, 'тач-лента ' + x); }
    await page.keyboard.press('Escape');
    const x0 = await ev(() => LENTOVOD.S.cam.x); p = await tile(20, 22); const p2 = { x: p.x + 80, y: p.y };
    await t('touchStart', [p, p2]); for (let i = 1; i <= 5; i++) { await t('touchMove', [{ x: p.x - i * 25, y: p.y }, { x: p2.x - i * 25, y: p2.y }]); await sleep(16); } await t('touchEnd', []);
    ok(await ev(() => LENTOVOD.S.cam.x) > x0 + 40, 'два пальца не сдвинули камеру');
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  });
  await step('P — пауза и обратно, T — тема, L — язык', async () => {
    await page.keyboard.press('KeyP'); ok(await ev(() => LENTOVOD.g._sceneName) === 'pause');
    await page.keyboard.press('KeyP'); await sleep(50);
    if (await ev(() => LENTOVOD.g._sceneName) !== 'play') { await page.keyboard.press('Enter'); await sleep(50); }
    ok(await ev(() => LENTOVOD.g._sceneName) === 'play', 'не вернулись');
    const th = await ev(() => LENTOVOD.g.themeName); await page.keyboard.press('KeyT'); ok(await ev(() => LENTOVOD.g.themeName) !== th); await page.keyboard.press('KeyT');
    await page.keyboard.press('KeyL'); ok(await ev(() => LENTOVOD.g.i18n.lang) === 'en'); ok((await page.textContent('#backLink')).includes('Catalog'));
    await page.keyboard.press('KeyL'); ok(await ev(() => LENTOVOD.g.i18n.lang) === 'ru');
  });
  await step('ссылка «← Каталог» ведёт в ../../', async () => { ok(await page.getAttribute('#backLink', 'href') === '../../'); });

  if (SHOTS) await step('скриншоты геймплея (демо-мастерская, волна, клёпаные)', async () => {
    await page.goto(URL + '?demo=1&lang=ru'); await page.waitForFunction(() => window.LENTOVOD && window.LENTOVOD.g);
    await ev(() => { localStorage.setItem('arcade.theme', 'modern'); LENTOVOD.g.setTheme('modern'); });
    await page.keyboard.press('Enter'); await sleep(200);
    await ev(() => {
      const L = LENTOVOD, S = L.S, W = S.W, sim = L.sim;
      for (let i = 0; i < 20 * 50; i++) sim.step(W);
      const as = W.blds.find(b => b.type === 'assembly'); for (let i = 0; i < 5; i++) sim.spawnMech(W, as);
      W.nextWave = W.time; W.waves = true; for (let i = 0; i < 20 * 34; i++) sim.step(W);
      W.blds.forEach(b => { if (b.type === 'turret') b.shots = Math.max(b.shots, 12); });
      L.debug.setZoom(1.1); L.debug.centerOn(18, 20); S.tool = 'belt'; S.msgs = [];
    });
    const a = await tile(19, 13), p = await tile(19, 17); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(p.x, p.y, { steps: 5 }); await sleep(300);
    const box = await page.locator('#c').boundingBox();
    for (const th of ['modern', 'retro']) {
      await ev(t => LENTOVOD.g.setTheme(t), th); await sleep(250);
      await page.screenshot({ path: path.join(SHOTS, `fabrika-${th}.png`), clip: box });
    }
    await page.mouse.up(); await ev(() => LENTOVOD.g.setTheme('modern'));
  });
  await step('0 ошибок в консоли и pageerror', async () => { ok(!errors.length, errors.join(' | ')); });
} finally { await browser.close(); }
console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);
