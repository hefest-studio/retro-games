/* ОТГОН · мета-прогрессия между партиями (DOM-free, тестируется в Node). OTGON.meta
   - Выбор участка для «Нового пути»: открыт 1-й и каждый, перед которым пройден предыдущий (путь с этого участка — со всем стадом).
   - Звёзды за участок (3 условия): ★ дойти до костра; ★ без потерь на участке; ★ всё стадо цело к концу участка.
   - Хранение: ключ на участок arcade.otgon.stars.N = лучшие звёзды (0–3), облако площадки сливает их режимом 'max' (g.persist).
     Хранилище — { get(k) → строка|null, set(k, v) }. */
(function (global) {
  'use strict';
  var NS = global.OTGON = global.OTGON || {};
  var LEVELS = 6, PREFIX = 'arcade.otgon.stars.';

  // rec = { lost, alive, total } за участок → { n, c:[дошли, без потерь на участке, всё стадо цело] }
  function stars(rec) {
    var c = [true, (rec.lost | 0) === 0, (rec.alive | 0) >= (rec.total | 0)];
    return { n: c.filter(Boolean).length, c: c };
  }
  function key(level) { return PREFIX + level; }
  function starStr(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }

  function Progress(store) {
    function get(level) { var v = parseInt(store.get(key(level)), 10); return v > 0 ? Math.min(3, v) : 0; }
    var api = {
      get: get,
      record: function (level, n) { if (level < 1 || level > LEVELS) return false; n = Math.max(0, Math.min(3, n | 0)); if (n <= get(level)) return false; store.set(key(level), String(n)); return true; },
      unlocked: function (level) { return level === 1 || (level > 1 && level <= LEVELS && get(level - 1) > 0); },
      maxUnlocked: function () { var m = 1; for (var l = 2; l <= LEVELS; l++) if (api.unlocked(l)) m = l; else break; return m; },
      total: function () { var s = 0; for (var l = 1; l <= LEVELS; l++) s += get(l); return s; },
      next: function (cur, dir) { var m = api.maxUnlocked(), n = (cur | 0) + (dir || 1); if (n > m) n = 1; if (n < 1) n = m; return n; }
    };
    return api;
  }
  NS.meta = { LEVELS: LEVELS, PREFIX: PREFIX, key: key, stars: stars, starStr: starStr, Progress: Progress };
})(typeof window !== 'undefined' ? window : globalThis);
