# ДЕСАНТ — контракт модулей

## js/game.js — `DESANT.Game(opts)` (без DOM, детерминирована при заданном `rng`/`seed`)
`opts`: `{ rng, seed, players=1|2, zone=1, maxZone=5, onEvent(type,data), zones? }`.
Экран 480×640, тайл `T`=24, карта 20 колонок × (`rows` зоны + `ARENA`=26) строк; строка 0 — верх (арена босса).
Тайлы: `G` 0, `SOLID` 1, `WATER` 2, `BRIDGE` 3, `COVER` 4, `CRATE` 5, `MUD` 6, `WALL` 7, `RUBBLE` 8, `BUNKER` 9, `BODY` 10
(таблицы `WALK`, `TANKOK`, `SHOTBLK`).

API: `start()` · `update(dt)` (подшаги ≤ 1/60) · `setMove(pi,dx,dy)` · `setFire(pi,on)` · `nade(pi)` → `'nade'|'exit'|'empty'|null` ·
`cont()` (с чекпоинта) · `state()` → S. Отладка: `_S, _spawn, _loadZone, _tileAt, _setTile, _circleHits, _los, _hurt, _boom, _kill,
_makeBoss, _hurtPart, _vuln, _mkTank`.

`S`: `zone, maxZone, players, score, continues, phase('play'|'clear'|'cont'|'over'|'won'), D (зона генератора), tiles, camY, cp,
heroes[{id,x,y,hp,lives,alive,out,inv,face,fire,weapon,nades,tank}], enemies[{type,x,y,r,hp,state,warn,...}], bullets[{k:'p'|'s'|'e',...}],
nades, booms, items, tanks[{x,y,face,armor,fuel,pilot,dead}], marks, boulders, boss{key,x,y,active,intro,dead,parts[{kind,hp,open}]}`.

События: `zone, checkpoint, shot, shell, eshot, aim, lob, hit, armor, wallHit, kill, crush, crate, boom, nade, noNade, pickup, life,
board, exit, noFuel, tankHit, tankDie, heroHurt, heroDie, respawn, out, contAsk, continue, spawn, rumble, rock, portOpen,
bossIntro, bossHit, partDie, bossDie, clear, gameover, win`.

## Генератор — `DESANT.logic.genZone(n, seed)`
Сегменты снизу вверх: `scatter`, `river` (1–2 моста), `line` (укрытия с проходами + гнёзда), `bunker`, `road` (броневик),
`tank` (брошенная танкетка), `wall` (крепость: ворота и пролом из ящиков); арена босса сверху. Проходимость старт → арена
гарантируется поиском 0-1 (`repairs` — число расчищенных клеток). `reach(D, tiles, x, y)` — BFS пешком.

## Раскладка `BIND` (через `g.usePlayers`)
И1: WASD, fire `F`/Space, nade `G`. И2: стрелки, fire `.`/Num0, nade `/`/Num. — без конфликтов с горячими клавишами (тест).

## js/render.js — `DESANT.render(ctx, g, S, P, {bare,toasts,shake})`, палитры `DESANT.palettes.modern|retro`, `DESANT.ui`.
## js/main.js — сборка (`gameId:'desant'`), тач-стик, титул; для автотестов `DESANT.app = { g, game(), newGame(o), demo }`.
