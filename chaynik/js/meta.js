/* ЧАЙНИК · мета-прогрессия между партиями (DOM-free, тестируется в Node). CHAYNIK.meta
   - Выбор уровня: открыт 1-й и каждый, перед которым пройден предыдущий (в любой партии).
   - Звёзды (3 условия): ★ уровень пройден; ★ без потерь на нём; ★ быстрее нормы PAR (с).
   - Хранение: по ключу на уровня arcade.chaynik.stars.N = лучшие звёзды (0–3) — числа, облако площадки сливает их
     режимом 'max' (g.persist), прогресс с двух устройств не теряется. Хранилище — { get(k) → строка|null, set(k, v) }. */
(function (global) {
  'use strict';
  var NS = global.CHAYNIK = global.CHAYNIK || {};
  var LEVELS = 6, PREFIX = 'arcade.chaynik.stars.';
  var PAR = [150, 40, 120, 90, 100, 150];   // норма времени 1…N, с

  // rec = { level, time, lost } → { n, c:[пройден, без потерь, быстро] }
  function stars(rec) {
    var c = [true, (rec.lost | 0) === 0, rec.time <= PAR[Math.max(0, Math.min(LEVELS, rec.level | 0) - 1)]];
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
  NS.meta = { LEVELS: LEVELS, PAR: PAR, PREFIX: PREFIX, key: key, stars: stars, starStr: starStr, Progress: Progress };
})(typeof window !== 'undefined' ? window : globalThis);
