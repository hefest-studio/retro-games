#!/usr/bin/env node
/**
 * add-catalog-back.mjs — встраивает в страницы игр ссылку «← Каталог».
 *
 * Каждая игра — самодостаточный HTML, поэтому ссылка добавляется инлайном
 * (без внешних файлов): небольшая вертикальная плашка у левого края экрана.
 * Плашка не перекрывает HUD/логотипы/кнопки игр и работает как с http(s),
 * так и с file:// (там ведёт на ../index.html, чтобы браузер не показывал
 * листинг каталога).
 *
 * Скрипт идемпотентен: повторный запуск ничего не дублирует.
 *
 * Использование:
 *   node tools/add-catalog-back.mjs            # все игры
 *   node tools/add-catalog-back.mjs contra ... # только указанные
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DEFAULT_GAMES = [
  'boulder-dash', 'contra', 'digger', 'double-dragon-battletoads', 'exolon',
  'lode-runner', 'lost-vikings', 'lost-vikings-2', 'river-raid', 'silkworm',
  'the-last-mission',
];
const MARKER = 'data-catalog-back="1"';

const SNIPPET = `<!-- catalog-backlink: ссылка на стартовую страницу проекта (встроена tools/add-catalog-back.mjs) -->
<style>
#catalog-back{position:fixed!important;left:0!important;top:50%!important;transform:translateY(-50%)!important;z-index:2147483647!important;display:inline-flex!important;align-items:center!important;gap:6px!important;padding:8px 12px 8px 9px!important;margin:0!important;background:rgba(6,8,14,.82)!important;color:#ffd27a!important;border:1px solid rgba(255,190,80,.6)!important;border-left:0!important;border-radius:0 10px 10px 0!important;font:600 11px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;letter-spacing:.1em!important;text-transform:uppercase!important;text-decoration:none!important;box-shadow:0 6px 22px rgba(0,0,0,.45)!important;cursor:pointer!important;opacity:.82!important;transition:opacity .15s ease,background .15s ease,color .15s ease!important;-webkit-font-smoothing:antialiased!important;}
#catalog-back:hover,#catalog-back:focus-visible{opacity:1!important;background:rgba(255,190,80,.94)!important;color:#0a0b10!important;outline:2px solid #7cf5d2!important;outline-offset:2px!important;}
#catalog-back .catalog-back-arrow{font-size:13px!important;line-height:1!important;}
@media (max-width:480px){#catalog-back{font-size:10px!important;padding:6px 9px 6px 7px!important;gap:4px!important;}}
@media (prefers-reduced-motion:reduce){#catalog-back{transition:none!important;}}
</style>
<a id="catalog-back" href="../" title="На стартовую страницу проекта — в каталог игр" aria-label="Вернуться на стартовую страницу проекта — каталог игр" ${MARKER}><span class="catalog-back-arrow" aria-hidden="true">&larr;</span>Каталог</a>
<script>
(function () {
  var link = document.getElementById('catalog-back');
  if (!link) return;
  /* На file:// каталог лежит в index.html корня: «../» открыл бы листинг. */
  if (location.protocol === 'file:') link.setAttribute('href', '../index.html');
  /* Не даём клику/Enter всплывать в игровые обработчики (старт, пауза и т.п.). */
  ['pointerdown', 'click', 'keydown'].forEach(function (type) {
    link.addEventListener(type, function (event) { event.stopPropagation(); }, true);
  });
})();
</script>
<!-- /catalog-backlink -->`;

function targets(args) {
  const names = args.length ? args : DEFAULT_GAMES;
  const files = [];
  for (const name of names) {
    const file = resolve(ROOT, name, 'index.html');
    if (!existsSync(file)) {
      console.warn(`! пропуск: нет ${file}`);
      continue;
    }
    files.push({ name, file });
  }
  /* Альтернативная одностраничная сборка Lode Runner. */
  if (!args.length) {
    const standalone = resolve(ROOT, 'lode-runner', 'lode-runner.html');
    if (existsSync(standalone)) files.push({ name: 'lode-runner (standalone)', file: standalone });
  }
  return files;
}

let changed = 0;
for (const { name, file } of targets(process.argv.slice(2))) {
  const html = readFileSync(file, 'utf8');
  if (html.includes(MARKER)) {
    console.log(`= ${name}: ссылка уже есть`);
    continue;
  }
  const close = html.toLowerCase().lastIndexOf('</body>');
  if (close === -1) {
    console.warn(`! ${name}: не найден </body>, пропуск`);
    continue;
  }
  const next = `${html.slice(0, close)}${SNIPPET}\n${html.slice(close)}`;
  writeFileSync(file, next);
  changed += 1;
  console.log(`+ ${name}: ссылка добавлена`);
}
console.log(`\nИзменено файлов: ${changed}`);
