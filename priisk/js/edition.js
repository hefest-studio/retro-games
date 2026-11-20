/* ПРИИСК · edition.js — издание сборки: демо (открытый каталог) или полная версия (по образцу МАЯЧНИЦЫ, kvest/js/edition.js).
   PRIISK_EDITION — флаг сборки. 'demo' — скирмиш целиком + кампания: только миссия 1; миссии 2–10 на карте кампании под замком
   «В полной версии», после победы в миссии 1 — экран «Продолжение — в полной версии» (без давления: «На карту кампании»
   и «Узнать больше»). 'full' — полная версия: играбельны все миссии, файлы которых есть в сборке (js/missions/index.js);
   ещё не готовые — заглушка «скоро». Файлы миссий 2+ лежат только в приватном дереве (arcade-full), в публичном репо их нет.
   Параметры страницы (для проверки): ?demo — показать демо-вариант; ?edition=full|demo — явно выбрать издание
   (в публичной сборке ?edition=full ничего не открывает: файлов миссий 2+ в ней нет).
   PRIISK_MORE_URL — куда ведёт «Узнать больше» (заглушка: страница игры появится позже — заменить здесь одной строкой).
   Издание «для площадок» ('platform': без «демо», остальное — покупкой внутри площадки) — приватный файл
   arcade-full/platform/priisk/js/edition.js с тем же API (+ хуки attach/canBuy/buy/price/owned), см. README arcade-full. */
(function (global) {
  'use strict';
  var P = global.PRIISK = global.PRIISK || {};
  var PRIISK_EDITION = 'demo';         // 'demo' | 'full' — флаг сборки (каталог arcade — демо; закрытый деплой — full)
  var PRIISK_MORE_URL = '../';         // заглушка: страница игры (пока — каталог)

  function resolve(search, build) {
    search = String(search || ''); build = build === 'full' ? 'full' : 'demo';
    var m = /[?&]edition=(demo|full)\b/.exec(search);
    if (m) return m[1];
    if (/[?&]demo\b/.test(search)) return 'demo';
    return build;
  }
  // миссия играбельна в издании? (демо — только список demo из реестра js/missions/index.js)
  function playable(edition, id) {
    if (edition === 'full') return true;
    var files = P.MISSION_FILES; return !!(files && files.demo.indexOf(id) >= 0);
  }
  // заглушка неготовой/закрытой миссии на карте кампании: 'full' — «В полной версии» (замок), 'soon' — «скоро»
  function stub(edition) { return edition === 'full' ? 'soon' : 'full'; }
  // что делать после победы: 'next' — брифинг следующей; 'demo' — экран «Продолжение — в полной версии»; 'map' — на карту
  function afterWin(edition, hasNext, hasMore) {
    if (hasNext) return 'next';
    return edition === 'demo' && hasMore ? 'demo' : 'map';
  }
  // экран издания: что показать и какие кнопки (ключи строк i18n)
  function finale(edition) {
    if (edition === 'full') return { kind: 'soon', title: 'soonTitle', sub: 'soonSub', items: ['toMap'] };
    return { kind: 'demo', title: 'demoTitle', sub: 'demoSub', items: ['toMap', 'more'] };
  }
  var search = global.location && global.location.search;
  P.Edition = { BUILD: PRIISK_EDITION, MORE_URL: PRIISK_MORE_URL, resolve: resolve, playable: playable, stub: stub, afterWin: afterWin, finale: finale };
  P.EDITION = resolve(search, PRIISK_EDITION);
})(typeof window !== 'undefined' ? window : globalThis);
