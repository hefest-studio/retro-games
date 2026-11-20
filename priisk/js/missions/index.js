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
  // s1–s5 — кампания Артели Сизого Перевала «Долг перевала» (только полная версия); s6–s9 — ещё в работе (файлов нет, на карте —
  // заготовки-карточки «в работе» из campaign-ui.js; новая миссия = файл в arcade-full + её id здесь)
  var FILES = P.MISSION_FILES = { demo: ['m1'], full: ['m2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 's1', 's2', 's3', 's4', 's5'] };
  P.missionFiles = function (build) { return build === 'full' ? FILES.demo.concat(FILES.full) : FILES.demo.slice(); };
  P.missionMissing = [];
  P.onMissionError = function (id) { P.missionMissing.push(id); if (root.console) console.warn('ПРИИСК: нет файла миссии ' + id + ' — заглушка на карте'); };
  var doc = root.document;
  if (!doc || !doc.write || doc.readyState !== 'loading') return;
  var build = P.Edition ? P.Edition.BUILD : 'demo';
  P.missionFiles(build).forEach(function (id) {
    if (!/^[a-z0-9-]+$/.test(id)) return;
    doc.write('<script src="./js/missions/' + id + '.js" onerror="PRIISK.onMissionError(\'' + id + '\')"><\/script>');
  });
})(typeof window !== 'undefined' ? window : globalThis);
