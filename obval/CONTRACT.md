# ОБВАЛ — контракт модулей (v2, «Крепильщик»)

Игра офлайн: HTML/CSS/Canvas без сборки, CDN и сети. Порядок загрузки (`index.html`): `engine.js` → `js/music.js` → `js/i18n.js` → `js/levels.js` → `js/game.js` → `js/save.js` → `js/audio.js` → `js/render.js` → `js/ui.js` → `js/main.js`.

## Логика — `js/game.js` (DOM-free, без случайности), пространство имён `window.OBVAL`
- `parse(def)` → уровень `L` (`W,H,N,wall[],exit[],haz[],hazList,exits,blk0[],miners0,stock0,props0`); символы карты — в шапке `levels.js`.
- Состояние `{ blk[] (0 пусто / 1 порода / 2 крепь), mp[], md[], ms[] (0 жив / 1 спасён / 2 погиб), stock }`. `unstable(L, blk)` — флаги породы без опоры (снизу опора или свод); `collapse(L, s, tr)` — падение по шагам;
  `walk(L, s, tr)` — шахтёры идут до упора; `apply(L, st, cell)` → `{ st, kind: 'place'|'remove' }` или `null`; `actions(L, st)`; `canPlace`; `won`, `lost`.
- `solve(L, from?, cap?)` → `{ solved, moves, path[], explored }` (поиск в ширину); `starsFor(moves, par)`.
- `Game({ level, par, onEvent })` → `state()`, `act(cell)`, `undo()`, `restart()`, `hint()`, `stuck()`, `canAct()`, `tick(dt)`; события `place`, `remove`, `crush`, `fall`, `save`, `dead`, `clear`, `undo`, `restart`.
  `state().anim` — кадры обрушения для рендера (`{ t, frames: [{ r: [id, cell…], m: [cell, state, dir…] }] }`).

## Остальное
- `js/levels.js` — `OBVAL.LEVELS` (24 карты, `par`, `stock`). `js/save.js` — `migrate(io)`, `Progress(store, count)`; ключи `arcade.obval.*`, рекорд `arcade.best.obval` (звёзды × 100).
- `js/render.js` — `OBVAL.render` (обе темы, портрет 450×660 и альбом 800×450). `js/main.js` — сцены `title → levels → play → clear → win`, площадка (лидерборд, «Без рекламы», награда, `adBreak`).
- Названия, спрайты, музыка и палитры — оригинальные. Тесты — `node obval/tests/engine.test.mjs`.
