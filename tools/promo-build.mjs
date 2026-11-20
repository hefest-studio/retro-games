#!/usr/bin/env node
/* tools/promo-build.mjs — промо-материалы игры для каталогов площадок (Яндекс Игры, GamePush) из реального геймплея.
   Запуск:  node tools/promo-build.mjs <slug> [--langs ru,en] [--no-video] [--port 8401] [--out promo/<slug>]
            node tools/promo-build.mjs <slug> --check   — только проверка текстов promo.json (длины, дубли, запрещённые слова), без браузера и без записи
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
       снятый Playwright-ом с canvas игры (без интерфейса браузера и страницы), с подписью на языке;
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
const HIRES = (k) => {
  const g = window.Arcade && window.Arcade.last; if (!g) return false; const c = g.canvas, ctx = g.ctx;
  if (c.__promoK) return true; c.__promoK = k;
  const st = ctx.setTransform.bind(ctx), smooth = ctx.imageSmoothingEnabled;
  c.width = g.W * k; c.height = g.H * k;
  ctx.setTransform = function (a, b, cc, d, e, f) { if (a && typeof a === 'object') { const m = a; return st(m.a * k, m.b * k, m.c * k, m.d * k, m.e * k, m.f * k); } return st(a * k, b * k, cc * k, d * k, e * k, f * k); };
  ctx.resetTransform = function () { st(k, 0, 0, k, 0, 0); };
  st(k, 0, 0, k, 0, 0); ctx.imageSmoothingEnabled = smooth; g._applyPixel = function () { ctx.imageSmoothingEnabled = !g.th().pixel; };
  return true;
};
async function grabCanvas(page) {
  return page.evaluate(() => { const g = Arcade.last; return { url: g.canvas.toDataURL('image/png'), w: g.canvas.width, h: g.canvas.height, W: g.W, H: g.H, theme: g.themeName }; });
}

// ---------- компоновка в браузере (canvas): скриншоты с подписью, иконки, обложки ----------
const COMPOSE = String.raw`
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
  async function portrait(o){ var img=await load(o.shot), W=720, H=1280, r=canvas(W,H), c=r[0], x=r[1]; bg(x,W,H,o.P,o.n);
    var k=Math.min(W/img.width, (H-150)/img.height), iw=Math.round(img.width*k), ih=Math.round(img.height*k), band=H-ih, top=Math.round(band*0.62);
    x.imageSmoothingEnabled=!o.pixel; x.drawImage(img,Math.round((W-iw)/2),top,iw,ih);
    caption(x,o.caption,W/2,top/2,W-60,Math.min(40,Math.max(26,top*0.3)),o.P);
    if (band-top>30) { x.fillStyle=rgba(o.P.accent,0.85); x.fillRect(W/2-60,top+ih+(band-top)/2-3,120,6); }
    return { url:c.toDataURL('image/png'), share:(iw*ih)/(W*H) }; }
  async function landscape(o){ var img=await load(o.shot), W=1280, H=720, r=canvas(W,H), c=r[0], x=r[1]; bg(x,W,H,o.P,o.n);
    var k=H/img.height, iw=Math.round(img.width*k), ih=H, gx=o.n%2? W-iw-70 : 70; x.imageSmoothingEnabled=!o.pixel; x.drawImage(img,gx,0,iw,ih);
    var side = o.n%2 ? [40, gx-40] : [gx+iw+40, W-40], cw=side[1]-side[0], cx=side[0]+cw/2;
    title(x,o.title,cx,150,cw,74,o.P); caption(x,o.caption,cx,250,cw,38,o.P);
    // крупный план фрагмента геймплея — элемент игры на свободном месте (Яндекс 5.1.1.2: свободное место — элементы игры или текст)
    if (o.detail) { var d=o.detail, dw=Math.min(cw,520), dh=Math.round(dw*d[3]/d[2]); if (dh>330){ dh=330; dw=Math.round(dh*d[2]/d[3]); }
      var dx=cx-dw/2, dy=330+(360-dh)/2; x.save(); x.shadowColor='rgba(0,0,0,.6)'; x.shadowBlur=24; x.fillStyle='#000'; x.fillRect(dx,dy,dw,dh); x.restore();
      x.drawImage(img,d[0]*img.width,d[1]*img.height,d[2]*img.width,d[3]*img.height,dx,dy,dw,dh); x.strokeStyle=rgba(o.P.accent,0.9); x.lineWidth=4; x.strokeRect(dx,dy,dw,dh); var extra=dw*dh; }
    return { url:c.toDataURL('image/png'), share:(iw*ih+(extra||0))/(W*H) }; }
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

export async function buildPromo(slug, opts = {}) {
  const dir = path.join(PROMO_DIR, slug), out = path.resolve(opts.out || dir);
  const P = JSON.parse(fs.readFileSync(path.join(dir, 'promo.json'), 'utf8'));
  const langs = opts.langs || Object.keys(P.names);
  const problems = checkTexts(P); if (problems.length) die('тексты promo.json:\n  ' + problems.join('\n  '));
  const wordWarn = scanPromo(P).warnings;
  const shotsMod = await import(pathToFileURL(path.join(dir, 'shots.mjs')).href);
  const artFiles = [path.join(ROOT, 'tools/promo/art-default.js')].concat(fs.existsSync(path.join(dir, 'art.js')) ? [path.join(dir, 'art.js')] : []);
  const port = opts.port || 8401, base = `http://127.0.0.1:${port}/`;
  const srv = await startServer(port), browser = await loadChromium().launch(), report = { slug, built: new Date().toISOString(), files: [], checks: wordWarn.map((w) => 'проверить слово: ' + w), langs };
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
    for (const lang of langs) {
      const D = (P.display && P.display[lang]) || P.names[lang], caps = P.captions[lang];
      for (let i = 0; i < shots.length; i++) {
        const sc = shots[i], ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }), page = await ctx.newPage();
        const errs = []; page.on('pageerror', (e) => errs.push(e.message));
        await page.addInitScript((t) => { try { localStorage.clear(); localStorage.setItem('arcade.theme', t); localStorage.setItem('arcade.sound', '0'); } catch (e) {} }, sc.theme || 'modern');
        await page.goto(`${base}${slug}/?lang=${lang}`); await wait(600);
        await page.evaluate(HIRES, 2);
        await sc.run(page, { wait, lang });
        const cap = await grabCanvas(page); if (errs.length) throw new Error(slug + ' ' + sc.name + ': ' + errs.join(' | '));
        await ctx.close();
        const pix = cap.theme === 'retro';
        const rp = await comp.evaluate((o) => Compose.portrait(o), { shot: cap.url, P: P.palette, caption: caps[i % caps.length], n: i + 1, pixel: pix });
        const fp = path.join(out, lang, `shot-portrait-${i + 1}.png`); await writeDataUrl(fp, rp.url); add(fp, { share: rp.share, scenario: sc.name });
        const rl = await comp.evaluate((o) => Compose.landscape(o), { shot: cap.url, P: P.palette, caption: caps[i % caps.length], title: D, n: i + 1, detail: sc.detail || null, pixel: pix });
        const fl = path.join(out, lang, `shot-landscape-${i + 1}.png`); await writeDataUrl(fl, rl.url); add(fl, { share: rl.share, scenario: sc.name });
        if (rp.share < 0.7) report.checks.push(`${lang} shot-portrait-${i + 1}: геймплей ${Math.round(rp.share * 100)}% < 70% (Яндекс 5.1.1.2)`);
        if (rl.share < 0.7) report.checks.push(`${lang} shot-landscape-${i + 1}: геймплей ${Math.round(rl.share * 100)}% кадра, остальное — название, подпись и крупный план игры (Яндекс 5.1.1.2 допускает «элементы игры или поясняющий текст»; риск для десктопных скриншотов портретной игры)`);
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
  if (!HAS_IM) report.checks.push('нет ImageMagick (convert): PNG остались 32-битными RGBA — для Яндекса нужен PNG-24/JPEG');
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
    else slug = a[i];
  }
  if (!slug || !/^[a-z0-9-]+$/.test(slug) || !fs.existsSync(path.join(PROMO_DIR, slug, 'promo.json'))) die('использование: node tools/promo-build.mjs <slug> [--langs ru,en] [--no-video] [--port 8401] [--out dir] (нужен promo/<slug>/promo.json и shots.mjs)');
  if (opts.check) { // только проверка текстов — ничего не пишет
    const P = JSON.parse(fs.readFileSync(path.join(PROMO_DIR, slug, 'promo.json'), 'utf8')), probs = checkTexts(P), warn = scanPromo(P).warnings;
    warn.forEach((w) => console.log('  ! проверить слово: ' + w)); probs.forEach((p) => console.log('  ✗ ' + p));
    console.log((probs.length ? 'FAIL' : 'OK  ') + ' promo/' + slug + '/promo.json: ошибок ' + probs.length + ', предупреждений ' + warn.length); process.exit(probs.length ? 1 : 0);
  }
  console.log('промо ' + slug + ':');
  const r = await buildPromo(slug, opts);
  r.checks.forEach((c) => console.log('  ! ' + c));
  console.log(`готово: файлов ${r.files.length}, замечаний ${r.checks.length} → promo/${slug}/report.json`);
}
