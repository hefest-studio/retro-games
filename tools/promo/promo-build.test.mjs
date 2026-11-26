/* tools/promo/promo-build.test.mjs — тест компоновки скриншотов tools/promo-build.mjs (раскладка альбомных кадров 1280×720).
   Было (до 21.11.2026): кадр 16:9 масштабировался по высоте и рисовался с отступом 70 px — справа/слева оставалась пустая полоса,
   а название и подпись уходили за край (КАМЕРТОН, ГЛУБЬ, ПОДГОРЬЕ, ВОЛОК, ОТГОН, ЛЕДНИК). Стало: 16:9 — на весь кадр, почти 16:9 — по
   центру с размытым фоном, подпись — внутри кадра на подложке; портретные/узкие — как раньше.
   Волна 36: портретные кадры широких игр — вырезка 9:16 на всю картинку (было 30–56 % геймплея, Яндекс 5.1.1.2 требует ≥ 70 %) с вклейкой
   срезанного HUD и подписью на подложке; альбомные кадры узких игр (портрет, квадрат, 4:3) — 'split': кадр вплотную к краю + крупный план
   того же кадра (было 'side' с текстом на фоне, 47–57 %); доля геймплея в report.json и проверка checkReport (--check: ошибка при < 70 %).
   1) чистые функции landscapeLayout / portraitLayout / closeupRect / hudInset / checkReport (без браузера);
   2) компоновщик COMPOSE в Chromium на синтетических кадрах (без игры и сервера).
   Запуск: node tools/promo/promo-build.test.mjs */
import { createRequire } from 'node:module';
import { landscapeLayout, portraitLayout, closeupRect, hudInset, checkReport, LAYOUT_VERSION, COMPOSE } from '../promo-build.mjs';
const require = createRequire(import.meta.url);
let passed = 0, failed = 0; const queue = [];
const test = (n, f) => queue.push([n, f]);
const ok = (c, m) => { if (!c) throw new Error(m || 'ложь'); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); };

test('16:9 (960×540, 640×360, 512×288; снимок ×2) → full: кадр ровно 1280×720 от (0,0), без сдвига и полос', () => {
  for (const [w, h] of [[960, 540], [640, 360], [512, 288], [1920, 1080]]) for (const n of [1, 2, 3, 4]) {
    const L = landscapeLayout(w, h, n); eq(L.mode, 'full', w + '×' + h); eq(L.frame, { x: 0, y: 0, w: 1280, h: 720 }, w + '×' + h + ' n' + n);
  }
  eq(landscapeLayout(960, 540, 1).plateLeft, true); eq(landscapeLayout(960, 540, 2).plateLeft, false);
});
test('чуть шире 16:9 (НАЛЁТ 960×520) → full без обрезки: кадр целиком по ширине, полосы сверху/снизу — размытый кадр', () => {
  const L = landscapeLayout(960, 520, 1); eq(L.mode, 'full'); eq(L.frame.w, 1280); ok(L.frame.x === 0 && L.frame.y > 0 && L.frame.y + L.frame.h <= 720, JSON.stringify(L.frame));
  ok(L.bg && L.bg.y <= 0 && L.bg.y + L.bg.h >= 720, 'фон ' + JSON.stringify(L.bg)); ok(!landscapeLayout(960, 540, 1).bg, 'ровно 16:9 — без фона');
});
test('почти 16:9 (ГЛУБЬ 640×420, ЖЕОДА 640×400) → fit: по высоте по центру, фон — тот же кадр на весь размер', () => {
  for (const [w, h] of [[640, 420], [640, 400]]) {
    const L = landscapeLayout(w, h, 1); eq(L.mode, 'fit'); eq(L.frame.h, 720); ok(Math.abs(L.frame.x * 2 + L.frame.w - 1280) <= 1, 'по центру ' + JSON.stringify(L.frame));
    ok(L.bg.x <= 0 && L.bg.y <= 0 && L.bg.x + L.bg.w >= 1280 && L.bg.y + L.bg.h >= 720, 'фон закрывает весь кадр ' + JSON.stringify(L.bg));
  }
});
test('узкие кадры (4:3, квадрат, портрет) → split: кадр по высоте вплотную к краю, остальное — крупный план, разделитель 4 px', () => {
  for (const [w, h] of [[640, 480], [640, 640], [480, 640], [420, 640], [640, 512]]) for (const n of [1, 2]) {
    const L = landscapeLayout(w, h, n), iw = Math.round(w * 720 / h);
    eq(L.mode, 'split'); eq(L.frame, { x: n % 2 ? 1280 - iw : 0, y: 0, w: iw, h: 720 }, w + '×' + h);
    eq(L.box.w + L.frame.w + L.sep.w, 1280, 'кадр + крупный план + разделитель = вся ширина'); eq(L.box.h, 720);
    ok(n % 2 ? L.box.x === 0 : L.box.x === iw + 4, 'крупный план на свободной стороне ' + JSON.stringify(L.box));
    ok(L.plateArea === L.box ? L.box.w >= 480 : L.plateArea.w === 1280, 'подложка — в крупном плане, если он ≥ 480 px');
  }
});
test('closeupRect: зум ≥ 1,6, источник внутри снимка, пропорции как у окна; у края — прижат, а не выходит', () => {
  const r = closeupRect(840, 1280, 804, 720, [0.5, 0.75], 1.6, 720);
  ok(r.zoom >= 1.6 && r.x >= 0 && r.y >= 0 && r.x + r.w <= 840 && r.y + r.h <= 1280, JSON.stringify(r));
  ok(Math.abs(r.w / r.h - 804 / 720) < 0.01, 'пропорции ' + JSON.stringify(r));
  const e = closeupRect(1280, 1024, 376, 720, [0.99, 0.01], 1.6, 720); eq([e.x + e.w, e.y], [1280, 0], 'у правого верхнего края');
  const z = closeupRect(840, 1280, 804, 720, [0.5, 0.5], 1.0, 720); ok(z.w <= 840 && z.zoom > 1.0, 'зум поднят, если окно шире снимка: ' + JSON.stringify(z));
});
test('portraitLayout: широкие (16:9, 16:10, 4:3, квадрат) → crop 9:16 по всей высоте вокруг фокуса; узкие (≥ 70 % по ширине) → fit', () => {
  for (const [w, h] of [[2880, 1620], [1920, 1080], [2560, 1680], [2560, 2048], [2560, 2560]]) {
    const L = portraitLayout(w, h, [0.3, 0.5]); eq(L.mode, 'crop', w + '×' + h); eq(L.frame, { x: 0, y: 0, w: 720, h: 1280 });
    eq([L.src.y, L.src.h], [0, h], 'по высоте — весь снимок'); ok(Math.abs(L.src.w / L.src.h - 720 / 1280) < 0.002, 'пропорции 9:16');
    ok(Math.abs(L.src.x + L.src.w / 2 - 0.3 * w) <= 1 || L.src.x === 0, 'вокруг фокуса ' + JSON.stringify(L.src));
    ok(L.fitShare < 0.7, 'раньше было < 70 %: ' + L.fitShare);
  }
  eq(portraitLayout(2880, 1620, [0, 0.5]).src.x, 0, 'фокус у края — вырезка прижата к краю'); eq(portraitLayout(2880, 1620, [1, 0.5]).src.x, 2880 - 911);
  for (const [w, h] of [[840, 1280], [960, 1520], [960, 1280], [960, 1600]]) { const L = portraitLayout(w, h); eq(L.mode, 'fit', w + '×' + h); ok(L.fitShare >= 0.7); }
});
test('hudInset: HUD внутри вырезки — без вклейки; срезанный — строки во всю ширину сверху, не крупнее геймплея, полоса закрывает остаток', () => {
  const src = { x: 985, y: 0, w: 911, h: 1620 };
  eq(hudInset(2880, 1620, src, [[0.35, 0, 0.3, 0.06]]), null, 'HUD целиком в вырезке');
  eq(hudInset(2880, 1620, src, null), null);
  const hi = hudInset(2880, 1620, src, [[0, 0, 0.5, 0.085], [0.5, 0, 0.5, 0.085]]);
  ok(hi && hi.rows.length === 2 && !hi.bottom, JSON.stringify(hi));
  hi.rows.forEach((q) => { ok(q.d.x >= 0 && q.d.x + q.d.w <= 720, 'строка в ширину ' + JSON.stringify(q.d)); ok(q.d.w / q.s.w <= 720 / 911 + 1e-9, 'не крупнее геймплея'); });
  ok(hi.rows[1].d.y >= hi.rows[0].d.y + hi.rows[0].d.h, 'строки не налезают');
  ok(hi.strip.h >= Math.round(0.085 * 1620 * 720 / 911) && hi.strip.y === 0, 'полоса закрывает срезанный HUD вырезки ' + JSON.stringify(hi.strip));
  // группы (счёт слева, очки по центру, миссия справа) — несколько в строке, по порядку, без наложений, полоса ≤ 18 % высоты
  const g = hudInset(2880, 1620, src, [[0, 0, 0.24, 0.07], [0.44, 0, 0.12, 0.07], [0.87, 0, 0.13, 0.07]]);
  ok(g.rows.length === 3 && g.strip.h <= 231, JSON.stringify(g.strip)); for (let i = 1; i < 3; i++) { const a = g.rows[i - 1].d, b = g.rows[i].d; ok(b.y >= a.y + a.h || b.x >= a.x + a.w, 'группы не налезают ' + JSON.stringify([a, b])); }
  ok(g.rows[0].s.x === 0 && g.rows[2].s.x === Math.round(0.87 * 2880), 'порядок групп сохранён');
  const lo = hudInset(2880, 1620, src, [[0, 0.92, 1, 0.08]]); ok(lo.bottom && lo.strip.y + lo.strip.h === 1280 && lo.rows[0].d.y >= lo.strip.y, 'HUD внизу — вклейка снизу ' + JSON.stringify(lo));
});
test('checkReport (--check): < 70 % геймплея, нет кадра, старая раскладка, подпись за краем — ошибки; всё в норме — пусто', () => {
  const f = (lang, kind, n, share, extra) => Object.assign({ file: `../arcade-full/promo/x/${lang}/shot-${kind}-${n}.png`, size: kind === 'portrait' ? '720×1280' : '1280×720', share }, extra || {});
  const good = { layoutVersion: LAYOUT_VERSION, files: [] }; for (const l of ['ru', 'en']) for (let n = 1; n <= 2; n++) good.files.push(f(l, 'portrait', n, 0.9), f(l, 'landscape', n, 0.85));
  eq(checkReport(good, ['ru', 'en'], 2), []);
  const bad = JSON.parse(JSON.stringify(good)); bad.files[0].share = 0.32; bad.files[1].plate = { x: 1200, y: 600, w: 300, h: 100 }; bad.files.pop(); delete bad.layoutVersion;
  const e = checkReport(bad, ['ru', 'en'], 2);
  ok(e.some((m) => /ru\/shot-portrait-1\.png: геймплей 32% < 70%/.test(m)), e.join('; ')); ok(e.some((m) => /ru\/shot-landscape-1\.png: подпись/.test(m)), e.join('; '));
  ok(e.some((m) => /en\/shot-landscape-2\.png: нет/.test(m)), e.join('; ')); ok(e.some((m) => /старой раскладкой/.test(m)), e.join('; '));
  eq(checkReport(null, ['ru'], 4).length, 1, 'нет report.json — ошибка');
});

// Синтетический кадр: заливка «геймплея» (зелёный) с белыми полосами 4 px по краям — по ним видно, что края кадра не обрезаны и не сдвинуты.
function frameScript(w, h) {
  return `(function(){ var c=document.createElement('canvas'); c.width=${w}; c.height=${h}; var x=c.getContext('2d'); x.fillStyle='#10a040'; x.fillRect(0,0,${w},${h});
    x.fillStyle='#ffffff'; x.fillRect(0,0,4,${h}); x.fillRect(${w}-4,0,4,${h}); return c.toDataURL('image/png'); })()`;
}
// Синтетический кадр с «HUD»: красная полоса сверху во всю ширину (8 % высоты), ниже — зелёный геймплей.
function hudFrame(w, h) {
  return `(function(){ var c=document.createElement('canvas'); c.width=${w}; c.height=${h}; var x=c.getContext('2d'); x.fillStyle='#10a040'; x.fillRect(0,0,${w},${h});
    x.fillStyle='#e02020'; x.fillRect(0,0,${w},Math.round(${h}*0.08)); return c.toDataURL('image/png'); })()`;
}
const P = { bg: '#101018', panel: '#202030', ink: '#f0f0f0', accent: '#e0a24a', accent2: '#8fdcff' };
const CAPS = { ru: 'Кукла идёт туда, куда тебе нельзя', es: 'La muñeca va adonde tú no puedes ir: sigue el diapasón y cruza la plaza' };

const browserTests = async () => {
  let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent('<!doctype html><html><body style="margin:0;background:#000"><canvas id="o"></canvas></body></html>');
    await page.addScriptTag({ content: COMPOSE });
    const run = (w, h, n, caption) => page.evaluate(async ({ src, P, n, caption }) => {
      const r = await Compose.landscape({ shot: eval(src), P, caption, title: 'КАМЕРТОН', n, pixel: false });
      const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = r.url; });
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const px = (a, b) => Array.from(x.getImageData(a, b, 1, 1).data.slice(0, 3));
      return { w: img.width, h: img.height, mode: r.mode, share: r.share, plate: r.plate, frame: r.frame,
        left: px(1, 200), right: px(1278, 200), mid: px(640, 200), edgeL: px(0, 100), edgeR: px(1279, 100) };
    }, { src: frameScript(w, h), P, n, caption });
    const green = (p) => p[1] > 120 && p[0] < 60 && p[2] < 100, white = (p) => p.every((v) => v > 220);
    for (const n of [1, 2]) for (const cap of Object.values(CAPS)) {
      const r = await run(1920, 1080, n, cap);   // снимок canvas 960×540 ×2
      eq([r.w, r.h, r.mode], [1280, 720, 'full']);
      ok(white(r.edgeL) && white(r.edgeR), '16:9: края кадра на краях картинки (нет сдвига и полосы): ' + JSON.stringify(r));
      ok(green(r.mid), '16:9: середина — геймплей ' + JSON.stringify(r.mid));
      const p = r.plate; ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 1280 && p.y + p.h <= 720, 'подпись внутри кадра: ' + JSON.stringify(p));
      ok(n === 1 ? p.x < 640 : p.x + p.w > 640, 'подложка чередуется слева/справа: ' + JSON.stringify(p));
      ok(r.share > 0.7 && r.share < 1, 'доля геймплея ' + r.share);
    }
    { // «занятый» низ слева (герой, враги — пёстрые клетки) → подложка уходит направо, хотя по очереди была бы слева (n = 1)
      const busySrc = `(function(){ var c=document.createElement('canvas'); c.width=1920; c.height=1080; var x=c.getContext('2d'); x.fillStyle='#10a040'; x.fillRect(0,0,1920,1080);
        for (var i=0;i<40;i++) for (var j=0;j<12;j++) { x.fillStyle=(i+j)%2?'#ffffff':'#000000'; x.fillRect(40+i*18, 820+j*18, 18, 18); } return c.toDataURL('image/png'); })()`;
      const r = await page.evaluate(async ({ src, P }) => { const o = await Compose.landscape({ shot: eval(src), P, caption: 'Кукла идёт', title: 'КАМЕРТОН', n: 1, pixel: false }); return o.plate; }, { src: busySrc, P });
      ok(r.x > 640, 'подложка не закрывает пёстрый угол (ушла направо): ' + JSON.stringify(r)); }
    { const r = await run(1280, 840, 1, CAPS.ru);  // ГЛУБЬ 640×420 ×2
      eq(r.mode, 'fit'); ok(green(r.mid), 'fit: середина — геймплей');
      ok(r.edgeL.some((v) => v > 10), 'fit: бока не пустые (размытый кадр): ' + JSON.stringify(r.edgeL));
      const p = r.plate; ok(p.x >= r.frame.x && p.x + p.w <= r.frame.x + r.frame.w && p.y + p.h <= 720, 'fit: подпись внутри кадра ' + JSON.stringify(r)); ok(r.share > 0.7, 'доля ' + r.share); }
    { const r = await run(960, 1280, 1, CAPS.ru);  // портретная игра 480×640 ×2 — split: кадр справа вплотную, слева — крупный план (тоже геймплей)
      eq(r.mode, 'split'); eq(r.frame, { x: 1280 - 540, y: 0, w: 540, h: 720 }); ok(green(r.left), 'split: слева — крупный план кадра, не фон: ' + JSON.stringify(r.left));
      ok(white(r.edgeR), 'split: правый край кадра на правом краю картинки'); ok(r.share > 0.7, 'доля ' + r.share);
      const p = r.plate; ok(p.x >= 0 && p.x + p.w <= 1280 - 540 - 4 && p.y + p.h <= 720, 'подпись в крупном плане ' + JSON.stringify(p)); }
    // портрет 720×1280 из широкого кадра: вырезка на всю картинку (геймплей ≥ 70 %), вклейка HUD сверху, подпись внутри
    const portrait = (w, h, hud, focus) => page.evaluate(async ({ src, P, hud, focus }) => {
      const r = await Compose.portrait({ shot: eval(src), P, caption: 'Кукла идёт туда, куда тебе нельзя', title: 'КАМЕРТОН', n: 1, pixel: false, hud, focus });
      const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = r.url; });
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const px = (a, b) => Array.from(x.getImageData(a, b, 1, 1).data.slice(0, 3));
      return { w: img.width, h: img.height, mode: r.mode, share: r.share, plate: r.plate, src: r.src, hud: r.hud, mid: px(360, 640), top: px(360, 30) };
    }, { src: hudFrame(w, h), P, hud, focus });
    { const r = await portrait(1920, 1080, null, [0.5, 0.5]);
      eq([r.w, r.h, r.mode], [720, 1280, 'crop']); ok(green(r.mid), 'середина — геймплей ' + JSON.stringify(r.mid)); ok(r.share > 0.85 && r.share < 1, 'доля ' + r.share);
      const p = r.plate; ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 720 && p.y + p.h <= 1280, 'подпись внутри ' + JSON.stringify(p)); eq(r.hud, false); }
    { const r = await portrait(1920, 1080, [[0, 0, 0.5, 0.08], [0.5, 0, 0.5, 0.08]], [0.5, 0.5]);   // HUD по краям срезан вырезкой → вклейка
      eq(r.hud, true); ok(r.top[0] > 200 && r.top[1] < 80, 'сверху — вклеенный HUD (красная полоса синтетического HUD): ' + JSON.stringify(r.top)); ok(r.share > 0.8, 'доля с вклейкой ' + r.share); }
    { const r = await portrait(960, 1280, null, null); eq(r.mode, 'fit'); ok(r.share >= 0.7, 'узкая игра — как раньше ' + r.share); }
  } finally { await browser.close(); }
};

for (const [n, f] of queue) { try { f(); passed++; console.log('ok   ' + n); } catch (e) { failed++; console.log('FAIL ' + n + '\n     ' + e.message); } }
try { await browserTests(); passed++; console.log('ok   компоновщик в Chromium: 16:9 на весь кадр, подпись внутри, fit с фоном, split с крупным планом, портрет-вырезка ≥ 70 % с вклейкой HUD'); }
catch (e) { failed++; console.log('FAIL компоновщик в Chromium\n     ' + e.message); }
console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);
