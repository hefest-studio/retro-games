# СТАРАТЕЛЬ — контракт модулей (v2, «Водосброс»)

Игра офлайн: HTML/CSS/Canvas без сборки, CDN и сети. Порядок загрузки (`index.html`): `engine.js` → `js/music.js` → `js/i18n.js` → `js/levels.js` → `js/game.js` → `js/save.js` → `js/audio.js` → `js/render.js` → `js/ui.js` → `js/main.js`.

## Логика — `js/game.js` (DOM-free, без Math.random), пространство имён `window.STARATEL`
- `parse(def)` → уровень `L` (`W,H,N,kind[],lift[],gates[],soils[],springs[],carts[],open0`); символы карты — в шапке `levels.js`.
- `flow(L, gates, dug)` → `{ wet, par, dir, depth, solid }` — установившийся поток (мемоизован). `settle(L, F, carts)` → `{ pos, paths }`. `apply(L, st, cell)` → `{ st, F, paths }` или `null`.
- `solve(L, from?, cap?)` → `{ solved, moves, path[], explored }` (поиск в ширину); `starsFor(moves, par)`.
- `Game({ level, par, onEvent })` → `state()`, `act(cell)`, `undo()`, `restart()`, `hint()`, `stuck()`, `canAct()`, `tick(dt)`; события `dig`, `gateOpen`, `gateShut`, `cart`, `undo`, `restart`, `clear`.

## Остальное
- `js/levels.js` — `STARATEL.LEVELS` (24 карты, `par`). `js/save.js` — `migrate(io)`, `Progress(store, count)`; ключи `arcade.staratel.*`, рекорд `arcade.best.staratel` (звёзды × 100).
- `js/render.js` — `STARATEL.render` (обе темы, портрет 450×660 и альбом 800×450). `js/main.js` — сцены `title → levels → play → clear → win`, площадка. `STARATEL.app` — служебный доступ для промо/тестов.
- Названия, спрайты, музыка и палитры — оригинальные. Тесты — `node staratel/tests/engine.test.mjs`.
