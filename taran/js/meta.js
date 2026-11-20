/* ТАРАН · мета-прогрессия «Трасса дня» (DOM-free, тестируется в Node). TARAN.dailyMeta
   - Одна трасса на всех в сутки: track(day, n) — по номеру дня (сутки по серверному времени площадки, UTC+3; без площадки — часы устройства).
   - Рекорд дня — одним числом: encode(day, lap) = день·10⁶ + (999999 − круг в сотых). Облако площадки сливает его режимом 'max'
     (g.persist): свежий день всегда «больше» вчерашнего, внутри дня — меньшее время. decode(v, day) → круг в секундах или 0 (рекорд другого дня). */
(function (global) {
  'use strict';
  var T = global.TARAN = global.TARAN || {};
  function day(ms) { return Math.floor((ms + 3 * 3600000) / 86400000); }
  function track(d, n) { var h = (d * 2654435761) >>> 0; return ((h ^ (h >>> 13)) >>> 0) % n; }
  function encode(d, lap) { return d * 1e6 + (999999 - Math.min(999999, Math.max(0, Math.round(lap * 100)))); }
  function decode(v, d) { v = +v || 0; return Math.floor(v / 1e6) === d ? (999999 - v % 1e6) / 100 : 0; }
  T.dailyMeta = { day: day, track: track, encode: encode, decode: decode, KEY: 'arcade.taran.daily' };
})(typeof window !== 'undefined' ? window : globalThis);
