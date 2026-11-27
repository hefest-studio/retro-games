# ЗАРЕВО (папка desant) — контракт модулей

## js/game.js — `DESANT.Game(opts)` (без DOM, детерминирована при заданном `rng`/`seed`)
`opts`: `{ rng, seed, zone=1, maxZone=5, onEvent(type,data), zones? }` (`players` игнорируется — один боец).
Экран 480×640, тайл `T`=24, карта 20 колонок × (`rows` зоны + `ARENA`=26) строк; строка 0 — верх (арена босса).
Тайлы: `G` 0, `SOLID` 1, `WATER` 2, `BRIDGE` 3, `COVER` 4, `CRATE` 5, `MUD` 6, `WALL` 7, `RUBBLE` 8, `BUNKER` 9, `BODY` 10 (таблицы `WALK`, `BURN`, `SHOTBLK`).
`BURN` — сгорает в вале (COVER, CRATE, WALL → RUBBLE).

API: `start()` · `update(dt)` · `setMove(0,dx,dy)` · `setFire(0,on)` · `bar()` → `'start'|'stop'|'empty'|null` (кнопка вала: старт / отбой) · `cont()` ·
`reviveAd()` / `boost()` / `canBoost()` (реклама за награду) · `state()` → S. Отладка: `_S, _spawn, _loadZone, _tileAt, _setTile, _circleHits, _los, _hurt, _boom, _kill, _makeBoss, _hurtPart, _vuln`.

`S`: `zone, maxZone, score, continues, phase('play'|'clear'|'cont'|'over'|'won'), hold, boosts, D, tiles, camY, cp, charge (0..BAR.max),
bar{st:'idle'|'wind'|'run'|'linger', y, t, tk, idle}, heroes[1]{x,y,hp,lives,alive,out,inv,face,fire,weapon}, enemies[{type,x,y,r,hp,state,warn,...}],
bullets[{k:'p'|'e',...}], lobs (навесные мины врага), booms, items[{kind:'shell'|'med'|'spread'|'rapid'}], marks, boulders, boss{key,x,y,active,intro,dead,parts[...]}`.

События: `zone, checkpoint, shot, eshot, aim, lob, hit, armor, wallHit, kill, crate, boom, barStart, barEnd, burn, noCharge, tip, pickup, life, heroHurt, heroDie,
respawn, out, contAsk, continue, spawn, rumble, rock, portOpen, bossIntro, bossHit, partDie, bossDie, clear, gameover, win`.

## Генератор — `DESANT.logic.genZone(n, seed)`
Сегменты снизу вверх: `scatter`, `river`, `line`, `bunker`, `road`, `depot` (склад снарядов), `stockade` (сплошной частокол — берётся только валом); арена босса сверху.
Частоколы и склады раскладываются ровно по `ZONES[n].stock/depots`, первый частокол — в начале (обучение); лишние обычные сегменты отбрасываются по `pri`.
`reach(D, tiles, x, y, rowMin, rowMax, burn)` — BFS пешком (`burn=true` — сжигаемое проходимо). Без огня арена недостижима, с огнём — всегда достижима.

## Вал — `DESANT.logic.BAR`
`{ max:100, h:46, lead:84, wind:0.55, linger:0.6, speed:78, drain:24, start:6, min:16, regen:2.1, regenWait:1.8, tick:0.2, dmg:3, car:5, bossDmg:1.2, shell:30 }`.

## Раскладка `BIND`
Одиночка: `p1` — WASD, fire `F`/Space, bar `G`/`E`; `p2` — стрелки, fire `.`/Num0, bar `/`/Num. (обе ведут бойца). Тач: стик (`js/stick.js`), ● огонь, ▲ вал, II пауза.

## js/render.js — `DESANT.render(ctx, g, S, P, {bare,toasts,shake})`, палитры `DESANT.palettes.modern|retro`, `DESANT.ui`.
## js/main.js — сборка (`gameId:'desant'`), площадка (таблица `desant`, «Без рекламы», ролик за награду), заставка; для автотестов `DESANT.app = { g, game(), newGame(o), demo }`.
