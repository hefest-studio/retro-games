/* ПОДРЯД · мета-прогрессия (DOM-free, тестируется в Node). PODRYAD.meta — звёзды заданий поверх кампании с ангаром
   - Кампания (9 заданий, ангар, сохранение arcade.podryad.save) — основная прогрессия; звёзды — повод перепройти кампанию лучше.
   - Звёзды за задание (3 условия): ★ выполнено; ★ ни разу не сбит (в т. ч. без «ещё одного шанса»); ★ броня на финише ≥ 60.
   - Хранение: ключ на задание arcade.podryad.stars.N = лучшие звёзды (0–3), облако площадки сливает их режимом 'max' (g.persist).
     Хранилище — { get(k) → строка|null, set(k, v) }. */
(function (global) {
  'use strict';
  var NS = global.PODRYAD = global.PODRYAD || {};
  var LEVELS = 9, PREFIX = 'arcade.podryad.stars.', ARMOR_STAR = 60;

  // rec = result() задания { ok, revived, armor } → { n, c:[выполнено, не сбит, броня ≥ 60] }
  function stars(rec) {
    if (!rec.ok) return { n: 0, c: [false, false, false] };
    var c = [true, (rec.revived | 0) === 0, (rec.armor || 0) >= ARMOR_STAR];
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
  NS.meta = { LEVELS: LEVELS, ARMOR_STAR: ARMOR_STAR, PREFIX: PREFIX, key: key, stars: stars, starStr: starStr, Progress: Progress };
})(typeof window !== 'undefined' ? window : globalThis);
