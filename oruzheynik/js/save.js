/* ОРУЖЕЙНИК · сохранение и миграция игроков сайта. Механика сменилась (был выбор цеха и трофеи боссов, теперь — молот-отражатель
   и путь по цехам), поэтому старое сохранение (`arcade.save.oruzheynik` формата v0/v1: победы, фляги, пароль) не переносится:
   при первом запуске новой версии оно стирается, прежний рекорд очков остаётся «прежним рекордом» (в меню), счёт нового
   рекорда — с нуля; игроку показывается сообщение «игра обновлена».
   Новое сохранение — ключ arcade.save.oruzheynik, JSON { v:3, si: этап (0..6), score }; пишется в начале каждого этапа.
   Маркер версии — arcade.oruzheynik.v = '3'. Подсказки первого этапа — arcade.oruzheynik.tut = '1' (прошёл — больше не показывать). */
(function (global) {
  'use strict';
  var OZ = global.ORUZH = global.ORUZH || {};
  var KEY = 'arcade.save.oruzheynik', BEST = 'arcade.best.oruzheynik', VER = 3, STAGES = 7;

  function clamp(n, a, b) { n = n | 0; return n < a ? a : n > b ? b : n; }
  function parse(raw) {
    if (!raw) return null;
    try { var o = typeof raw === 'string' ? JSON.parse(raw) : raw; return o && o.v === VER ? { v: VER, si: clamp(o.si, 0, STAGES - 1), score: clamp(o.score, 0, 99999999) } : null; } catch (e) { return null; }
  }
  function serialize(d) { return JSON.stringify({ v: VER, si: clamp(d.si, 0, STAGES - 1), score: clamp(d.score, 0, 99999999) }); }
  // io = { get(key), set(key, value), del(key) }. Один раз за игрока.
  function migrate(io) {
    if (io.get('arcade.oruzheynik.v') === String(VER)) return { migrated: false, oldBest: +io.get('arcade.oruzheynik.oldBest') || 0, notice: io.get('arcade.oruzheynik.notice') === '1' };
    var oldBest = +io.get(BEST) || 0, had = oldBest > 0 || !!io.get(KEY);
    io.set('arcade.oruzheynik.v', String(VER));
    if (had) {
      if (oldBest > 0) io.set('arcade.oruzheynik.oldBest', String(oldBest));
      io.del(BEST); io.del(KEY); io.set('arcade.oruzheynik.notice', '1');
    }
    return { migrated: had, oldBest: oldBest, notice: had };
  }
  OZ.save = { KEY: KEY, BEST: BEST, VER: VER, STAGES: STAGES, parse: parse, serialize: serialize, migrate: migrate };
})(typeof window !== 'undefined' ? window : globalThis);
