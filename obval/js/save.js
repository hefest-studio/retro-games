/* ОБВАЛ · сохранения. Прогресс: arcade.obval.stars.N = лучшие звёзды шахты (0–3, в облако 'max'), arcade.obval.reach = дальняя открытая шахта.
   Миграция игроков сайта: прежний ОБВАЛ (копание грунта, алмазы, светлячки) заменён пазлом про крепи, поэтому старый рекорд очков (ключ
   arcade.best.obval, другая шкала) не смешивается с новым — при первом запуске он уходит в «прежний рекорд» (arcade.obval.oldBest), рекорд-звёзды
   начинаются с нуля, игроку показывается сообщение «игра обновлена». Маркер версии — arcade.obval.v = '2'. OBVAL.save */
(function (global) {
  'use strict';
  var SW = global.OBVAL = global.OBVAL || {}, BEST = 'arcade.best.obval', VER = 2, PREFIX = 'arcade.obval.stars.', REACH = 'arcade.obval.reach';
  // io = { get(key), set(key, value), del(key) }. Один раз за игрока.
  function migrate(io) {
    if (io.get('arcade.obval.v') === String(VER)) return { migrated: false, oldBest: +io.get('arcade.obval.oldBest') || 0, notice: io.get('arcade.obval.notice') === '1' };
    var oldBest = +io.get(BEST) || 0, had = oldBest > 0;
    io.set('arcade.obval.v', String(VER));
    if (had) { io.set('arcade.obval.oldBest', String(oldBest)); io.del(BEST); io.set('arcade.obval.notice', '1'); }
    return { migrated: had, oldBest: oldBest, notice: had };
  }
  // прогресс по шахтам; store = { get(k) → строка|null, set(k, v) }; count — число уровней
  function Progress(store, count) {
    function get(n) { var v = parseInt(store.get(PREFIX + n), 10); return v > 0 ? Math.min(3, v) : 0; }
    var api = {
      get: get,
      record: function (n, s) { s = Math.max(0, Math.min(3, s | 0)); if (n < 1 || n > count || s <= get(n)) return false; store.set(PREFIX + n, String(s)); return true; },
      reach: function () { var v = parseInt(store.get(REACH), 10); return v > 0 ? Math.min(count, v) : 1; },
      reached: function (n) { if (n > api.reach() && n <= count) { store.set(REACH, String(n)); return true; } return false; },
      unlocked: function (n) { return n === 1 || (n > 1 && n <= count && (get(n - 1) > 0 || api.reach() >= n)); },
      maxUnlocked: function () { var m = 1; for (var n = 2; n <= count; n++) if (api.unlocked(n)) m = n; else break; return m; },
      total: function () { var s = 0; for (var n = 1; n <= count; n++) s += get(n); return s; },
      score: function () { return api.total() * 100; }
    };
    return api;
  }
  SW.save = { BEST: BEST, VER: VER, PREFIX: PREFIX, REACH: REACH, migrate: migrate, Progress: Progress };
})(typeof window !== 'undefined' ? window : globalThis);
