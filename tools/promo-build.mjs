#!/usr/bin/env node
/* tools/promo-build.mjs — промо-материалы игры для каталогов площадок (Яндекс Игры, GamePush) из реального геймплея.
   Запуск:  node tools/promo-build.mjs <slug> [--langs ru,en] [--no-video] [--port 8401] [--out promo/<slug>]
            <slug> — игра в корне репо (kaskad) или прототип вне каталога: _proto/<имя> (промо — promo/<имя>/, игра — /_proto/<имя>/)
            node tools/promo-build.mjs <slug> --check   — проверка без браузера и без записи: тексты promo.json (длины, дубли, запрещённые слова) и
                                                          собранные кадры по report.json (есть все, размеры, геймплей ≥ 70 % кадра, подпись в кадре)
            node tools/promo-build.mjs <slug> --listings — только <lang>/listing.md из promo.json (после правки текстов; кадры не трогает)
   Запрещённые слова (tools/lib/banned-words.mjs): в названиях — «demo/демо», «trial», «бета», «free/бесплатно», «best/лучший», «top/топ»
            (Яндекс 1.15, 8.2.2) → ошибка; в описаниях и подписях — слова 1.15 → ошибка, 8.2.2 → предупреждение.
   Нужно:   promo/<slug>/promo.json — названия по языкам, тексты, теги, категории, подписи к скриншотам, палитра;
            promo/<slug>/shots.mjs   — сценарии скриншотов (как довести игру до нужного кадра), см. promo/kaskad/shots.mjs;
            promo/<slug>/art.js      — (необяз.) рисунок иконки и обложки: window.PromoArt = { icon(ctx,S,P), cover(ctx,W,H,P,o) };
                                       без него — общий рисунок по палитре (tools/promo/art-default.js).
   Итог (в promo/<slug>/):
     icon-512.png (Яндекс), icon-1024.png (GamePush) — без текста и без скриншотов (Яндекс 5.6, GamePush: «иконка без текста»);
     <lang>/cover-800x470.png (Яндекс), <lang>/cover-1920x1080.png (GamePush) — рисунок + название на языке (5.1.3), без UI;
     <lang>/shot-portrait-N.png (720×1280) и <lang>/shot-landscape-N.png (1280×720), N = 1…4 — реальный геймплей,
       снятый Playwright-ом с canvas игры (без интерфейса браузера и страницы; снимок ≥ 1280 px по высоте), с подписью на языке;
       геймплей ≥ 70 % кадра (5.1.1.2; волна 36): портрет широкой игры — вырезка 9:16 вокруг героя на всю картинку с вклейкой HUD
       или (layout.portrait = 'stack') весь кадр + крупный план; альбом узкой игры — кадр + крупный план (см. portraitLayout, landscapeLayout);
       доля геймплея каждого кадра — report.json (files[].share), проверка — checkReport / --check;
     <lang>/video-landscape.mp4 — 16:9, 1280×720, ≤ 28 с, геймплей в режиме 16:9 (Яндекс: «видео геймплея», обязательно);
     <lang>/listing.md — тексты для формы (название, короткое, SEO, «Об игре», «Как играть», GamePush short/full, теги, категории)
       с проверкой длины полей; report.json — размеры файлов, проверки, источники требований.
   Требования (сверено 20.11.2026):
     Яндекс, форма черновика — https://yandex.ru/dev/games/doc/ru/console/add-new-game/draft : иконка 512×512 PNG; обложка 800×470 PNG;
       скриншоты 16:9 / 9:16, длинная сторона 1280–2560, JPEG/PNG-24, ≥ 2 на платформу; название ≤ 50, «Об игре» и «Как играть» 100–1000,
       SEO 50–160, короткое ≤ 70, категорий ≤ 2, тегов ≤ 20; видео 16:9 MP4 ≥ 400 px по высоте, ≤ 28 с, ≤ 100 МБ.
     Яндекс, требования 5.x и 8.3 — https://yandex.ru/dev/games/doc/ru/concepts/requirements : реальный геймплей ≥ 70 % кадра (5.1.1.2),
       одинаковое название внутри языка (5.1.3), иконка/обложка — не скриншоты (5.6), без рамок и скруглений (8.3.3), без системного UI (8.3.4).
     GamePush — https://docs.gamepush.com/docs/distribution/ : иконка 1024×1024 без текста; обложка 1920×1080 с названием, без жанра и UI;
       ≥ 4 скриншота 1280×720 (горизонт.) / 720×1280 (вертик.); без белого фона; название ≤ 48, краткое ≤ 255, полное ≤ 1024, «как играть» ≤ 1024.
   Один браузер за раз, закрывается в конце. Статический сервер — корень репо на --port (по умолчанию 8401). */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scanPromo, HINT as BANNED_HINT } from './lib/banned-words.mjs';
const require = createRequire(import.meta.url);
let chromium = null; // Playwright грузится только для сборки (в режиме --check и в тестах checkTexts не нужен)
function loadChromium() { if (chromium) return chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); } return chromium; }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Промо-материалы весят десятки МБ и нужны только площадкам — живут в приватном репо arcade-full (решение 20.11).
const PROMO_DIR = path.resolve(process.env.PROMO_DIR || path.join(ROOT, '..', 'arcade-full', 'promo'));
const LIMITS = { // [min, max] символов; источник — шапка файла
  yandex: { name: [1, 50], short: [1, 70], seo: [50, 160], about: [100, 1000], howto: [100, 1000] },
  gamepush: { name: [1, 48], gp_short: [1, 255], gp_full: [1, 1024], howto: [1, 1024] }
};
const SIZES = { icon: [512, 1024], coverY: [800, 470], coverGP: [1920, 1080], portrait: [720, 1280], landscape: [1280, 720] };
const len = (s) => [...String(s || '')].length;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function die(m) { console.error('ошибка: ' + m); process.exit(2); }

export function checkTexts(P) {
  const out = [];
  for (const lang of Object.keys(P.texts || {})) {
    const T = Object.assign({ name: P.names && P.names[lang] }, P.texts[lang]);
    for (const [pl, lim] of Object.entries(LIMITS)) for (const [k, [a, b]] of Object.entries(lim)) {
      const n = len(T[k]); if (n < a || n > b) out.push(`${lang}.${k}: ${n} симв. (${pl}: ${a}–${b})`);
    }
    const fields = ['short', 'seo', 'about', 'howto', 'gp_short', 'gp_full'].map((k) => T[k]).filter(Boolean); // 5.11: поля не дублируются
    if (new Set(fields).size !== fields.length) out.push(lang + ': одинаковые тексты в разных полях (Яндекс 5.11)');
    if (/(.)\1{4,}/.test(fields.join(' '))) out.push(lang + ': повтор символов (Яндекс 5.11)');
    if ((P.tags && P.tags[lang] || []).length > 20) out.push(lang + ': тегов > 20');
  }
  const cats = P.categories && P.categories.yandex; if (cats) for (const l of Object.keys(cats)) if (cats[l].length > 2) out.push('категорий Яндекса > 2');
  const bw = scanPromo(P); // запрещённые слова (Яндекс 1.15, 8.2.2): ошибки — в список проблем, предупреждения — checkWords()
  if (bw.errors.length) { out.push('запрещённые слова — ' + BANNED_HINT); bw.errors.forEach((e) => out.push('  слово: ' + e)); }
  return out;
}
export function checkWords(P) { return scanPromo(P); }

// Проверка собранных кадров по report.json (волна 36; её же делает --check): на каждый язык и кадр — оба скриншота есть, размеры по форме,
// геймплей ≥ 70 % кадра (Яндекс 5.1.1.2), подложка с подписью не выходит за картинку, кадры собраны текущей раскладкой (LAYOUT_VERSION).
// Доля геймплея (share) — пиксели снимка игры (вырезка, кадр, крупный план того же кадра, вклейка HUD) / вся картинка; подложка с
// подписью, тёмная полоса под HUD и разделители — не геймплей.
export const LAYOUT_VERSION = 36;
export function shotsCount(mod) { const a = mod && (mod.default || mod.shots); return Array.isArray(a) ? a.length : 0; }
export function checkReport(R, langs, nShots) {
  const out = []; if (!R) return ['нет report.json — кадры не собраны (node tools/promo-build.mjs <slug>)'];
  if ((R.layoutVersion || 0) < LAYOUT_VERSION) out.push(`кадры собраны старой раскладкой (layoutVersion ${R.layoutVersion || '—'} < ${LAYOUT_VERSION}) — пересобрать`);
  const files = R.files || [], size = { portrait: '720×1280', landscape: '1280×720' }, dim = { portrait: [720, 1280], landscape: [1280, 720] };
  for (const lang of langs) for (let n = 1; n <= nShots; n++) for (const kind of ['portrait', 'landscape']) {
    const name = `${lang}/shot-${kind}-${n}.png`, f = files.find((q) => String(q.file).replace(/\\/g, '/').endsWith('/' + name));
    if (!f) { out.push(name + ': нет в report.json'); continue; }
    if (f.size && f.size !== size[kind]) out.push(`${name}: размер ${f.size}, нужен ${size[kind]}`);
    if (typeof f.share !== 'number') out.push(name + ': нет доли геймплея (share)');
    else if (f.share < 0.7) out.push(`${name}: геймплей ${Math.round(f.share * 100)}% < 70% кадра (Яндекс 5.1.1.2)`);
    const p = f.plate, [W, H] = dim[kind];
    if (p && (p.x < 0 || p.y < 0 || p.x + p.w > W + 0.5 || p.y + p.h > H + 0.5)) out.push(name + ': подпись выходит за картинку');
  }
  return out;
}

function listingMd(P, lang) {
  const T = P.texts[lang], n = P.names[lang], d = (P.display && P.display[lang]) || n, other = lang === 'ru' ? 'en' : 'ru';
  const f = (k, lim) => `**${k}** (${len(T[k])} симв.${lim ? ', ' + lim : ''}):\n\n${T[k]}\n`;
  return `# ${d} — тексты для каталогов (${lang.toUpperCase()})\n\n` +
    `Название внутри языка везде одно (Яндекс 5.1.3): в игре — «${d}», в форме — «${n}», на обложках — «${d}» (регистр может отличаться — допустимо по 5.1.3).\n` +
    `Название на ${other.toUpperCase()}: «${P.names[other]}». Сгенерировано tools/promo-build.mjs из promo/${P.slug}/promo.json — правьте JSON, не этот файл.\n\n` +
    `## Яндекс Игры (форма черновика)\n\n**Название** (${len(n)} симв., ≤ 50): ${n}\n\n` + f('short', '≤ 70 — «Короткое описание»') + '\n' + f('seo', '50–160 — «Описание для SEO»') + '\n' +
    f('about', '100–1000 — «Об игре»') + '\n' + f('howto', '100–1000 — «Как играть»') + '\n' +
    `**Категории** (≤ 2, выбрать в форме ближайшие): ${(P.categories.yandex[lang] || []).join(', ')}\n\n**Теги** (${(P.tags[lang] || []).length}, ≤ 20): ${(P.tags[lang] || []).join(', ')}\n\n` +
    `**Ориентация:** ${P.orientation === 'portrait' ? 'портретная (на десктопе — по центру, поля по бокам)' : 'альбомная'}\n\n` +
    `## GamePush (проект игры → тексты на языке)\n\n**Название** (${len(n)} симв., ≤ 48): ${n}\n\n` + f('gp_short', '≤ 255 — «Краткое описание»') + '\n' + f('gp_full', '≤ 1024 — «Полное описание»') + '\n' +
    `**Как играть** (≤ 1024): то же, что «Как играть» для Яндекса выше.\n\n**Категории/жанры:** ${(P.categories.gamepush || []).join(', ')}\n\n` +
    `## Файлы\n\n- icon-512.png (Яндекс), icon-1024.png (GamePush) — в папке promo/${P.slug}/, общие для языков (без текста)\n- cover-800x470.png (Яндекс), cover-1920x1080.png (GamePush) — с названием «${d}»\n- shot-portrait-1…4.png (720×1280), shot-landscape-1…4.png (1280×720)\n- video-landscape.mp4 (Яндекс: «Видео геймплея», горизонтальное)\n`;
}

// ---------- статический сервер (корень репо) + страница компоновки ----------
function startServer(port) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp' };
  const srv = http.createServer((q, s) => {
    let u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/__compose') { s.writeHead(200, { 'content-type': types['.html'] }); s.end('<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000}</style></head><body><canvas id="o"></canvas></body></html>'); return; }
    let f = path.join(ROOT, u); if (!f.startsWith(ROOT)) { s.writeHead(403); s.end(); return; }
    if (u.endsWith('/')) f = path.join(f, 'index.html');
    fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); });
  });
  return new Promise((res, rej) => { srv.on('error', rej); srv.listen(port, '127.0.0.1', () => res(srv)); });
}

// ---------- снимок canvas игры в двойном разрешении (резкий текст и линии, без интерфейса страницы) ----------
// k = 0 — авто (волна 36): снимок не ниже 1280 px по высоте (портретная вырезка 9:16 берёт снимок по всей высоте → 1280 px без растяжения)
const HIRES = (k) => {
  const g = window.Arcade && window.Arcade.last; if (!g) return false; const c = g.canvas, ctx = g.ctx;
  if (!k) k = Math.max(2, Math.ceil(1280 / g.H));
  if (c.__promoK) return true; c.__promoK = k;
  const st = ctx.setTransform.bind(ctx), smooth = ctx.imageSmoothingEnabled;
  c.width = g.W * k; c.height = g.H * k;
  ctx.setTransform = function (a, b, cc, d, e, f) { if (a && typeof a === 'object') { const m = a; return st(m.a * k, m.b * k, m.c * k, m.d * k, m.e * k, m.f * k); } return st(a * k, b * k, cc * k, d * k, e * k, f * k); };
  ctx.resetTransform = function () { st(k, 0, 0, k, 0, 0); };
  st(k, 0, 0, k, 0, 0); ctx.imageSmoothingEnabled = smooth; g._applyPixel = function () { ctx.imageSmoothingEnabled = !g.th().pixel; };
  return true;
};
// Карта движения для автофокуса: два снимка canvas в малом разрешении с паузой ms — разница яркости (герой, враги, снаряды двигаются,
// фон — нет). Если сцена заморожена сценарием, движения нет — автофокус берёт края (autoFocus в COMPOSE).
const MOTION = async (ms) => {
  const c = window.Arcade.last.canvas, w = 160, h = Math.max(2, Math.round(c.height * w / c.width)), o = document.createElement('canvas'); o.width = w; o.height = h;
  const x = o.getContext('2d', { willReadFrequently: true }), lum = () => { x.clearRect(0, 0, w, h); x.drawImage(c, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data, L = new Float32Array(w * h); for (let i = 0; i < w * h; i++) L[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11; return L; };
  const A = lum(); await new Promise((r) => setTimeout(r, ms)); const B = lum(), m = new Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = Math.round(Math.abs(A[i] - B[i]));
  return { w, h, m };
};
async function grabCanvas(page) {
  return page.evaluate(() => { const g = Arcade.last; return { url: g.canvas.toDataURL('image/png'), w: g.canvas.width, h: g.canvas.height, W: g.W, H: g.H, theme: g.themeName }; });
}

// Раскладка альбомного скриншота 1280×720 по размеру снимка canvas (w0×h0); n — номер кадра (1…4). Чистая функция: её исходник
// подставляется в компоновщик (браузер) и проверяется тестом tools/promo/promo-build.test.mjs.
//  r ≥ 1,7 (16:9 ± 5 %) → 'full': кадр на весь размер (cover, по центру), без полос; подпись — внутри кадра на подложке;
//  1,45 ≤ r < 1,7 (16:10, 3:2) → 'fit': кадр по высоте по центру, бока — размытый фон из того же кадра; подпись — внутри кадра;
//  r < 1,45 (4:3, квадрат, портрет) → 'split' (волна 36; было 'side' — кадр с отступом 70 и текст на фоне, геймплей 47–57 %): кадр по
//    высоте вплотную к краю, остальное — крупный план того же кадра (box, зум ≥ 1,6 вокруг героя/действия; close-up считает closeupRect),
//    между ними — полоса-разделитель 4 px; подпись — на подложке внутри крупного плана (если он ≥ 480 px), иначе — поверх всей картинки.
export function landscapeLayout(w0, h0, n, W, H) {
  W = W || 1280; H = H || 720; var r = w0 / h0, k, fw, fh, margin = 28;
  if (r >= 1.7) { // кадр целиком (contain): у кадров шире/уже 16:9 края с HUD не срезаются (НАЛЁТ 960×520 терял «Мис. 1/6»), полосы — размытый кадр
    k = Math.min(W / w0, H / h0); fw = Math.round(w0 * k); fh = Math.round(h0 * k);
    var L0 = { mode: 'full', frame: { x: Math.round((W - fw) / 2), y: Math.round((H - fh) / 2), w: fw, h: fh }, margin: margin, plateLeft: n % 2 === 1 };
    if (fw < W - 1 || fh < H - 1) { var kc = Math.max(W / w0, H / h0), cw0 = Math.round(w0 * kc), ch0 = Math.round(h0 * kc); L0.bg = { x: Math.round((W - cw0) / 2), y: Math.round((H - ch0) / 2), w: cw0, h: ch0 }; }
    return L0; }
  if (r >= 1.45) { k = H / h0; fw = Math.round(w0 * k); fh = H; var kb = Math.max(W / w0, H / h0), bw = Math.round(w0 * kb), bh = Math.round(h0 * kb);
    return { mode: 'fit', frame: { x: Math.round((W - fw) / 2), y: 0, w: fw, h: fh }, bg: { x: Math.round((W - bw) / 2), y: Math.round((H - bh) / 2), w: bw, h: bh }, margin: margin, plateLeft: n % 2 === 1 }; }
  k = H / h0; fw = Math.round(w0 * k); fh = H; var sep = 4, right = n % 2 === 1, gx = right ? W - fw : 0, bxw = W - fw - sep;
  var box = { x: right ? 0 : fw + sep, y: 0, w: bxw, h: H };
  return { mode: 'split', frame: { x: gx, y: 0, w: fw, h: fh }, box: box, sep: { x: right ? bxw : fw, y: 0, w: sep, h: H }, margin: margin, plateLeft: n % 2 === 1,
    plateArea: bxw >= 480 ? box : { x: 0, y: 0, w: W, h: H } };
}

// Крупный план: прямоугольник-источник в снимке w0×h0 с пропорциями box (bw×bh) вокруг точки focus [fx, fy] (доли 0…1) с зумом z
// относительно масштаба основного кадра (H/h0); зум повышается, если иначе источник шире снимка; источник не выходит за снимок.
export function closeupRect(w0, h0, bw, bh, focus, z, H) {
  H = H || bh; var s = H / h0; z = Math.max(z || 1.6, bw / (s * w0), bh / (s * h0)); var rw = bw / (s * z), rh = bh / (s * z);
  var fx = focus ? focus[0] : 0.5, fy = focus ? focus[1] : 0.5;
  var x = Math.min(Math.max(fx * w0 - rw / 2, 0), w0 - rw), y = Math.min(Math.max(fy * h0 - rh / 2, 0), h0 - rh);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(rw), h: Math.round(rh), zoom: z };
}

// Раскладка портретного скриншота 720×1280 по снимку canvas w0×h0 (волна 36).
//  'fit'  — игра сама портретная/узкая (кадр по ширине ≥ 70 % площади): прежняя раскладка — кадр целиком, подпись в полосе над ним;
//  'crop' — широкая игра (16:9, 4:3, квадрат; было 30–56 % геймплея): кадр на ВСЮ картинку — вырезка 9:16 из снимка вокруг героя/центра
//           действия (focus [fx, fy] — доли снимка), по высоте — весь снимок (без обрезки сверху/снизу), подпись — на подложке внутри кадра;
//           HUD, который вырезка срезала по бокам, вклеивается компактными полосами сверху (hudInset).
//  'stack' — (по выбору кадра: shots.mjs → portrait: 'stack'; для меню, карт, гаража, баннеров во всю ширину, которые вырезка режет)
//           сверху — весь кадр по ширине (HUD и надписи целиком), под ним через разделитель 4 px — крупный план того же кадра вокруг
//           фокуса (closeupRect, зум ≥ 1,6) до низа; подпись — на подложке в крупном плане.
export function portraitLayout(w0, h0, focus, W, H, mode) {
  W = W || 720; H = H || 1280;
  var kf = Math.min(W / w0, (H - 150) / h0), fitShare = (w0 * kf) * (h0 * kf) / (W * H);
  if (fitShare >= 0.7) { var iw = Math.round(w0 * kf), ih = Math.round(h0 * kf), top = Math.round((H - ih) * 0.62);
    return { mode: 'fit', frame: { x: Math.round((W - iw) / 2), y: top, w: iw, h: ih }, fitShare: fitShare }; }
  if (mode === 'stack') { var fh = Math.round(h0 * W / w0), sep = 4;
    return { mode: 'stack', frame: { x: 0, y: 0, w: W, h: fh }, sep: { x: 0, y: fh, w: W, h: sep }, box: { x: 0, y: fh + sep, w: W, h: H - fh - sep }, fitShare: fitShare, margin: 24 }; }
  var a = W / H, fx = focus ? focus[0] : 0.5, fy = focus ? focus[1] : 0.5, src;
  if (w0 / h0 > a) { var rw = Math.round(h0 * a); src = { x: Math.round(Math.min(Math.max(fx * w0 - rw / 2, 0), w0 - rw)), y: 0, w: rw, h: h0 }; }
  else { var rh = Math.round(w0 / a); src = { x: 0, y: Math.round(Math.min(Math.max(fy * h0 - rh / 2, 0), h0 - rh)), w: w0, h: rh }; }
  return { mode: 'crop', src: src, frame: { x: 0, y: 0, w: W, h: H }, scale: W / src.w, fitShare: fitShare, margin: 24 };
}

// Вклейка HUD для вырезки 'crop': hud — прямоугольники HUD в долях снимка [[x, y, w, h], …] (из promo/<slug>/shots.mjs → layout.hud;
// лучше — отдельные группы элементов (счёт, жизни, этап), а не полосы во всю ширину: так ни одна надпись не режется пополам).
// Если все они целиком внутри вырезки — вклейка не нужна (null). Иначе группы раскладываются по порядку в 1…n строк (несколько в строке
// через зазор) с общим масштабом: самый крупный, при котором полоса не выше 18 % картинки (и не крупнее геймплея вырезки); строки —
// сверху (или снизу, если HUD внизу снимка), на тёмной полосе, которая закрывает и срезанный остаток HUD в самой вырезке.
// Возвращает { rows: [{ s:{x,y,w,h}, d:{x,y,w,h} }] (по одной записи на группу), strip:{x,y,w,h}, bottom } в px картинки.
export function hudInset(w0, h0, src, hud, W, H) {
  W = W || 720; H = H || 1280; if (!hud || !hud.length) return null;
  var px = hud.map(function (r) { return { x: Math.round(r[0] * w0), y: Math.round(r[1] * h0), w: Math.round(r[2] * w0), h: Math.round(r[3] * h0) }; });
  var inside = px.every(function (r) { return r.x >= src.x - 1 && r.x + r.w <= src.x + src.w + 1 && r.y >= src.y - 1 && r.y + r.h <= src.y + src.h + 1; });
  if (inside) return null;
  var sc = W / src.w, bottom = px.every(function (r) { return r.y + r.h / 2 > h0 / 2; }), pad = 6, gap = 14, maxH = Math.round(H * 0.18), best = null;
  var total = px.reduce(function (a, r) { return a + r.w; }, 0);
  for (var n = 1; n <= px.length; n++) { // n строк: группы по порядку, ширина строки ≈ total / n
    var rows = [[]], acc = 0, target = total / n;
    px.forEach(function (r, i) { if (rows[rows.length - 1].length && acc + r.w / 2 > target * rows.length && rows.length < n) rows.push([]); rows[rows.length - 1].push(r); acc += r.w; });
    var k = sc; rows.forEach(function (row) { var sw = row.reduce(function (a, r) { return a + r.w; }, 0); k = Math.min(k, (W - 2 * pad - gap * (row.length - 1)) / sw); });
    var hh = pad; rows.forEach(function (row) { hh += Math.round(Math.max.apply(null, row.map(function (r) { return r.h; })) * k) + pad; });
    var c = { rows: rows, k: k, h: hh }; if (!best || (c.h <= maxH && (best.h > maxH || c.k > best.k)) || (c.h > maxH && best.h > maxH && c.h < best.h)) best = c;
  }
  var out = [], y = pad;
  best.rows.forEach(function (row) { var rw = row.reduce(function (a, r) { return a + Math.round(r.w * best.k); }, 0) + gap * (row.length - 1), x = Math.round((W - rw) / 2), rh = 0;
    row.forEach(function (r) { var dw = Math.round(r.w * best.k), dh = Math.round(r.h * best.k); out.push({ s: r, d: { x: x, y: y, w: dw, h: dh } }); x += dw + gap; rh = Math.max(rh, dh); });
    y += rh + pad; });
  var cut = 0; px.forEach(function (r) { cut = Math.max(cut, bottom ? (src.y + src.h - r.y) * sc : (r.y + r.h - src.y) * sc); });
  var sh = Math.round(Math.max(y, cut)); if (bottom) out.forEach(function (q) { q.d.y = H - sh + q.d.y; });
  return { rows: out, strip: { x: 0, y: bottom ? H - sh : 0, w: W, h: sh }, bottom: bottom };
}
const LAYOUT_SRC = landscapeLayout.toString() + '\n' + closeupRect.toString() + '\n' + portraitLayout.toString() + '\n' + hudInset.toString();

// ---------- компоновка в браузере (canvas): скриншоты с подписью, иконки, обложки ----------
export const COMPOSE = String.raw`
window.Compose = (function(){
  function load(src){ return new Promise(function(r,j){ var i=new Image(); i.onload=function(){r(i)}; i.onerror=j; i.src=src; }); }
  function rgba(hex,a){ var n=parseInt(String(hex).replace('#',''),16); return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')'; }
  function canvas(w,h){ var c=document.getElementById('o'); c.width=w; c.height=h; var x=c.getContext('2d'); x.setTransform(1,0,0,1,0,0); x.clearRect(0,0,w,h); return [c,x]; }
  function bg(x,w,h,P,seed){ // фон в тон игры: градиент + узор из мотива игры (не однотонная заливка)
    var g=x.createLinearGradient(0,0,w,h); g.addColorStop(0,P.panel||P.bg); g.addColorStop(1,P.bg); x.fillStyle=g; x.fillRect(0,0,w,h);
    if (window.PromoArt && PromoArt.pattern) { x.save(); x.globalAlpha=0.16; PromoArt.pattern(x,w,h,P,seed||1); x.restore(); }
    var v=x.createRadialGradient(w/2,h/2,Math.min(w,h)*0.2,w/2,h/2,Math.max(w,h)*0.7); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.45)'); x.fillStyle=v; x.fillRect(0,0,w,h);
  }
  function fitText(x,s,maxW,size,weight,fam){ var sz=size; do { x.font=(weight||900)+' '+sz+'px '+(fam||'Inter'); if (x.measureText(s).width<=maxW) break; sz-=2; } while(sz>10); return sz; }
  function wrap(x,s,maxW){ var ws=String(s).split(' '), lines=[], cur=''; ws.forEach(function(w){ var t=cur?cur+' '+w:w; if(x.measureText(t).width>maxW && cur){ lines.push(cur); cur=w; } else cur=t; }); if(cur) lines.push(cur); return lines; }
  function title(x,s,cx,cy,maxW,size,P,align){ var sz=fitText(x,s,maxW,size,900); x.textAlign=align||'center'; x.textBaseline='middle';
    x.lineJoin='round'; x.lineWidth=Math.max(4,sz*0.14); x.strokeStyle='rgba(0,0,0,.55)'; x.strokeText(s,cx,cy+sz*0.05);
    x.fillStyle=P.accent2||P.accent; x.fillText(s,cx,cy); return sz; }
  function caption(x,s,cx,cy,maxW,size,P,align){ x.font='800 '+size+'px Inter'; var ls=wrap(x,s,maxW); x.textAlign=align||'center'; x.textBaseline='middle'; x.fillStyle=P.ink;
    ls.forEach(function(l,i){ x.fillText(l,cx,cy+(i-(ls.length-1)/2)*size*1.22); }); return ls.length; }
  // пиксельная графика (ретро-тема) — без сглаживания только при увеличении; при уменьшении снимка (×3…×5) — сглаживание high, иначе «рваные» пиксели
  function smooth(x,pixel,scale){ x.imageSmoothingEnabled=!(pixel && scale>=1); x.imageSmoothingQuality='high'; }
  // Автофокус вырезки (если в shots.mjs нет focus/detail): окно с наибольшей «энергией» краёв (герой, враги, предметы контрастнее фона),
  // HUD не считается; лёгкий приоритет центра. Возвращает [fx, fy] — доли снимка.
  function autoFocus(img,hud,rw,rh,mo){ var S=240, k=S/img.width, w=S, h=Math.max(2,Math.round(img.height*k)), c=document.createElement('canvas'); c.width=w; c.height=h;
    var x=c.getContext('2d'); x.imageSmoothingEnabled=true; x.drawImage(img,0,0,w,h); var d=x.getImageData(0,0,w,h).data, L=new Float32Array(w*h), i, X, Y;
    for(i=0;i<w*h;i++) L[i]=d[i*4]*0.3+d[i*4+1]*0.59+d[i*4+2]*0.11;
    var inHud=function(X,Y){ return (hud||[]).some(function(r){ return X>=r[0]*w && X<(r[0]+r[2])*w && Y>=r[1]*h && Y<(r[1]+r[3])*h; }); };
    var E=new Float32Array(w*h), es=0; for(Y=0;Y<h-1;Y++) for(X=0;X<w-1;X++){ if(inHud(X,Y)) continue; i=Y*w+X; E[i]=Math.abs(L[i+1]-L[i])+Math.abs(L[i+w]-L[i]); es+=E[i]; }
    // движение (карта mo из MOTION): если двигается заметная, но не вся сцена — фокус по движению (+ немного краёв), иначе — по краям
    if (mo && mo.m) { var M=new Float32Array(w*h), ms=0, mv=0; for(Y=0;Y<h;Y++) for(X=0;X<w;X++){ if(inHud(X,Y)) continue; var q=mo.m[Math.min(mo.h-1,Math.floor(Y*mo.h/h))*mo.w+Math.min(mo.w-1,Math.floor(X*mo.w/w))]; if(q>12){ M[Y*w+X]=q; ms+=q; mv++; } }
      if (mv>w*h*0.002 && mv<w*h*0.6) { var ke=0.25*ms/Math.max(1,es); for(i=0;i<w*h;i++) E[i]=M[i]+E[i]*ke; } }
    var ww=Math.max(1,Math.min(w,Math.round(rw*k))), wh=Math.max(1,Math.min(h,Math.round(rh*k)));
    var best=function(n,win,val){ var s=0,j,bi=0,bs=-1; for(j=0;j<n;j++){ s+=val(j); if(j>=win) s-=val(j-win); if(j>=win-1){ var cx=(j-win/2+0.5)/n, sc=s*(1-0.35*Math.abs(cx-0.5)/0.5); if(sc>bs){ bs=sc; bi=j-win+1; } } } return (bi+win/2)/n; };
    var fx=best(w,ww,function(X){ var s=0; for(var Y=0;Y<h;Y++) s+=E[Y*w+X]; return s; });
    var x0=Math.max(0,Math.round(fx*w-ww/2)), x1=Math.min(w,x0+ww);
    var fy=best(h,wh,function(Y){ var s=0; for(var X=x0;X<x1;X++) s+=E[Y*w+X]; return s; });
    return [fx,fy]; }
  // фокус вырезки/крупного плана: focus из shots.mjs → автофокус (движение, иначе края; HUD не считается). detail (старое поле крупного
  // плана) — только если автофокус не нашёл движения и сцена заморожена (кадры подобраны вручную).
  function focusOf(o,img,rw,rh){ if (o.focus) return o.focus; var moving=o.motion && o.motion.m && o.motion.m.some(function(v){ return v>12; });
    if (!moving && o.detail) return [o.detail[0]+o.detail[2]/2, o.detail[1]+o.detail[3]/2]; return autoFocus(img,o.hud,rw,rh,o.motion); }
  function busyAt(x,bx,by,bw,bh){ var d=x.getImageData(Math.round(bx),Math.round(by),Math.max(1,Math.round(bw)),Math.max(1,Math.round(bh))).data, n=0, s1=0, s2=0; for(var i=0;i<d.length;i+=16){ var v=d[i]*0.3+d[i+1]*0.59+d[i+2]*0.11; s1+=v; s2+=v*v; n++; } var m=s1/n; return s2/n-m*m; }
  function measurePlate(x,o,maxW){ var pad=22, tsz=28, csz=32; x.font='800 '+csz+'px Inter'; var lim=Math.min(maxW-2*pad,760), ls=wrap(x,o.caption,lim);
    if (ls.length>2){ csz=27; x.font='800 '+csz+'px Inter'; ls=wrap(x,o.caption,lim); }
    var cw=0; ls.forEach(function(l){ cw=Math.max(cw,x.measureText(l).width); }); var tz=fitText(x,o.title,lim,tsz,900), tw=x.measureText(o.title).width;
    return { pad:pad, tz:tz, csz:csz, ls:ls, w:Math.min(maxW,Math.max(cw,tw)+2*pad), h:pad*2+tz*1.1+8+ls.length*csz*1.22 }; }
  function drawPlate(x,o,m,bx,by){ x.save(); x.fillStyle='rgba(8,8,14,.72)'; x.fillRect(bx,by,m.w,m.h); x.fillStyle=rgba(o.P.accent,0.95); x.fillRect(bx,by,6,m.h); x.restore();
    x.textAlign='left'; x.textBaseline='middle'; x.font='900 '+m.tz+'px Inter'; x.fillStyle=o.P.accent2||o.P.accent; x.fillText(o.title,bx+m.pad,by+m.pad+m.tz*0.55);
    x.font='800 '+m.csz+'px Inter'; x.fillStyle=o.P.ink; m.ls.forEach(function(l,i){ x.fillText(l,bx+m.pad,by+m.pad+m.tz*1.1+8+m.csz*0.61+i*m.csz*1.22); });
    return { x:bx, y:by, w:m.w, h:m.h }; }
  async function portrait(o){ var img=await load(o.shot), W=720, H=1280, r=canvas(W,H), c=r[0], x=r[1], L=portraitLayout(img.width,img.height,null,W,H);
    if (L.mode==='fit') { bg(x,W,H,o.P,o.n);
      var iw=L.frame.w, ih=L.frame.h, top=L.frame.y, band=H-ih;
      smooth(x,o.pixel,iw/img.width); x.drawImage(img,L.frame.x,top,iw,ih);
      caption(x,o.caption,W/2,top/2,W-60,Math.min(40,Math.max(26,top*0.3)),o.P);
      if (band-top>30) { x.fillStyle=rgba(o.P.accent,0.85); x.fillRect(W/2-60,top+ih+(band-top)/2-3,120,6); }
      return { url:c.toDataURL('image/png'), share:(iw*ih)/(W*H), mode:'fit', frame:L.frame }; }
    if (o.portrait==='stack') { L=portraitLayout(img.width,img.height,null,W,H,'stack'); x.fillStyle='#000'; x.fillRect(0,0,W,H);
      smooth(x,o.pixel,W/img.width); x.drawImage(img,0,0,W,L.frame.h);
      var b=L.box, s0=W/img.width, fs=focusOf(o,img,b.w/(s0*1.6),b.h/(s0*1.6)), cr=closeupRect(img.width,img.height,b.w,b.h,fs,o.zoom||1.6,img.height*s0);
      smooth(x,o.pixel,b.w/cr.w); x.drawImage(img,cr.x,cr.y,cr.w,cr.h,b.x,b.y,b.w,b.h); x.fillStyle=rgba(o.P.accent,0.9); x.fillRect(L.sep.x,L.sep.y,L.sep.w,L.sep.h);
      var ms=measurePlate(x,o,W-2*L.margin), sx=Math.round((W-ms.w)/2), syb=H-L.margin-ms.h, syt=b.y+L.margin, pyS=busyAt(x,sx,syt,ms.w,ms.h)<busyAt(x,sx,syb,ms.w,ms.h)*0.6?syt:syb;
      var plS=drawPlate(x,o,ms,sx,pyS);
      return { url:c.toDataURL('image/png'), share:1-(plS.w*plS.h+L.sep.w*L.sep.h)/(W*H), mode:'stack', plate:plS, closeup:cr, focus:fs, frame:L.frame }; }
    // crop: вырезка 9:16 вокруг героя/действия на всю картинку + вклейка срезанного HUD + подпись на подложке
    var a=W/H, rw0=img.width/img.height>a ? img.height*a : img.width, rh0=img.width/img.height>a ? img.height : img.width/a;
    var focus=focusOf(o,img,rw0,rh0); L=portraitLayout(img.width,img.height,focus,W,H);
    x.fillStyle='#000'; x.fillRect(0,0,W,H); smooth(x,o.pixel,L.scale); x.drawImage(img,L.src.x,L.src.y,L.src.w,L.src.h,0,0,W,H);
    var hi=hudInset(img.width,img.height,L.src,o.hud,W,H), nonGame=0, top0=0, bot0=H;
    if (hi) { var st=hi.strip; x.fillStyle='rgb(8,8,14)'; x.fillRect(st.x,st.y,st.w,st.h); var rowsA=0;
      hi.rows.forEach(function(q){ smooth(x,o.pixel,q.d.w/q.s.w); x.drawImage(img,q.s.x,q.s.y,q.s.w,q.s.h,q.d.x,q.d.y,q.d.w,q.d.h); rowsA+=q.d.w*q.d.h; });
      x.fillStyle=rgba(o.P.accent,0.9); x.fillRect(0,hi.bottom?st.y:st.y+st.h-3,W,3); nonGame+=st.w*st.h-rowsA;
      if (hi.bottom) bot0=st.y; else top0=st.h; }
    var m=measurePlate(x,o,W-2*L.margin), px=Math.round((W-m.w)/2), yb=bot0-L.margin-m.h, yt=top0+L.margin;
    var bb=busyAt(x,px,yb,m.w,m.h), bt=busyAt(x,px,yt,m.w,m.h), py=(bt<bb*0.6) ? yt : yb;   // по умолчанию снизу; сверху — только если там заметно спокойнее
    var pl=drawPlate(x,o,m,px,py); nonGame+=pl.w*pl.h;
    return { url:c.toDataURL('image/png'), share:1-nonGame/(W*H), mode:'crop', plate:pl, src:L.src, focus:focus, hud:!!hi, frame:L.frame }; }
  // Альбомный кадр 1280×720. Раскладка — landscapeLayout (общая с тестом tools/promo/promo-build.test.mjs):
  //  full — кадр 16:9 (±5 %) на весь размер, без полос и сдвига; fit — почти 16:9 (≥ 1,45): кадр по высоте по центру, по бокам — тот же
  //  кадр размытым фоном (без пустых полос); в обоих — подпись и название внутри кадра на тёмной подложке у нижнего края — слева или
  //  справа, где кадр под ней спокойнее (меньше разброс яркости: обычно там нет героя и врагов), поровну — по очереди; split — узкий кадр
  //  (портретная, квадратная, 4:3 игра): кадр вплотную к краю, остальное — крупный план того же кадра, подпись — в крупном плане или поверх.
  var landscapeLayout = ${LAYOUT_SRC};
  function plate(x,o,L,W,H){ // подложка с названием и подписью внутри кадра (full/fit — в кадре; split — в крупном плане или поверх всей картинки)
    var A=L.plateArea||L.frame, ax=Math.max(A.x,0), aw=Math.min(A.x+A.w,W)-ax, m=measurePlate(x,o,aw-2*L.margin), by=H-L.margin-m.h;
    var xl=ax+L.margin, xr=ax+aw-L.margin-m.w;
    // сторона подложки: где под ней «спокойнее» кадр (меньше разброс яркости — нет героя/врагов/предметов); поровну — по очереди
    var bl=busyAt(x,xl,by,m.w,m.h), br=busyAt(x,xr,by,m.w,m.h), bx=Math.abs(bl-br)<Math.max(bl,br)*0.15+1 ? (L.plateLeft?xl:xr) : (bl<br?xl:xr);
    return drawPlate(x,o,m,bx,by);
  }
  async function landscape(o){ var img=await load(o.shot), W=1280, H=720, r=canvas(W,H), c=r[0], x=r[1], L=landscapeLayout(img.width,img.height,o.n,W,H);
    x.fillStyle='#000'; x.fillRect(0,0,W,H);
    if (L.mode!=='split') {
      if (L.bg) { x.save(); x.filter='blur(18px) brightness(.55)'; x.drawImage(img,L.bg.x,L.bg.y,L.bg.w,L.bg.h); x.restore(); }
      smooth(x,o.pixel,L.frame.w/img.width); x.drawImage(img,L.frame.x,L.frame.y,L.frame.w,L.frame.h); x.imageSmoothingEnabled=true;
      var pl=plate(x,o,L,W,H), vis=Math.min(L.frame.w,W)*Math.min(L.frame.h,H);
      return { url:c.toDataURL('image/png'), share:(vis-pl.w*pl.h)/(W*H), mode:L.mode, plate:pl, frame:L.frame }; }
    // split: кадр целиком вплотную к краю + крупный план того же кадра на остальном месте (элемент игры, Яндекс 5.1.1.2) + подпись
    smooth(x,o.pixel,L.frame.w/img.width); x.drawImage(img,L.frame.x,L.frame.y,L.frame.w,L.frame.h);
    var b=L.box, s=H/img.height, focus=focusOf(o,img,b.w/(s*1.6),b.h/(s*1.6)), cr=closeupRect(img.width,img.height,b.w,b.h,focus,o.zoom||1.6,H);
    smooth(x,o.pixel,b.w/cr.w); x.drawImage(img,cr.x,cr.y,cr.w,cr.h,b.x,b.y,b.w,b.h);
    x.fillStyle=rgba(o.P.accent,0.9); x.fillRect(L.sep.x,L.sep.y,L.sep.w,L.sep.h);
    var pl2=plate(x,o,L,W,H);
    return { url:c.toDataURL('image/png'), share:1-(pl2.w*pl2.h+L.sep.w*L.sep.h)/(W*H), mode:'split', plate:pl2, frame:L.frame, closeup:cr, focus:focus }; }
  async function icon(o){ var S=o.size, r=canvas(S,S), c=r[0], x=r[1]; x.save(); x.scale(S/1024,S/1024); PromoArt.icon(x,1024,o.P); x.restore(); return { url:c.toDataURL('image/png') }; }
  async function cover(o){ var W=o.w, H=o.h, r=canvas(W,H), c=r[0], x=r[1]; var res=PromoArt.cover(x,W,H,o.P,{ lang:o.lang }) || {};
    var area=res.title || { x:W/2, y:H*0.2, w:W*0.8, size:H*0.17 }; title(x,o.title,area.x,area.y,area.w,area.size,o.P,area.align); return { url:c.toDataURL('image/png') }; }
  return { portrait:portrait, landscape:landscape, icon:icon, cover:cover };
})();`;

// PNG из canvas — 32-бит RGBA; Яндекс для скриншотов просит «JPEG или 24-разрядный PNG» → без альфа-канала (PNG24) и пересжатие
// без потерь (ImageMagick, если есть: размер файла ~в 2 раза меньше). Без ImageMagick — как есть (предупреждение в report.checks).
let HAS_IM = null;
async function writeDataUrl(file, url) {
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  if (HAS_IM == null) { try { execFileSync('convert', ['-version'], { stdio: 'ignore' }); HAS_IM = true; } catch (e) { HAS_IM = false; } }
  if (HAS_IM) execFileSync('convert', [file, '-strip', '-background', 'black', '-alpha', 'remove', '-alpha', 'off', '-define', 'png:compression-level=9', 'PNG24:' + file]);
  return fs.statSync(file).size;
}
function pngSize(file) { const b = fs.readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }

// slug — игра из корня репо (`kaskad`) или прототип вне каталога (`_proto/mednitsa`): промо — promo/<имя>/, страница игры — /<slug>/
export function gameName(slug) { return /^(?:_proto\/)?[a-z0-9-]+$/.test(String(slug)) ? String(slug).split('/').pop() : null; }

export async function buildPromo(slug, opts = {}) {
  slug = String(slug).replace(/\/+$/, ''); const game = gameName(slug); if (!game) die('нет игры ' + slug);
  const dir = path.join(PROMO_DIR, game), out = path.resolve(opts.out || dir);
  const P = JSON.parse(fs.readFileSync(path.join(dir, 'promo.json'), 'utf8'));
  const langs = opts.langs || Object.keys(P.names);
  const problems = checkTexts(P); if (problems.length) die('тексты promo.json:\n  ' + problems.join('\n  '));
  const wordWarn = scanPromo(P).warnings;
  const shotsMod = await import(pathToFileURL(path.join(dir, 'shots.mjs')).href);
  // layout (необяз.) из shots.mjs: { hud: [[x, y, w, h], …] — HUD в долях снимка (для вклейки в портретную вырезку), k — множитель снимка,
  //   portrait: 'stack' — раскладка портрета по умолчанию для игры }; в кадре сценария: focus [fx, fy], portrait, zoom, hud — свои для кадра
  const LAY = shotsMod.layout || {};
  const artFiles = [path.join(ROOT, 'tools/promo/art-default.js')].concat(fs.existsSync(path.join(dir, 'art.js')) ? [path.join(dir, 'art.js')] : []);
  const port = opts.port || 8401, base = `http://127.0.0.1:${port}/`;
  const srv = await startServer(port), browser = await loadChromium().launch(), report = { slug: game, src: slug, built: new Date().toISOString(), files: [], checks: wordWarn.map((w) => 'проверить слово: ' + w), langs };
  const add = (f, extra) => { const rel = path.relative(ROOT, f), sz = fs.statSync(f).size, dim = /\.png$/.test(f) ? pngSize(f) : null; report.files.push(Object.assign({ file: rel, bytes: sz, size: dim && dim.join('×') }, extra || {})); console.log('  ' + rel + (dim ? ' ' + dim.join('×') : '') + ' ' + Math.round(sz / 1024) + ' КБ' + (extra && extra.share ? ` · геймплей ${Math.round(extra.share * 100)}% кадра` : '')); };
  try {
    // 1) компоновщик
    const comp = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
    await comp.goto(base + '__compose'); for (const f of artFiles) await comp.addScriptTag({ path: f }); await comp.addScriptTag({ content: COMPOSE });
    await comp.evaluate(() => Promise.all(['900 40px Inter', '800 40px Inter'].map((f) => document.fonts.load(f))));
    // иконки (общие для языков, без текста)
    for (const s of SIZES.icon) { const r = await comp.evaluate((o) => Compose.icon(o), { size: s, P: P.palette }); const f = path.join(out, `icon-${s}.png`); await writeDataUrl(f, r.url); add(f); }
    for (const lang of langs) {
      const D = (P.display && P.display[lang]) || P.names[lang];
      for (const [w, h] of [SIZES.coverY, SIZES.coverGP]) { const r = await comp.evaluate((o) => Compose.cover(o), { w, h, P: P.palette, title: D, lang }); const f = path.join(out, lang, `cover-${w}x${h}.png`); await writeDataUrl(f, r.url); add(f); }
      fs.writeFileSync(path.join(out, lang, 'listing.md'), listingMd(P, lang)); report.files.push({ file: path.relative(ROOT, path.join(out, lang, 'listing.md')) });
    }
    // 2) скриншоты геймплея: игра в браузере (сайт без площадки), canvas ×2, сценарии из shots.mjs
    const shots = shotsMod.default || shotsMod.shots;
    report.layoutVersion = LAYOUT_VERSION; report.hud = LAY.hud || null;
    for (const lang of langs) {
      const D = (P.display && P.display[lang]) || P.names[lang], caps = P.captions[lang];
      for (let i = 0; i < shots.length; i++) {
        const sc = shots[i], ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }), page = await ctx.newPage();
        const errs = []; page.on('pageerror', (e) => errs.push(e.message));
        await page.addInitScript((t) => { try { localStorage.clear(); localStorage.setItem('arcade.theme', t); localStorage.setItem('arcade.sound', '0'); } catch (e) {} }, sc.theme || 'modern');
        await page.goto(`${base}${slug}/?lang=${lang}`); await wait(600);
        await page.evaluate(HIRES, sc.k || LAY.k || 0);
        await sc.run(page, { wait, lang });
        const cap = await grabCanvas(page), motion = sc.focus ? null : await page.evaluate(MOTION, 160); if (errs.length) throw new Error(slug + ' ' + sc.name + ': ' + errs.join(' | '));
        await ctx.close();
        const pix = cap.theme === 'retro';
        const bo = { shot: cap.url, P: P.palette, caption: caps[i % caps.length], title: D, n: i + 1, detail: sc.detail || null, focus: sc.focus || null, zoom: sc.zoom || null, portrait: sc.portrait || LAY.portrait || null, motion, hud: sc.hud || LAY.hud || null, pixel: pix };
        const rp = await comp.evaluate((o) => Compose.portrait(o), bo);
        const fp = path.join(out, lang, `shot-portrait-${i + 1}.png`); await writeDataUrl(fp, rp.url);
        add(fp, { share: rp.share, scenario: sc.name, layout: rp.mode, capture: cap.w + '×' + cap.h, focus: rp.focus && rp.focus.map((v) => +v.toFixed(3)), hudInset: rp.mode === 'crop' ? rp.hud : undefined, plate: rp.plate });
        const rl = await comp.evaluate((o) => Compose.landscape(o), bo);
        const fl = path.join(out, lang, `shot-landscape-${i + 1}.png`); await writeDataUrl(fl, rl.url);
        add(fl, { share: rl.share, scenario: sc.name, layout: rl.mode, capture: cap.w + '×' + cap.h, focus: rl.focus && rl.focus.map((v) => +v.toFixed(3)), plate: rl.plate });
      }
    }
    // 3) видео 16:9 (≤ 28 с): игра в режиме 16:9 (_shared/aspect.js), запись Playwright → MP4 (ffmpeg, H.264)
    if (opts.video !== false && shotsMod.video) {
      let ff = null; try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); ff = 'ffmpeg'; } catch (e) { report.checks.push('нет ffmpeg — видео не собрано'); }
      for (const lang of ff ? langs : []) {
        const vdir = path.join(out, lang, '.video-tmp'); fs.rmSync(vdir, { recursive: true, force: true }); fs.mkdirSync(vdir, { recursive: true });
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vdir, size: { width: 1280, height: 720 } } }), page = await ctx.newPage();
        await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('arcade.theme', 'modern'); localStorage.setItem('arcade.sound', '0'); } catch (e) {} });
        await page.goto(`${base}${slug}/?lang=${lang}`); const t0 = Date.now();
        await page.addStyleTag({ content: 'a[data-catalog-back]{display:none!important}' });
        await page.evaluate(() => { const m = document.createElement('meta'); m.name = 'arcade-aspect'; m.content = '16:9'; document.head.appendChild(m); });
        await page.addScriptTag({ url: '/_shared/aspect.js' }); await wait(400);
        await shotsMod.video(page, { wait, lang, seconds: 24 });
        const lead = (Date.now() - t0) / 1000; await ctx.close();
        const webm = fs.readdirSync(vdir).find((f) => f.endsWith('.webm')), mp4 = path.join(out, lang, 'video-landscape.mp4');
        execFileSync(ff, ['-y', '-loglevel', 'error', '-ss', '1.0', '-i', path.join(vdir, webm), '-t', String(Math.min(26, Math.max(10, lead - 1.2))), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '24', '-movflags', '+faststart', '-an', mp4]);
        fs.rmSync(vdir, { recursive: true, force: true });
        const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString()) || 0;
        add(mp4, { seconds: +dur.toFixed(1) }); if (dur > 28) report.checks.push(lang + ': видео ' + dur + ' с > 28 с');
      }
    }
  } finally { await browser.close(); srv.close(); }
  if (opts.video === false) { // --no-video: прежние ролики остаются на месте — переносим их строки из старого отчёта
    try { const prev = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8')); (prev.files || []).filter((f) => /\.mp4$/.test(f.file) && fs.existsSync(path.join(ROOT, f.file))).forEach((f) => report.files.push(f)); } catch (e) {}
    for (const lang of langs) { // ролик есть на диске, но старый отчёт (до волны 31) его не перечислял — дописать строку
      const mp4 = path.join(out, lang, 'video-landscape.mp4'), rel = path.relative(ROOT, mp4); if (!fs.existsSync(mp4) || report.files.some((f) => f.file === rel)) continue;
      let sec = null; try { sec = +parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString()).toFixed(1); } catch (e) {}
      report.files.push({ file: rel, bytes: fs.statSync(mp4).size, seconds: sec });
    }
  }
  if (!HAS_IM) report.checks.push('нет ImageMagick (convert): PNG остались 32-битными RGBA — для Яндекса нужен PNG-24/JPEG');
  checkReport(report, langs, shotsCount(shotsMod)).forEach((e) => report.checks.push('ОШИБКА: ' + e));
  report.sources = ['https://yandex.ru/dev/games/doc/ru/console/add-new-game/draft', 'https://yandex.ru/dev/games/doc/ru/concepts/requirements', 'https://yandex.ru/dev/games/doc/ru/requirements/5/1/1/2', 'https://yandex.ru/dev/games/doc/ru/requirements/5/1/3', 'https://docs.gamepush.com/docs/distribution/'];
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opts = {}; let slug = null;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--langs') opts.langs = String(a[++i] || '').split(',').filter(Boolean);
    else if (a[i] === '--no-video') opts.video = false;
    else if (a[i] === '--port') opts.port = +a[++i];
    else if (a[i] === '--out') opts.out = a[++i];
    else if (a[i] === '--check') opts.check = true;
    else if (a[i] === '--listings') opts.listings = true;
    else slug = a[i];
  }
  if (slug) slug = slug.replace(/\/+$/, '');
  const game = slug && gameName(slug);
  if (!game || !fs.existsSync(path.join(PROMO_DIR, game, 'promo.json')) || (!opts.check && !fs.existsSync(path.join(ROOT, slug, 'index.html')))) die('использование: node tools/promo-build.mjs <slug> [--langs ru,en] [--no-video] [--port 8401] [--out dir] (нужен promo/<slug>/promo.json и shots.mjs)');
  if (opts.check) { // проверка без сборки — ничего не пишет: тексты promo.json + собранные кадры по report.json (доля геймплея ≥ 70 %)
    const dir = path.join(PROMO_DIR, game), P = JSON.parse(fs.readFileSync(path.join(dir, 'promo.json'), 'utf8')), probs = checkTexts(P), warn = scanPromo(P).warnings;
    if (fs.existsSync(path.join(dir, 'shots.mjs'))) {
      const mod = await import(pathToFileURL(path.join(dir, 'shots.mjs')).href); let R = null; try { R = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8')); } catch (e) {}
      checkReport(R, Object.keys(P.names), shotsCount(mod)).forEach((e) => probs.push('кадры: ' + e));
    } else warn.push('нет shots.mjs — скриншоты не проверялись (промо только из текстов)');
    warn.forEach((w) => console.log('  ! ' + (/^нет shots/.test(w) ? w : 'проверить слово: ' + w))); probs.forEach((p) => console.log('  ✗ ' + p));
    console.log((probs.length ? 'FAIL' : 'OK  ') + ' promo/' + game + ': ошибок ' + probs.length + ', предупреждений ' + warn.length); process.exit(probs.length ? 1 : 0);
  }
  if (opts.listings) { // только тексты для форм: <lang>/listing.md из promo.json (без браузера; после правки текстов, когда кадры не менялись)
    const P = JSON.parse(fs.readFileSync(path.join(PROMO_DIR, game, 'promo.json'), 'utf8')), probs = checkTexts(P); if (probs.length) die('тексты promo.json:\n  ' + probs.join('\n  '));
    const out = path.resolve(opts.out || path.join(PROMO_DIR, game));
    for (const lang of opts.langs || Object.keys(P.names)) { fs.mkdirSync(path.join(out, lang), { recursive: true }); fs.writeFileSync(path.join(out, lang, 'listing.md'), listingMd(P, lang)); console.log('  ' + path.relative(ROOT, path.join(out, lang, 'listing.md'))); }
    process.exit(0);
  }
  console.log('промо ' + game + (game !== slug ? ' (' + slug + ')' : '') + ':');
  const r = await buildPromo(slug, opts);
  r.checks.forEach((c) => console.log('  ! ' + c));
  console.log(`готово: файлов ${r.files.length}, замечаний ${r.checks.length} → promo/${game}/report.json`);
}
