/* КАМЕРТОН · мета-прогрессия между партиями (DOM-free, тестируется в Node). VOLOK.meta
   - Выбор зоны для «Нового пути»: открыта 1-я и каждая, до которой игрок уже доходил (в т. ч. пропуском за рекламу) или перед которой
     пройдена предыдущая; путь с выбранной зоны начинается у её первого фонарика.
   - Звёзды за зону (3 условия): ★ пройти зону; ★ не больше 2 остановок завода в зоне; ★ без остановок. Пропуск зоны звёзд не даёт.
   - Хранение: arcade.kamerton.stars.N = лучшие звёзды (0–3), arcade.kamerton.stars.reach = дальняя зона; облако сливает 'max' (g.persist).
     Хранилище — { get(k) → строка|null, set(k, v) }. */
(function (global) {
  'use strict';
  var NS = global.KAMER = global.KAMER || {};
  var LEVELS = 6, PREFIX = 'arcade.kamerton.stars.';

  // rec = { stops } за зону → { n, c:[прошли, ≤ 2 остановок, без остановок] }
  function stars(rec) {
    var c = [true, (rec.stops | 0) <= 2, (rec.stops | 0) === 0];
    return { n: c.filter(Boolean).length, c: c };
  }
  function key(level) { return PREFIX + level; }
  function starStr(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }

  function Progress(store) {
    function get(level) { var v = parseInt(store.get(key(level)), 10); return v > 0 ? Math.min(3, v) : 0; }
    var api = {
      get: get,
      record: function (level, n) { if (level < 1 || level > LEVELS) return false; n = Math.max(0, Math.min(3, n | 0)); if (n <= get(level)) return false; store.set(key(level), String(n)); return true; },
      reach: function () { var v = parseInt(store.get(PREFIX + 'reach'), 10); return v > 0 ? Math.min(LEVELS, v) : 1; },
      reached: function (level) { if (level > api.reach() && level <= LEVELS) { store.set(PREFIX + 'reach', String(level)); return true; } return false; },
      unlocked: function (level) { return level === 1 || (level > 1 && level <= LEVELS && (get(level - 1) > 0 || api.reach() >= level)); },
      maxUnlocked: function () { var m = 1; for (var l = 2; l <= LEVELS; l++) if (api.unlocked(l)) m = l; else break; return m; },
      total: function () { var s = 0; for (var l = 1; l <= LEVELS; l++) s += get(l); return s; },
      next: function (cur, dir) { var m = api.maxUnlocked(), n = (cur | 0) + (dir || 1); if (n > m) n = 1; if (n < 1) n = m; return n; }
    };
    return api;
  }
  NS.meta = { LEVELS: LEVELS, PREFIX: PREFIX, REACH: PREFIX + 'reach', key: key, stars: stars, starStr: starStr, Progress: Progress };
})(typeof window !== 'undefined' ? window : globalThis);
