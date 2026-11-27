/* МУРАВЕЙНИК · миграция игроков сайта. Прежняя игра «КРОТ» (бур, алмазы, мешки) заменена другой, поэтому старый рекорд очков
   (ключ arcade.best.krot, другая шкала) не смешивается с новым: при первом запуске он переносится в «прежний рекорд»
   (arcade.krot.oldBest, показывается в меню), счёт нового рекорда — с нуля, игроку показывается сообщение «игра обновлена».
   Прежние ключи krot.* (настройки и рекорд старой версии) больше не читаются и удаляются. Маркер версии — arcade.krot.v = '2'.
   Подсказки первых уровней — arcade.krot.tut = '1'. MURAV.save */
(function (global) {
  'use strict';
  var MU = global.MURAV = global.MURAV || {}, BEST = 'arcade.best.krot', VER = 2, OLD = ['krot.settings.v1', 'krot.hi.v1', 'krot.gfx', 'krot.lang', 'krot.music', 'krot.sfx', 'krot.crt', 'ds.settings.v1', 'ds.hi.v1'];
  // io = { get(key), set(key, value), del(key) }. Один раз за игрока.
  function migrate(io) {
    if (io.get('arcade.krot.v') === String(VER)) return { migrated: false, oldBest: +io.get('arcade.krot.oldBest') || 0, notice: io.get('arcade.krot.notice') === '1' };
    var oldBest = +io.get(BEST) || 0, had = oldBest > 0;
    io.set('arcade.krot.v', String(VER));
    OLD.forEach(function (k) { if (io.get(k) != null) io.del(k); });
    if (had) { io.set('arcade.krot.oldBest', String(oldBest)); io.del(BEST); io.set('arcade.krot.notice', '1'); }
    return { migrated: had, oldBest: oldBest, notice: had };
  }
  MU.save = { BEST: BEST, VER: VER, migrate: migrate };
})(typeof window !== 'undefined' ? window : globalThis);
