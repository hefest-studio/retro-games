#!/usr/bin/env node
/**
 * add-catalog-back.mjs — встраивает в страницы игр ссылку «← Каталог».
 *
 * Каждая игра — самодостаточный HTML, поэтому ссылка добавляется инлайном
 * (без внешних файлов): компактная плашка, которая возвращает на стартовую
 * страницу проекта и работает как с http(s), так и с file:// (там ведёт на
 * ../index.html, чтобы браузер не показывал листинг каталога).
 *
 * Плашка адаптивная: скрипт проверяет интерактивные элементы страницы
 * (кнопки, ссылки, поля, role=button) и выбирает свободное место — левый центр,
 * затем углы/края, — чтобы не перекрывать меню и HUD игр. Позиция пересчитывается
 * при resize/orientationchange и ещё пару раз после загрузки (меню игр строятся
 * асинхронно).
 *
 * Скрипт идемпотентен: повторный запуск заменяет ранее вставленный блок.
 *
 * После перехода на движок v2 ссылку в index.html даёт сам движок, поэтому скрипт
 * обслуживает только старые страницы игр — <slug>/legacy.html (если она есть).
 *
 * Использование:
 *   node tools/add-catalog-back.mjs            # обновить блок во всех legacy.html, где он уже есть
 *   node tools/add-catalog-back.mjs saga ...   # только указанные
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DEFAULT_GAMES = JSON.parse(readFileSync(resolve(ROOT, 'assets/catalog/games.json'), 'utf8'))
  .games.map((g) => g.slug);
const MARKER = 'data-catalog-back="1"';
const START_COMMENT = '<!-- catalog-backlink:'; // начало вставленного блока
const END_COMMENT = '<!-- /catalog-backlink -->';

const SNIPPET = `<!-- catalog-backlink: ссылка на стартовую страницу проекта (встроена tools/add-catalog-back.mjs) -->
<style>
#catalog-back{position:fixed!important;left:0!important;top:50%!important;transform:translateY(-50%)!important;z-index:2147483647!important;display:inline-flex!important;align-items:center!important;gap:6px!important;padding:8px 12px 8px 9px!important;margin:0!important;background:rgba(6,8,14,.82)!important;color:#ffd27a!important;border:1px solid rgba(255,190,80,.6)!important;border-left:0!important;border-radius:0 10px 10px 0!important;font:600 11px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;letter-spacing:.1em!important;text-transform:uppercase!important;text-decoration:none!important;box-shadow:0 6px 22px rgba(0,0,0,.45)!important;cursor:pointer!important;opacity:.82!important;transition:opacity .15s ease,background .15s ease,color .15s ease!important;-webkit-font-smoothing:antialiased!important;}
#catalog-back.catalog-back-round{border-left:1px solid rgba(255,190,80,.6)!important;border-radius:10px!important;}
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

  /* --- адаптивное размещение, чтобы не перекрывать меню и кнопки игр --- */
  var INTERACTIVE = 'a,button,input,select,textarea,[role="button"],[tabindex],[onclick]';
  link.style.setProperty('transform', 'none', 'important');

  function interactiveBoxes() {
    var boxes = [];
    var nodes = document.querySelectorAll(INTERACTIVE);
    for (var i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      if (el === link || el.contains(link)) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      var cs = window.getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) continue;
      if (cs.pointerEvents === 'none') continue;
      boxes.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    }
    return boxes;
  }

  function overlap(a, b) {
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  }

  function place() {
    var w = link.offsetWidth;
    var h = link.offsetHeight;
    if (!w || !h) return;
    var W = window.innerWidth;
    var H = window.innerHeight;
    var m = 10;
    var candidates = [
      { name: 'left-mid', left: 0, top: Math.round((H - h) / 2), shape: 'tab' },
      { name: 'bottom-left', left: m, top: H - h - m, shape: 'round' },
      { name: 'top-left', left: m, top: m, shape: 'round' },
      { name: 'bottom-right', left: W - w - m, top: H - h - m, shape: 'round' },
      { name: 'top-right', left: W - w - m, top: m, shape: 'round' },
      { name: 'bottom-center', left: Math.round((W - w) / 2), top: H - h - m, shape: 'round' },
      { name: 'top-center', left: Math.round((W - w) / 2), top: m, shape: 'round' }
    ];
    var boxes = interactiveBoxes();
    var chosen = candidates[0];
    for (var i = 0; i < candidates.length; i += 1) {
      var c = candidates[i];
      var box = { left: c.left, top: c.top, right: c.left + w, bottom: c.top + h };
      var hit = false;
      for (var j = 0; j < boxes.length; j += 1) {
        if (overlap(box, boxes[j])) { hit = true; break; }
      }
      if (!hit) { chosen = c; break; }
    }
    link.style.setProperty('left', chosen.left + 'px', 'important');
    link.style.setProperty('top', chosen.top + 'px', 'important');
    link.classList.toggle('catalog-back-round', chosen.shape === 'round');
    link.dataset.place = chosen.name;
  }

  var timer = 0;
  function schedule() {
    window.clearTimeout(timer);
    timer = window.setTimeout(place, 120);
  }

  place();
  window.setTimeout(place, 350);
  window.setTimeout(place, 1200);
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', schedule, { passive: true });
  document.addEventListener('fullscreenchange', schedule);
})();
</script>
<!-- /catalog-backlink -->`;

function targets(args) {
  const names = args.length ? args : DEFAULT_GAMES;
  const files = [];
  for (const name of names) {
    const file = resolve(ROOT, name, 'legacy.html');
    if (!existsSync(file)) {
      if (args.length) console.warn(`! пропуск: нет ${file}`);
      continue;
    }
    /* Без аргументов — только обновляем уже вставленные блоки, новых не добавляем. */
    if (!args.length && !readFileSync(file, 'utf8').includes(START_COMMENT)) continue;
    files.push({ name, file });
  }
  return files;
}

let changed = 0;
for (const { name, file } of targets(process.argv.slice(2))) {
  const html = readFileSync(file, 'utf8');
  const start = html.indexOf(START_COMMENT);
  const end = html.indexOf(END_COMMENT);
  if (start !== -1 && end > start) {
    /* Обновляем ранее вставленный блок (idempotent update). */
    const next = `${html.slice(0, start)}${SNIPPET}${html.slice(end + END_COMMENT.length)}`;
    if (next === html) {
      console.log(`= ${name}: без изменений`);
    } else {
      writeFileSync(file, next);
      changed += 1;
      console.log(`~ ${name}: блок обновлён`);
    }
    continue;
  }
  if (html.includes(MARKER)) {
    console.warn(`! ${name}: маркер есть, но границы блока не найдены — пропуск`);
    continue;
  }
  const close = html.toLowerCase().lastIndexOf('</body>');
  if (close === -1) {
    console.warn(`! ${name}: не найден </body>, пропуск`);
    continue;
  }
  writeFileSync(file, `${html.slice(0, close)}${SNIPPET}\n${html.slice(close)}`);
  changed += 1;
  console.log(`+ ${name}: ссылка добавлена`);
}
console.log(`\nИзменено файлов: ${changed}`);
