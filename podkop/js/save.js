/* ПОДКОП · миграция игроков сайта. Прежний ПОДКОП («Лестницы и ямы»: лестницы, канаты, ямы-ловушки, золото) заменён другой игрой, поэтому старый рекорд очков
   (ключ arcade.best.podkop, другая шкала) не смешивается с новым: при первом запуске он переносится в «прежний рекорд» (arcade.podkop.oldBest, показывается в меню),
   счёт нового рекорда — с нуля, игроку показывается сообщение «игра обновлена». Маркер версии — arcade.podkop.v = '2'. Подсказки первых уровней — arcade.podkop.tut = '1'. PODKOP.save */
(function (global) {
  'use strict';
  var PK = global.PODKOP = global.PODKOP || {}, BEST = 'arcade.best.podkop', VER = 2;
  // io = { get(key), set(key, value), del(key) }. Один раз за игрока.
  function migrate(io) {
    if (io.get('arcade.podkop.v') === String(VER)) return { migrated: false, oldBest: +io.get('arcade.podkop.oldBest') || 0, notice: io.get('arcade.podkop.notice') === '1' };
    var oldBest = +io.get(BEST) || 0, had = oldBest > 0;
    io.set('arcade.podkop.v', String(VER));
    if (had) { io.set('arcade.podkop.oldBest', String(oldBest)); io.del(BEST); io.set('arcade.podkop.notice', '1'); }
    return { migrated: had, oldBest: oldBest, notice: had };
  }
  PK.save = { BEST: BEST, VER: VER, migrate: migrate };
})(typeof window !== 'undefined' ? window : globalThis);
