/* КАТЫШ · миграция игроков сайта. ХРУМ (лабиринт с точками и призраками) заменён другой игрой, поэтому старый рекорд очков
   (ключ arcade.best.hrum, другая шкала) не смешивается с новым: при первом запуске он переносится в «прежний рекорд»
   (arcade.hrum.oldBest, показывается в меню), счёт нового рекорда — с нуля, игроку показывается сообщение «игра обновлена».
   Маркер версии — arcade.hrum.v = '2'. Подсказки первого гумна — arcade.hrum.tut = '1'. KATYSH.save */
(function (global) {
  'use strict';
  var KT = global.KATYSH = global.KATYSH || {}, BEST = 'arcade.best.hrum', VER = 2;
  // io = { get(key), set(key, value), del(key) }. Один раз за игрока.
  function migrate(io) {
    if (io.get('arcade.hrum.v') === String(VER)) return { migrated: false, oldBest: +io.get('arcade.hrum.oldBest') || 0, notice: io.get('arcade.hrum.notice') === '1' };
    var oldBest = +io.get(BEST) || 0, had = oldBest > 0;
    io.set('arcade.hrum.v', String(VER));
    if (had) { io.set('arcade.hrum.oldBest', String(oldBest)); io.del(BEST); io.set('arcade.hrum.notice', '1'); }
    return { migrated: had, oldBest: oldBest, notice: had };
  }
  KT.save = { BEST: BEST, VER: VER, migrate: migrate };
})(typeof window !== 'undefined' ? window : globalThis);
