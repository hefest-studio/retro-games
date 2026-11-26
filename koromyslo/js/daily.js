/* КОРОМЫСЛО · вызов дня (без DOM, тестируется в Node). KOROMYSLO.daily — схема хранения как в КАСКАДе (общий приём студии)
   - День (YYYYMMDD): есть серверное время площадки (Platform.serverTime() не null) — день по UTC+3, единый для всех игроков
     (как g.daily() движка v2.7); нет — местная дата по часам устройства. Сид = хеш даты (mulberry32): последовательность гирек и окалины
     дня одинакова у всех; обучения в вызове нет.
   - Рекорд дня и серия дней хранятся ОДНИМ числом, чтобы облако площадки сливало их режимом 'max' (g.persist):
     рекорд = YYYYMMDD·1e7 + очки (более поздний день всегда больше; в тот же день — больший счёт);
     серия  = YYYYMMDD·1e3 + дней подряд. Хранилище — { get(k) → строка|null, set(k, v) }. */
(function (global) {
  'use strict';
  var K = global.KOROMYSLO = global.KOROMYSLO || {};
  var KEY_BEST = 'arcade.koromyslo.daily', KEY_STREAK = 'arcade.koromyslo.streak', MAXS = 9999999;

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // tz — часовой пояс в часах (день по UTC+tz); без tz — местная дата устройства
  function dateKey(ts, tz) {
    if (tz != null) { var u = new Date(ts + tz * 3600000); return u.getUTCFullYear() * 10000 + (u.getUTCMonth() + 1) * 100 + u.getUTCDate(); }
    var d = new Date(ts); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  function prevDay(key) { var d = new Date(Math.floor(key / 10000), Math.floor(key / 100) % 100 - 1, key % 100 - 1, 12); return dateKey(+d); }
  function seed(key) { var h = 2166136261 >>> 0, s = 'koromyslo-daily-' + key; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function label(key) { var d = key % 100, m = Math.floor(key / 100) % 100; return (d < 10 ? '0' : '') + d + '.' + (m < 10 ? '0' : '') + m; }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  // Состояние испытания на день key поверх хранилища store.
  function Daily(store, key) {
    function rec() { var v = num(store.get(KEY_BEST)); return { key: Math.floor(v / 1e7), score: v % 1e7 }; }
    function st() { var v = num(store.get(KEY_STREAK)); return { key: Math.floor(v / 1e3), n: v % 1e3 }; }
    return {
      key: key, label: label(key),
      rng: function () { return mulberry32(seed(key)); },
      best: function () { var r = rec(); return r.key === key ? r.score : 0; },
      // итог партии испытания: обновляет рекорд дня и серию; → { best, isNew, streak }
      submit: function (score) {
        score = Math.max(0, Math.min(MAXS, Math.floor(score || 0)));
        var r = rec(), isNew = false;
        if (r.key < key || (r.key === key && score > r.score)) { store.set(KEY_BEST, String(key * 1e7 + score)); isNew = score > 0 || r.key < key; }
        var s = st();
        if (s.key !== key) { var n = s.key === prevDay(key) ? s.n + 1 : 1; if (s.key < key) store.set(KEY_STREAK, String(key * 1e3 + Math.min(999, n))); }
        return { best: this.best(), isNew: isNew && score > 0, streak: this.streak() };
      },
      // серия: дней подряд, включая сегодня (или вчера — если сегодня ещё не играли)
      streak: function () { var s = st(); return (s.key === key || s.key === prevDay(key)) ? s.n : 0; },
      playedToday: function () { return st().key === key; }
    };
  }
  K.daily = { KEY_BEST: KEY_BEST, KEY_STREAK: KEY_STREAK, dateKey: dateKey, prevDay: prevDay, seed: seed, label: label, mulberry32: mulberry32, Daily: Daily };
})(typeof window !== 'undefined' ? window : globalThis);
