/* ШПУЛЬКА · миграция игроков сайта. СОСЕДИ (экшен «спасай соседей» на двоих) заменены другой игрой, поэтому прежний рекорд очков
   (ключ arcade.best.sosedi, другая шкала) не смешивается с новым: при первом запуске он переносится в «прежний рекорд»
   (arcade.sosedi.oldBest, показывается в меню), счёт нового рекорда — с нуля, игроку показывается сообщение «игра обновлена».
   Число игроков (arcade.players.sosedi) больше не нужно — удаляется. Маркер версии — arcade.sosedi.v = '2'. Подсказки первого стола — arcade.sosedi.tut. SPOOL.save */
(function (global) {
  'use strict';
  var SP = global.SPOOL = global.SPOOL || {}, BEST = 'arcade.best.sosedi', VER = 2;
  // io = { get(key), set(key, value), del(key) }. Один раз за игрока.
  function migrate(io) {
    if (io.get('arcade.sosedi.v') === String(VER)) return { migrated: false, oldBest: +io.get('arcade.sosedi.oldBest') || 0, notice: io.get('arcade.sosedi.notice') === '1' };
    var oldBest = +io.get(BEST) || 0, had = oldBest > 0;
    io.set('arcade.sosedi.v', String(VER)); io.del('arcade.players.sosedi');
    if (had) { io.set('arcade.sosedi.oldBest', String(oldBest)); io.del(BEST); io.set('arcade.sosedi.notice', '1'); }
    return { migrated: had, oldBest: oldBest, notice: had };
  }
  SP.save = { BEST: BEST, VER: VER, migrate: migrate };
})(typeof window !== 'undefined' ? window : globalThis);
