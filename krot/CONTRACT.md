# МУРАВЕЙНИК · контракт модулей
- `js/game.js` — `MURAV.Game({ level, seed, lives, length, onEvent })` → `{ state(), step(dt), setDir(d|-1), collapse(), clone(), revive(), addAnts(n), isOver(), pos(i) }`; `MURAV.level(i)`, `MURAV.consts`, `MURAV.fromState(S, onEvent)`.
  Состояние `S` — чистые данные (карта `S.map[y][x]`: `c` камера, `.` туннель, `1` земля, `#` скала; `S.ants[]` {x,y,c}; `S.beetles[]`; `S.crumbs[]`; `S.mv` ход головы; `S.mode`: play/clear/dying/gameover/victory).
  События: dig, step, flip, pick, deliver, hatch, bite, hurt, collapse, entomb, nogo, life, clear, level, gameover, victory.
- `js/render.js` — `MURAV.render.draw(ctx, S, scene, { toasts, score, tutText })`; рендер только читает состояние.
- `js/main.js` — сцены движка, ввод, события → звук/частицы/тосты, площадка. Служебный доступ для промо/тестов: `MURAV.app` (`setLevel(lv, len)`, `game()`, `clear()`).
- Ключи хранилища: `arcade.best.krot`, `arcade.krot.tut`, `arcade.krot.v`, `arcade.krot.oldBest`, `arcade.krot.notice`.
