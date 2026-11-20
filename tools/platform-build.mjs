#!/usr/bin/env node
/* tools/platform-build.mjs — сборка одной игры аркады под игровую площадку (Яндекс Игры, GamePush, свой сайт).
   Запуск:  node tools/platform-build.mjs <slug> <yandex|gamepush|web> <out_dir> [--config cfg.json] [--no-zip] [--aspect 16:9]
   --aspect 16:9 — режим для порталов с холстом 16:9 (Poki, CrazyGames): js/aspect.js (копия _shared/aspect.js) вписывает игру
            в сцену 16:9 по высоте, поля — фоном по теме игры; папка/архив получают суффикс -16x9 (<slug>-<platform>-16x9).
   Итог:    <out_dir>/<slug>-<platform>/          — папка для ZIP: index.html в корне, только файлы игры
            <out_dir>/<slug>-<platform>.zip       — архив для загрузки в консоль площадки (если есть утилита zip)
            <out_dir>/<slug>-<platform>.build.json — отчёт: файлы, размер, предупреждения, версии движка и адаптера
   Что делает:
   1) копирует папку игры без tests/, *.md, legacy.html, служебных файлов; engine.js — свежая копия _shared/engine.js;
   2) кладёт адаптер _shared/platform.js → js/platform.js и подключает его ДО engine.js как ./js/platform.js?platform=<площадка>
      (+ <meta name="arcade-platform">); Яндекс — ещё <script src="/sdk.js"> (SDK отдаёт сама площадка, относительный путь);
      GamePush — <meta> с ID проекта и публичным токеном (SDK грузит адаптер);
   3) убирает ссылки наружу: «← Каталог» (a[data-catalog-back]), <a href="http…">, <link rel="canonical">, og:url —
      требования Яндекс Игр 8.4.2/8.4.4 и Pikabu (через GamePush); движок v2.5 дополнительно прячет ссылки при запуске;
   3б) общий CSS площадки (Яндекс 1.6.1.8, 1.6.2.7, 1.10.2; GamePush): без прокрутки страницы и pull-to-refresh, без выделения
      и «выноски» долгого тапа; <title> = название игры на языке (promo/<slug>/promo.json → names.ru/en, EN — через data-en);
   4) проверяет: нет внешних URL в HTML/CSS/JS (кроме пространства имён SVG и адреса SDK в адаптере), пути — латиница без
      пробелов (Яндекс 1.7, 1.22), распакованный размер ≤ 100 МБ (Яндекс 1.21); при нарушении — код возврата 1.
   5) (yandex, gamepush) запрещённые слова в видимом тексте собранной игры — tools/lib/banned-words.mjs: «демо/demo», «trial version»,
      «бета», «в разработке» и т. п. (Яндекс 1.15, частая причина отказа) → ошибка сборки с файлом, строкой и фразой; намёки
      («полная версия», «скоро», Steam) → предупреждения. Ложное срабатывание — исключение в EXCEPTIONS того же модуля.
   Ключи и ID проектов — НЕ в репо: --config <файл вне репо> { "gamepush": { "projectId", "publicToken", "saveField" } }
   или переменные окружения GP_PROJECT_ID, GP_PUBLIC_TOKEN, GP_SAVE_FIELD; без них — плейсхолдеры (игра запустится
   без SDK GamePush: локальные сохранения, без рекламы) и предупреждение.
   <out_dir> не должен лежать внутри репо. Подробнее — _shared/PLATFORMS.md. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scanBuild, HINT as BANNED_HINT } from './lib/banned-words.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// промо (названия по языкам) живёт в приватном arcade-full/promo (как в tools/promo-build.mjs); старое место promo/ в репо — запасное
const PROMO_DIRS = [process.env.PROMO_DIR, path.join(ROOT, '..', 'arcade-full', 'promo'), path.join(ROOT, 'promo')].filter(Boolean).map((d) => path.resolve(d));
const PLATFORMS = ['yandex', 'gamepush', 'web'];
const LIMIT = 100 * 1024 * 1024; // Яндекс Игры, п. 1.21: распакованная игра ≤ 100 МБ
const SKIP_DIRS = new Set(['tests', 'node_modules', '.git']);
const SKIP_FILE = (f) => /\.md$/i.test(f) || /^legacy\.html$/i.test(f) || /^\./.test(f) || /\.(mjs|log|orig|bak)$/i.test(f);
const TEXT = /\.(html?|js|css|json|svg|txt)$/i;
const ALLOWED_URL = [/^http:\/\/www\.w3\.org\//, /^https:\/\/gamepush\.com\/sdk\//];
const PLATFORM_CSS = '<style id="arcade-platform-css">html,body{overscroll-behavior:none;overflow:hidden;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-text-size-adjust:100%}canvas{touch-action:none;-webkit-user-select:none;user-select:none}</style>';

function die(msg) { console.error('ошибка: ' + msg); process.exit(2); }
function usage() { console.error('использование: node tools/platform-build.mjs <slug> <yandex|gamepush|web> <out_dir> [--config cfg.json] [--no-zip] [--aspect 16:9]'); process.exit(2); }

export function build(slug, platform, outDir, opts = {}) {
  const src = path.join(ROOT, slug);
  if (!/^[a-z0-9-]+$/.test(slug) || !fs.existsSync(path.join(src, 'index.html'))) die('нет игры ' + slug);
  if (!PLATFORMS.includes(platform)) die('площадка должна быть одной из: ' + PLATFORMS.join(', '));
  const out = path.resolve(outDir);
  if ((out + path.sep).startsWith(ROOT + path.sep)) die('<out_dir> не должен лежать внутри репо ' + ROOT);
  fs.mkdirSync(out, { recursive: true });
  const aspect = opts.aspect || null;
  if (aspect && !/^\d+:\d+$/.test(aspect)) die('--aspect: формат W:H, например 16:9');
  const name = slug + '-' + platform + (aspect ? '-' + aspect.replace(':', 'x') : ''), dst = path.join(out, name), info = path.join(out, name + '.build.json'), zip = path.join(out, name + '.zip');
  if (fs.existsSync(dst)) { if (!fs.existsSync(info)) die(dst + ' уже есть и собран не этим скриптом'); fs.rmSync(dst, { recursive: true, force: true }); }
  if (fs.existsSync(zip)) fs.rmSync(zip);
  const warnings = [], errors = [];

  // 1) копия игры
  const files = [];
  (function copy(from, to, rel) {
    fs.mkdirSync(to, { recursive: true });
    for (const d of fs.readdirSync(from, { withFileTypes: true })) {
      const r = rel ? rel + '/' + d.name : d.name;
      if (d.isDirectory()) { if (!SKIP_DIRS.has(d.name)) copy(path.join(from, d.name), path.join(to, d.name), r); continue; }
      if (!d.isFile() || SKIP_FILE(d.name)) continue;
      fs.copyFileSync(path.join(from, d.name), path.join(to, d.name)); files.push(r);
    }
  })(src, dst, '');
  const html0 = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
  if (!/src="\.\/engine\.js"/.test(html0)) errors.push('игра не на движке v2 (нет ./engine.js) — адаптер не свяжется с движком');
  else { fs.copyFileSync(path.join(ROOT, '_shared/engine.js'), path.join(dst, 'engine.js')); if (!files.includes('engine.js')) files.push('engine.js'); }
  fs.mkdirSync(path.join(dst, 'js'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, '_shared/platform.js'), path.join(dst, 'js/platform.js')); if (!files.includes('js/platform.js')) files.push('js/platform.js');
  if (aspect) { fs.copyFileSync(path.join(ROOT, '_shared/aspect.js'), path.join(dst, 'js/aspect.js')); if (!files.includes('js/aspect.js')) files.push('js/aspect.js'); }
  // названия по языкам (Яндекс 5.1.3: внутри языка одно название везде) — из promo/<slug>/promo.json, если есть
  let names = null; for (const d of PROMO_DIRS) { try { names = JSON.parse(fs.readFileSync(path.join(d, slug, 'promo.json'), 'utf8')).names || null; break; } catch (e) { names = null; } }

  // 2) index.html: площадка, SDK, ключи; 3) без ссылок наружу
  let html = html0;
  const removed = [];
  html = html.replace(/<a\b[^>]*\bdata-catalog-back\b[^>]*>[\s\S]*?<\/a>\s*/gi, (m) => { removed.push('«← Каталог»'); return ''; });
  html = html.replace(/<a\b[^>]*\bhref=["'](?:https?:)?\/\/[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, (m) => { removed.push('внешняя ссылка'); return ''; });
  html = html.replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>\s*/gi, () => { removed.push('canonical'); return ''; });
  html = html.replace(/<meta\b[^>]*\bproperty=["']og:(url|image)["'][^>]*>\s*/gi, () => { removed.push('og:url/og:image'); return ''; });
  const cfg = opts.config || {}, gpc = Object.assign({}, cfg.gamepush || {});
  if (process.env.GP_PROJECT_ID) gpc.projectId = process.env.GP_PROJECT_ID;
  if (process.env.GP_PUBLIC_TOKEN) gpc.publicToken = process.env.GP_PUBLIC_TOKEN;
  if (process.env.GP_SAVE_FIELD) gpc.saveField = process.env.GP_SAVE_FIELD;
  const esc = (s) => String(s).replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]));
  const metas = ['<meta name="arcade-platform" content="' + platform + '">'];
  if (aspect) metas.push('<meta name="arcade-aspect" content="' + aspect + '">');
  if (platform === 'gamepush') {
    if (!gpc.projectId || !gpc.publicToken) warnings.push('GamePush: нет ID проекта / публичного токена (--config или GP_PROJECT_ID/GP_PUBLIC_TOKEN) — в сборке плейсхолдеры, SDK не загрузится');
    metas.push('<meta name="gamepush-project-id" content="' + esc(gpc.projectId || 'GP_PROJECT_ID') + '">', '<meta name="gamepush-public-token" content="' + esc(gpc.publicToken || 'GP_PUBLIC_TOKEN') + '">',
      '<meta name="gamepush-save-field" content="' + esc(gpc.saveField || 'arcade_save') + '">');
  }
  if (!/<meta charset="utf-8">/i.test(html)) errors.push('нет <meta charset="utf-8"> — некуда вставить метки площадки');
  html = html.replace(/<meta charset="utf-8">/i, (m) => m + '\n' + metas.join('\n'));
  if (names && names.ru) {
    const t = '<title' + (names.en ? ' data-en="' + esc(names.en) + '"' : '') + '>' + esc(names.ru) + '</title>';
    if (/<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)) html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, t); else html = html.replace(/<\/head>/i, t + '\n</head>');
  } else warnings.push('нет promo/' + slug + '/promo.json (names.ru/en) — <title> оставлен как в игре');
  html = html.replace(/<\/head>/i, PLATFORM_CSS + '\n</head>');
  if (aspect) { if (/<\/body>/i.test(html)) html = html.replace(/<\/body>(?![\s\S]*<\/body>)/i, '<script src="./js/aspect.js"></script>\n</body>'); else html += '\n<script src="./js/aspect.js"></script>\n'; }
  const scripts = (platform === 'yandex' ? '<script src="/sdk.js"></script>\n' : '') + '<script src="./js/platform.js?platform=' + platform + '"></script>\n';
  if (/<script src="\.\/engine\.js"><\/script>/.test(html)) html = html.replace(/<script src="\.\/engine\.js"><\/script>/, scripts + '<script src="./engine.js"></script>');
  fs.writeFileSync(path.join(dst, 'index.html'), html);

  // 4) проверки: внешние URL, пути, размер
  let bytes = 0;
  for (const f of files) {
    const p = path.join(dst, f); bytes += fs.statSync(p).size;
    if (!/^[A-Za-z0-9._\/-]+$/.test(f)) errors.push('путь не латиницей или с пробелом: ' + f);
    if (!TEXT.test(f)) continue;
    const txt = fs.readFileSync(p, 'utf8');
    const urls = [...txt.matchAll(/\bhttps?:\/\/[^\s"'`)<>\\]+/g)].map((m) => m[0]).filter((u) => !ALLOWED_URL.some((re) => re.test(u)));
    if (urls.length) (/\.html?$/i.test(f) ? errors : warnings).push(f + ': внешние адреса ' + [...new Set(urls)].slice(0, 5).join(', '));
    if (/\.html?$/i.test(f) && /\bhref=["']\.\.\//.test(txt)) errors.push(f + ': ссылка за пределы игры (href="../")');
    if (/\bsrc=["']\.\.\//.test(txt)) errors.push(f + ': ресурс за пределами игры (src="../")');
  }
  if (bytes > LIMIT) errors.push('размер ' + (bytes / 1048576).toFixed(1) + ' МБ > 100 МБ');
  // 5) запрещённые слова (Яндекс 1.15; GamePush-площадки модерируют так же) — только для сборок под площадки
  let banned = null;
  if (platform !== 'web') {
    banned = scanBuild(dst);
    if (banned.errors.length) { errors.push('запрещённые слова: ' + banned.errors.length + ' — ' + BANNED_HINT); banned.errors.forEach((e) => errors.push('  слово: ' + e)); }
    banned.warnings.forEach((w) => warnings.push('проверить слово: ' + w));
  }
  let zipBytes = null;
  if (!opts.noZip && !errors.length) {
    try { execFileSync('zip', ['-q', '-r', '-X', zip, '.'], { cwd: dst }); zipBytes = fs.statSync(zip).size; }
    catch (e) { warnings.push('zip не собран (нет утилиты zip?) — заархивируйте папку ' + name + ' сами'); }
  }
  const engVer = (/version: '([\d.]+)'/.exec(fs.readFileSync(path.join(ROOT, '_shared/engine.js'), 'utf8')) || [])[1];
  const pfVer = (/VERSION = '([\d.]+)'/.exec(fs.readFileSync(path.join(ROOT, '_shared/platform.js'), 'utf8')) || [])[1];
  const report = { slug, platform, aspect, names, built: new Date().toISOString(), engine: engVer, platformJs: pfVer, files: files.sort(), bytes, zip: zipBytes != null ? path.basename(zip) : null, zipBytes, removed, warnings, errors, ok: !errors.length };
  fs.writeFileSync(info, JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), pos = [], opts = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--config') { const f = a[++i]; if (!f) usage(); try { opts.config = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { die('не читается конфиг ' + f + ': ' + e.message); } }
    else if (a[i] === '--no-zip') opts.noZip = true;
    else if (a[i] === '--aspect') { opts.aspect = a[++i]; if (!opts.aspect) usage(); }
    else pos.push(a[i]);
  }
  if (pos.length !== 3) usage();
  const r = build(pos[0], pos[1], pos[2], opts);
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.slug} → ${r.platform}${r.aspect ? ' ' + r.aspect : ''}: ${r.files.length} файлов, ${(r.bytes / 1024).toFixed(0)} КБ` + (r.zipBytes != null ? `, zip ${(r.zipBytes / 1024).toFixed(0)} КБ` : '') + (r.removed.length ? ' · убрано: ' + r.removed.join(', ') : ''));
  r.warnings.forEach((w) => console.log('  ! ' + w)); r.errors.forEach((e) => console.log('  ✗ ' + e));
  process.exit(r.ok ? 0 : 1);
}
