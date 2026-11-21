/* tools/promo/promo-build.test.mjs — тест компоновки скриншотов tools/promo-build.mjs (раскладка альбомных кадров 1280×720).
   Было (до 21.11.2026): кадр 16:9 масштабировался по высоте и рисовался с отступом 70 px — справа/слева оставалась пустая полоса,
   а название и подпись уходили за край (КАМЕРТОН, ГЛУБЬ, ПОДГОРЬЕ, ВОЛОК, ОТГОН, ЛЕДНИК). Стало: 16:9 — на весь кадр, почти 16:9 — по
   центру с размытым фоном, подпись — внутри кадра на подложке; портретные/узкие — как раньше.
   1) чистая функция landscapeLayout (без браузера); 2) компоновщик COMPOSE в Chromium на синтетических кадрах (без игры и сервера).
   Запуск: node tools/promo/promo-build.test.mjs */
import { createRequire } from 'node:module';
import { landscapeLayout, COMPOSE } from '../promo-build.mjs';
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
test('почти 16:9 (ГЛУБЬ 640×420, ЖЕОДА 640×400) → fit: по высоте по центру, фон — тот же кадр на весь размер', () => {
  for (const [w, h] of [[640, 420], [640, 400]]) {
    const L = landscapeLayout(w, h, 1); eq(L.mode, 'fit'); eq(L.frame.h, 720); ok(Math.abs(L.frame.x * 2 + L.frame.w - 1280) <= 1, 'по центру ' + JSON.stringify(L.frame));
    ok(L.bg.x <= 0 && L.bg.y <= 0 && L.bg.x + L.bg.w >= 1280 && L.bg.y + L.bg.h >= 720, 'фон закрывает весь кадр ' + JSON.stringify(L.bg));
  }
});
test('узкие кадры (4:3, квадрат, портрет) → side: прежняя раскладка (кадр у края с отступом 70, текст на свободной стороне)', () => {
  for (const [w, h] of [[640, 480], [640, 640], [480, 640], [420, 640]]) for (const n of [1, 2]) {
    const L = landscapeLayout(w, h, n), iw = Math.round(w * 720 / h), gx = n % 2 ? 1280 - iw - 70 : 70;
    eq(L.mode, 'side'); eq(L.frame, { x: gx, y: 0, w: iw, h: 720 }); eq(L.side, n % 2 ? [40, gx - 40] : [gx + iw + 40, 1240]);
    ok(L.side[1] - L.side[0] >= 160, 'место под текст ' + JSON.stringify(L.side));
  }
});

// Синтетический кадр: заливка «геймплея» (зелёный) с белыми полосами 4 px по краям — по ним видно, что края кадра не обрезаны и не сдвинуты.
function frameScript(w, h) {
  return `(function(){ var c=document.createElement('canvas'); c.width=${w}; c.height=${h}; var x=c.getContext('2d'); x.fillStyle='#10a040'; x.fillRect(0,0,${w},${h});
    x.fillStyle='#ffffff'; x.fillRect(0,0,4,${h}); x.fillRect(${w}-4,0,4,${h}); return c.toDataURL('image/png'); })()`;
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
    { const r = await run(960, 1280, 1, CAPS.ru);  // портретная игра 480×640 ×2 — прежняя раскладка
      eq(r.mode, 'side'); eq(r.frame, { x: 1280 - 540 - 70, y: 0, w: 540, h: 720 }); ok(!green(r.left), 'side: слева — фон и текст'); }
  } finally { await browser.close(); }
};

for (const [n, f] of queue) { try { f(); passed++; console.log('ok   ' + n); } catch (e) { failed++; console.log('FAIL ' + n + '\n     ' + e.message); } }
try { await browserTests(); passed++; console.log('ok   компоновщик в Chromium: 16:9 на весь кадр, подпись внутри, fit с фоном, портрет без изменений'); }
catch (e) { failed++; console.log('FAIL компоновщик в Chromium\n     ' + e.message); }
console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);
