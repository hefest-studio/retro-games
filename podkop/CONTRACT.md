# ПОДКОП · контракт модулей
- `js/game.js` — `PODKOP.Game({ level, seed, lives, onEvent, state })` → `{ state(), step(dt), setInput({dx,dy,dig,pour}), next(), skip(), restart(), revive(), addSand(n), isOver(), load(lv), clone() }`; `PODKOP.level(i)`, `PODKOP.consts`, `PODKOP.fromState(S, o)`.
  Состояние `S`: `g` — поле `Uint8Array(22×18)` (0 воздух, 1 песок, 2 скала, 3 пескопад, 4 шипы), `fl` — «падающие» зёрна (бьют по врагам и герою), `hero` {x,y,f,bag}, `enemies[]` {t:'w'|'c', fast, x, y, d, alive}, `spouts[]`, `exit`, `top` (первая показываемая строка), `mode`: play/dying/clear/gameover/victory.
  События: dig, pour, step, full, nogo, spout, bury, hurt, retry, clear, level, life, gameover, victory.
- `js/levels.js` — `PODKOP.LEVELS[]` `{ id, name:{ru,en}, bag, par, hint, map[] }`; символы: `#` скала, `s` песок, `^` шипы, `V` пескопад, `H` герой, `E` дверь, `w`/`W` краб/быстрый краб, `c` скорпион; строки снизу вверх, 22 символа.
- `js/render.js` — `PODKOP.render.draw(ctx, S, scene, { toasts, tutText })`, `.bare(ctx, S, scene)` (поле без HUD), `.geo`, `.pal`, `.pt`; рендер только читает состояние.
- `js/main.js` — сборка движка v2; `PODKOP.app` — служебный доступ для промо-сценариев (`setLevel(lv)`, `game()`, `clear()`).
- Порядок: `engine.js → music → i18n → game → levels → audio → render → stick → ui → save → main`. Рекорд `arcade.best.podkop`, подсказки `arcade.podkop.tut`, миграция `arcade.podkop.v/oldBest/notice`.
