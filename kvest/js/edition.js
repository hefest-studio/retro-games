/* МАЯЧНИЦА · edition.js — издание сборки: демо (открытый каталог) или полная версия.
   KVEST_EDITION — флаг сборки. 'demo' — глава 1 целиком, после финала экран «Продолжение — в полной версии» (без давления:
   «Вернуться в меню» и «Узнать больше»). 'full' — полная версия: экрана демо нет; после главы — «Глава N+1» (если она есть в сборке), иначе «Глава N+1 — скоро»;
   после последней главы — титры и «Конец».
   Параметры страницы (для проверки): ?demo — показать демо-вариант; ?edition=full|demo — явно выбрать издание.
   KVEST_MORE_URL — куда ведёт «Узнать больше» (заглушка: страница игры появится позже — заменить здесь одной строкой).
   Издание «для площадок» ('platform': без «демо», остальное — покупкой внутри площадки) — приватный файл
   arcade-full/platform/kvest/js/edition.js с тем же API (+ хуки attach/canBuy/buy/price/owned), см. README arcade-full. */
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
  // экран после финала главы: что показать и какие кнопки (ключи строк i18n).
  // next — следующая глава в этой сборке (полная версия): «Глава N» + меню; нет следующей — «Глава N — скоро» (n — её номер)
  // last — это последняя глава игры (номер = числу глав): «Конец», без «скоро»; перед этим экраном оболочка показывает титры
  function finale(edition, next, n, last) {
    if (edition === 'full' && next) return { kind: 'next', title: 'nextTitle', sub: 'nextSub', items: ['next', 'toMenu'], n: next.n };
    if (edition === 'full' && last) return { kind: 'end', title: 'endTitle', sub: 'endSub', items: ['toMenu', 'credits'], n: n };
    if (edition === 'full') return { kind: 'soon', title: 'soonTitle', sub: 'soonSub', items: ['toMenu'], n: (n || 1) + 1 };
    return { kind: 'demo', title: 'demoTitle', sub: 'demoSub', items: ['toMenu', 'more'] };
  }
  // «Узнать больше» — одно действие: переход по ссылке в той же вкладке (без window.open: с 'noopener' он всегда
  // возвращает null, и раньше открывалась новая вкладка И текущая уходила по ссылке)
  function goMore(loc) { if (loc) loc.href = KVEST_MORE_URL; return KVEST_MORE_URL; }
  var search = global.location && global.location.search;
  K.Edition = { BUILD: KVEST_EDITION, MORE_URL: KVEST_MORE_URL, resolve: resolve, finale: finale, goMore: goMore };
  K.EDITION = resolve(search, KVEST_EDITION);
})(typeof window !== 'undefined' ? window : globalThis);
