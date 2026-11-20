/* ПОРУБЕЖЬЕ · js/missions/index.js — реестр миссий кампаний. В публичном дереве (демо) миссий нет: только скирмиш.
   full — файлы миссий, которые есть ТОЛЬКО в полной сборке (их кладёт поверх приватный репозиторий arcade-full,
   см. его README и build.sh). Миссия — файл js/missions/<id>.js, который вызывает PORUB.registerMission({ id, n, race, … }).
   Новая миссия полной версии = файл в arcade-full/porubezhye/js/missions/ + её id в списке full ниже; ядро не меняется.
   Загрузка: в браузере — синхронно (document.write при разборе страницы); файлы full грузятся только в сборке с флагом 'full'.
   Нет файла (404) — миссия не регистрируется, игра работает как прежде. В node (тесты) — только список. */
(function (root) {
  'use strict';
  var P = root.PORUB = root.PORUB || {};
  // r1–r3 — «Острог на краю» (Мастеровые), миссии 1–3; w-plan — заготовки миссий 4–7 («в работе»). Всё — только в полной сборке.
  var FILES = P.MISSION_FILES = { demo: [], full: ['r1', 'r2', 'r3', 'w-plan'] };
  P.MISSIONS = P.MISSIONS || [];
  P.registerMission = function (def) {
    for (var i = 0; i < P.MISSIONS.length; i++) if (P.MISSIONS[i].id === def.id) { P.MISSIONS[i] = def; return def; }
    P.MISSIONS.push(def); P.MISSIONS.sort(function (a, b) { return (a.n || 0) - (b.n || 0); }); return def;
  };
  // 'platform' — издание «для площадок» (arcade-full/platform): грузит все файлы, доступ решает js/edition.js (покупка);
  // пока издание не продаёт кампанию (Edition.missionsForSale === false) — файлы кампании не грузятся, пункта «Кампания» нет
  P.missionFiles = function (build) {
    if (build === 'platform' && P.Edition && P.Edition.missionsForSale === false) return FILES.demo.slice();
    return build === 'full' || build === 'platform' ? FILES.demo.concat(FILES.full) : FILES.demo.slice();
  };
  P.missionMissing = [];
  P.onMissionError = function (id) { P.missionMissing.push(id); if (root.console) console.warn('ПОРУБЕЖЬЕ: нет файла миссии ' + id); };
  var doc = root.document;
  if (!doc || !doc.write || doc.readyState !== 'loading') return;
  P.missionFiles(P.Edition && P.Edition.BUILD).forEach(function (id) {
    if (!/^[a-z0-9-]+$/.test(id)) return;
    doc.write('<script src="./js/missions/' + id + '.js" onerror="PORUB.onMissionError(\'' + id + '\')"><\/script>');
  });
})(typeof window !== 'undefined' ? window : globalThis);
