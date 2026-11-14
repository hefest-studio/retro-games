/* МАЯЧНИЦА · edition.js — издание сборки: демо (открытый каталог) или полная версия.
   KVEST_EDITION — флаг сборки. 'demo' — глава 1 целиком, после финала экран «Продолжение — в полной версии» (без давления:
   «Вернуться в меню» и «Узнать больше»). 'full' — полная версия: экрана демо нет; пока глав дальше нет — заглушка «Глава 2 — скоро».
   Параметры страницы (для проверки): ?demo — показать демо-вариант; ?edition=full|demo — явно выбрать издание.
   KVEST_MORE_URL — куда ведёт «Узнать больше» (заглушка: страница игры появится позже — заменить здесь одной строкой). */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  var KVEST_EDITION = 'demo';          // 'demo' | 'full' — флаг сборки (каталог arcade — демо; закрытый деплой — full)
  var KVEST_MORE_URL = '../';          // заглушка: страница игры (пока — каталог)

  function resolve(search, build) {
    search = String(search || ''); build = build === 'full' ? 'full' : 'demo';
    var m = /[?&]edition=(demo|full)\b/.exec(search);
    if (m) return m[1];
    if (/[?&]demo\b/.test(search)) return 'demo';
    return build;
  }
  // экран после финала главы: что показать и какие кнопки (ключи строк i18n)
  function finale(edition) {
    if (edition === 'full') return { kind: 'soon', title: 'soonTitle', sub: 'soonSub', items: ['toMenu'] };
    return { kind: 'demo', title: 'demoTitle', sub: 'demoSub', items: ['toMenu', 'more'] };
  }
  var search = global.location && global.location.search;
  K.Edition = { BUILD: KVEST_EDITION, MORE_URL: KVEST_MORE_URL, resolve: resolve, finale: finale };
  K.EDITION = resolve(search, KVEST_EDITION);
})(typeof window !== 'undefined' ? window : globalThis);
