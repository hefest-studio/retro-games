/* ПОРУБЕЖЬЕ · edition.js — издание сборки: демо (открытый каталог) или полная версия (по образцу МАЯЧНИЦЫ, kvest/js/edition.js).
   PORUB_EDITION — флаг сборки. 'demo' — скирмиш за обе расы целиком; пункт меню «Кампания» виден с пометкой «в полной версии»
   и ведёт на экран «Кампания — в полной версии» (без давления: «Вернуться в меню» и «Узнать больше»).
   'full' — полная версия: кампании подключаются через реестр js/missions/index.js; пока миссий нет — экран «Кампания — скоро».
   Параметры страницы (для проверки): ?demo — показать демо-вариант; ?edition=full|demo — явно выбрать издание.
   PORUB_MORE_URL — куда ведёт «Узнать больше» (заглушка: страница игры появится позже — заменить здесь одной строкой).
   Издание «для площадок» ('platform': без «демо», остальное — покупкой внутри площадки) — приватный файл
   arcade-full/platform/porubezhye/js/edition.js с тем же API (+ хуки attach/canBuy/buy/price/owned), см. README arcade-full. */
(function (global) {
  'use strict';
  var P = global.PORUB = global.PORUB || {};
  var PORUB_EDITION = 'demo';          // 'demo' | 'full' — флаг сборки (каталог arcade — демо; закрытый деплой — full)
  var PORUB_MORE_URL = '../';          // заглушка: страница игры (пока — каталог)

  function resolve(search, build) {
    search = String(search || ''); build = build === 'full' ? 'full' : 'demo';
    var m = /[?&]edition=(demo|full)\b/.exec(search);
    if (m) return m[1];
    if (/[?&]demo\b/.test(search)) return 'demo';
    return build;
  }
  // пункт «Кампания»: пометка в меню (ключ строки) — demo: «в полной версии»; full без миссий: «скоро»; full с миссиями — без пометки
  function campTag(edition, missions) { return edition === 'full' ? (missions > 0 ? null : 'campSoon') : 'campFull'; }
  // экран кампании: что показать и какие кнопки (ключи строк i18n)
  function finale(edition) {
    if (edition === 'full') return { kind: 'soon', title: 'soonTitle', sub: 'soonSub', items: ['toMenu'] };
    return { kind: 'demo', title: 'demoTitle', sub: 'demoSub', items: ['toMenu', 'more'] };
  }
  var search = global.location && global.location.search;
  P.Edition = { BUILD: PORUB_EDITION, MORE_URL: PORUB_MORE_URL, resolve: resolve, campTag: campTag, finale: finale };
  P.EDITION = resolve(search, PORUB_EDITION);
})(typeof window !== 'undefined' ? window : globalThis);
