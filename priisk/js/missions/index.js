/* ПРИИСК · js/missions/index.js — реестр файлов миссий кампании. Подключается после campaign.js и до campaign-ui.js.
   demo — файлы публичного дерева (репо retro-games, открытый каталог). full — файлы, которые есть ТОЛЬКО в полной сборке:
   их кладёт поверх публичной игры приватный репозиторий (arcade-full, см. его README и build.sh). Ядро (campaign.js,
   campaign-ui.js, main.js) про конкретные миссии не знает: миссия сама регистрируется через PRIISK.campaign.register().
   Новая миссия полной версии = файл в arcade-full/priisk/js/missions/ + её id в списке full ниже.
   Загрузка: в браузере — синхронно (document.write во время разбора страницы, порядок сохраняется); файлы full грузятся только
   в сборке с флагом 'full' (PRIISK.Edition.BUILD), поэтому публичная страница их не запрашивает. Если файла нет (404),
   миссия просто не регистрируется и на карте остаётся заглушкой — игра не ломается. В node (тесты) — только список. */
(function (root) {
  'use strict';
  var P = root.PRIISK = root.PRIISK || {};
  // s1–s9 — кампания Артели Сизого Перевала «Долг перевала» (только полная версия); e1 — эпилог обеих кампаний (camp 'both':
  // открывается, когда пройдены финалы обеих и выбор в них совместим; на карте — отметка). Новая миссия = файл в arcade-full + id здесь
  var FILES = P.MISSION_FILES = { demo: ['m1'], full: ['m2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 'e1'] };
  // 'platform' — издание «для площадок» (arcade-full/platform): грузит все файлы, доступ к миссиям решает js/edition.js (покупка)
  P.missionFiles = function (build) { return build === 'full' || build === 'platform' ? FILES.demo.concat(FILES.full) : FILES.demo.slice(); };
  P.missionMissing = [];
  P.onMissionError = function (id) { P.missionMissing.push(id); if (root.console) console.warn('ПРИИСК: нет файла миссии ' + id + ' — на карте узел без миссии'); };
  var doc = root.document;
  if (!doc || !doc.write || doc.readyState !== 'loading') return;
  var build = P.Edition && P.Edition.BUILD;   // нет издания — как публичная сборка (только FILES.demo)
  P.missionFiles(build).forEach(function (id) {
    if (!/^[a-z0-9-]+$/.test(id)) return;
    doc.write('<script src="./js/missions/' + id + '.js" onerror="PRIISK.onMissionError(\'' + id + '\')"><\/script>');
  });
})(typeof window !== 'undefined' ? window : globalThis);
